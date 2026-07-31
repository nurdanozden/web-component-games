import { LitElement, html, css, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import {
  GameState,
  LevelResult,
  Localized,
  SettingsMenuController,
  i18nStyles,
  renderSettingsMenu,
  settingsMenuStyles,
  type MessageKey,
} from '@octapull-games/core';
import {
  generateRound,
  FREE_MODE_TIME_MS,
  RANDOM_MODE_DIFFICULTY,
  timeLimitFor,
  type Round,
} from './round';
import { applyOp, type Op, type SolutionStep } from './solver';

// ─── Constants ──────────────────────────────────────────────────────────────

const GAME_ID = 'game-octanum';

/** Tam isabette kutlama animasyonunun oynaması için sonuç paneli geciktirilir. */
const EXACT_REVEAL_MS = 620;

/** Kural uyarısının ekranda kalma süresi. */
const NOTICE_MS = 1800;

/** Tam isabet taban puanı (bkz. README · Puanlama). */
const EXACT_BASE_SCORE = 100;

/** Tam isabet yoksa her birim fark bu kadar puan götürür. */
const PENALTY_PER_DIFF = 10;

type Phase = 'idle' | 'playing' | 'finishing' | 'done';

/** Turun nasıl bittiği; sonuç panelinin başlığını ve event'i belirler. */
type EndReason = 'exact' | 'manual' | 'time-up';

/**
 * Sahnedeki bir bileşen. `id` sabittir: Lit kartları listedeki sıraya göre
 * değil kimliğine göre eşleştirsin diye — böylece karışımdan çıkan yeni kart
 * animasyonla belirirken komşuları yeniden çizilmez.
 */
interface Card {
  id: number;
  value: number;
  /** İşlem sonucu mu, yoksa turun başında dağıtılan bileşen mi? */
  derived: boolean;
}

interface Move {
  a: Card;
  b: Card;
  op: Op;
  result: Card;
  /** Geri alındığında kartların eski yerlerine dönmesi için. */
  indexA: number;
  indexB: number;
}

interface Outcome {
  exact: boolean;
  reached: number;
  diff: number;
  reason: EndReason;
  durationMs: number;
  score: number;
  isBest: boolean;
}

const OPS: readonly { op: Op; symbol: string; key: MessageKey }[] = [
  { op: '+', symbol: '+', key: 'octanum.opAdd' },
  { op: '-', symbol: '−', key: 'octanum.opSub' },
  { op: '*', symbol: '×', key: 'octanum.opMul' },
  { op: '/', symbol: '÷', key: 'octanum.opDiv' },
];

const OP_SYMBOL: Record<Op, string> = { '+': '+', '-': '−', '*': '×', '/': '÷' };

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Seeded PRNG (mulberry32) — diğer oyunlarla aynı üreteç. */
function mulberry32(seed: number) {
  return function (): number {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/**
 * İki bileşenin karışımı; kural `solver.applyOp` ile ortaktır (üretim, çözücü ve
 * oynanış aynı tanımı kullanmalı). Kurala aykırı birleşim `null` döner.
 */
export function combine(a: number, op: Op, b: number): number | null {
  return applyOp(a, op, b);
}

/**
 * Tur puanı (bkz. README · Puanlama).
 *   Tam isabet: 100 + kalan saniye
 *   Kısmi     : max(0, 100 − fark × 10)
 */
export function scoreFor(exact: boolean, diff: number, remainingMs: number): number {
  if (exact) return EXACT_BASE_SCORE + Math.floor(Math.max(0, remainingMs) / 1000);
  return Math.max(0, EXACT_BASE_SCORE - diff * PENALTY_PER_DIFF);
}

/** Seviye → 0 (en kolay) … 1 (en zor). */
export function difficultyFor(level: number, levelCount: number): number {
  return Math.min(Math.max((level - 1) / Math.max(levelCount - 1, 1), 0), 1);
}

/**
 * Şişedeki sıvı seviyesi. Değerler 1 ile binler arasında gezindiği için ölçek
 * logaritmiktir: küçük bileşenler arasındaki fark görünür kalır, büyük sonuçlar
 * da şişeyi taşırmaz.
 */
function liquidFill(value: number): number {
  const t = Math.log10(Math.abs(value) + 1) / 3.2; // 0 … ~1 (999 ≈ 0.94)
  return Math.round((0.2 + Math.min(t, 1) * 0.68) * 100);
}

function formatClock(ms: number): string {
  const secs = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
}

// ─── Component ──────────────────────────────────────────────────────────────

export class OctanumGame extends Localized(LitElement) {
  static styles = [i18nStyles, settingsMenuStyles, css`
    *, *::before, *::after { box-sizing: border-box; }

    :host {
      /* Dahili tema paleti. Host sayfanın verdiği --og-* değişkenleri daima
         kazanır; buradakiler yalnızca sıfır ayarla doğru görünmeyi sağlayan
         temaya duyarlı varsayılanlardır. */
      /* Octameet grileri — bileşen ana ürünün sağdaki "Uygulamalar" paneline
         gömüldüğü için koyu tema o panelle aynı nötr ailede durur. Yüzeyler
         zeminden koyulaşarak değil, açılarak ayrışır. */
      --_bg: #404040;          /* kart — Octameet panel zemini */
      --_surface: #515151;     /* oyun alanı, karttan bir ton açık */
      --_text: #ffffff;
      --_text-dim: #dedede;
      --_border: #5c5c5c;
      --_shadow: 0 20px 25px -5px rgba(0,0,0,.4), 0 8px 10px -6px rgba(0,0,0,.3);
      --_line: #5c5c5c;
      --_fill: #5c5c5c;        /* düğme, çip, ikincil yüzeyler */
      --_fill-soft: #515151;
      --_track: #363636;   /* cukur yuzey: ilerleme cubugu izi.
                              Vurgu dolgusu #5c5c5c iz uzerinde 2.2:1'e
                              dusuyordu; koyu iz onu 3.9:1'e cikarir. */
      --_fill-strong: #6b6b6b; /* hover/aktif — düz palette durumun görünür
                                  kalması için --_fill'in bir ton üstü */
      --_glass: rgba(255,255,255,.10);
      --_metal: #d0d0d0;

      /* Vurgu renkleri iki temada da ortak kalır (simya altını + eflatun). */
      --_primary: #3b82f6;   /* octafort/octahang ile ayni mavi */
      --_accent: #ff5f00;   /* Octameet turuncusu (eski simya altini) */
      --_potion: #4ade80;
      /* Koyu temada gri zemin üzerinde okunacak kadar açık tonlar;
         açık tema kendi bloğunda eski doygun değerlerde kalır. */
      --_ok: #86efac;
      --_bad: #ffc9c9;

      display: block;
      position: relative;
      font-family: var(--og-font, system-ui, -apple-system, sans-serif);
      background: var(--og-bg, var(--_bg));
      color: var(--og-text, var(--_text));
      /* Yüzde, kapsayıcının genişliğine göre çözülür: geniş kartta içerik
         kenarlara yapışmaz, 320 px'lik ekranda ise alt sınıra düşerek yeri
         israf etmez. */
      padding: clamp(1.1rem, 4.5%, 2rem);
      border: 1px solid var(--_border);
      border-radius: var(--og-radius, 16px);
      box-shadow: var(--_shadow);
      min-width: 280px;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
    }

    /* Aged Parchment — eski bir formül defterinin sayfası. */
    :host([theme='light']) {
      /* Nötrler diğer üç oyunla birebir aynı gri ailesinden gelir; simyanın
         kimliği zemin renginde değil, vurgu renklerinde (eflatun, turuncu,
         iksir yeşili) taşınır. Eskiden burada krem/bej bir palet vardı ve
         oyun, yan yana durduğu diğer oyunlardan ayrı düşüyordu. */
      --_bg: #ffffff;
      --_surface: #f1f5f9;
      --_text: #0f172a;
      --_text-dim: #64748b;
      --_border: #e2e8f0;
      --_shadow: 0 20px 25px -5px rgba(15,23,42,.08), 0 8px 10px -6px rgba(15,23,42,.04);
      --_line: rgba(15,23,42,.12);
      --_fill: rgba(15,23,42,.05);
      --_fill-soft: rgba(15,23,42,.03);
      --_fill-strong: rgba(15,23,42,.08);
      --_track: rgba(15,23,42,.05);
      --_glass: rgba(124,58,237,.07);
      /* İmbiğin metal parçaları da nötre çekildi: sıcak kahve (#8b7a5c) gri
         zeminde tek başına sırıtıyordu. Ton, eskisiyle aynı görsel ağırlıkta
         seçildi (kart üzerinde 3.95 — eskisi krem üzerinde 4.00). */
      --_metal: #748196;
      --_primary: #3b82f6;   /* iki temada da ayni mavi */
      --_accent: #ff5f00;   /* Octameet turuncusu — iki temada da ayni */
      --_potion: #16a34a;
      --_ok: #22c55e;
      --_bad: #ef4444;
    }

    /* ── HUD ── */
    .hud {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: .5rem;
      margin-bottom: .7rem;
    }
    .hud-group { display: flex; align-items: center; gap: .4rem; min-width: 0; }
    /* Host sayfanın kendi düğmelerini (mod, ses vb.) tema düğmesinin yanına
       yerleştirebilmesi için. */
    ::slotted(*) { flex: none; }

    .chip {
      font-size: .7rem;
      font-weight: 700;
      letter-spacing: .04em;
      text-transform: uppercase;
      color: var(--_text-dim);
      background: var(--_fill);
      padding: .3rem .65rem;
      border-radius: 999px;
      white-space: nowrap;
    }
    .chip.clock { color: inherit; font-variant-numeric: tabular-nums; }
    .chip.clock.low { color: var(--_bad); animation: pulse 1s ease-in-out infinite; }
    @keyframes pulse { 50% { opacity: .45; } }

    .theme-toggle {
      cursor: pointer;
      border: none;
      border-radius: 999px;
      flex: none;
      display: inline-flex;
      align-items: center;
      gap: .3rem;
      padding: .3rem .55rem;
      font-size: .75rem;
      font-weight: 600;
      line-height: 1;
      background: var(--_fill);
      color: inherit;
      transition: background .15s, transform .15s;
    }
    .theme-toggle:hover { background: var(--_fill-strong); }
    .theme-toggle:active { transform: scale(.92); }
    .theme-toggle:focus-visible { outline: 3px solid var(--og-accent, var(--_accent)); outline-offset: 2px; }

    .progress-track {
      height: 8px;
      border-radius: 999px;
      background: var(--_track, var(--_fill));
      overflow: hidden;
      margin-bottom: .85rem;
    }
    .progress-fill {
      height: 100%;
      border-radius: inherit;
      background: var(--og-accent, var(--_accent));
      transition: width .2s linear;
    }
    .progress-fill.low { background: var(--_bad); }

    /* ── 1. Bölge: hedef formül ── */
    .target {
      container-type: inline-size;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: .85rem;
      padding: .7rem 1rem;
      margin-bottom: .9rem;
      border-radius: calc(var(--og-radius, 16px) * .7);
      background: var(--og-surface, var(--_surface));
      border: 1px solid var(--_line);
    }
    .cauldron { width: 54px; height: 54px; flex: none; overflow: visible; }
    .cauldron .pot { fill: var(--_metal); }
    .cauldron .brew { fill: var(--og-octanum-potion, var(--_potion)); }
    .cauldron .bubble {
      fill: var(--og-accent, var(--_accent));
      opacity: 0;
      animation: bubble 2.6s ease-in infinite;
    }
    .cauldron .bubble:nth-of-type(2) { animation-delay: .85s; }
    .cauldron .bubble:nth-of-type(3) { animation-delay: 1.7s; }
    @keyframes bubble {
      0% { opacity: 0; transform: translateY(0) scale(.5); }
      25% { opacity: .85; }
      100% { opacity: 0; transform: translateY(-16px) scale(1.1); }
    }

    .target-text { display: flex; flex-direction: column; align-items: flex-start; min-width: 0; }
    .target-label {
      font-size: .62rem;
      font-weight: 800;
      letter-spacing: .12em;
      text-transform: uppercase;
      color: var(--_text-dim);
    }
    .target-value {
      font-size: clamp(2rem, 12cqi, 2.9rem);
      font-weight: 800;
      line-height: 1.05;
      font-variant-numeric: tabular-nums;
      /* Vurgu turuncusu bu zeminde 2.6:1 veriyordu; odak sayi metin renginde
         kalsin, turuncu etiket/kazan/dugmelerde surer. */
      color: var(--og-text, var(--_text));
    }
    .target.hit .target-value { animation: flare .6s ease; }
    @keyframes flare {
      0% { transform: scale(1); }
      40% { transform: scale(1.18); }
      100% { transform: scale(1); }
    }

    /* ── 2. Bölge: bileşen şişeleri ── */
    .board {
      --_gap: .5rem;
      container-type: inline-size;
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: var(--_gap);
      margin-bottom: .8rem;
      min-height: 4.9rem;
    }
    .board.shake { animation: shake .34s ease; }
    @keyframes shake {
      10%, 90% { transform: translateX(-2px); }
      20%, 80% { transform: translateX(3px); }
      30%, 50%, 70% { transform: translateX(-5px); }
      40%, 60% { transform: translateX(5px); }
    }

    .vial {
      position: relative;
      /* Üç sütunluk düzen: kartlar tükendikçe kalanlar ortalanır, ızgaranın
         sol tarafına yapışmaz. */
      flex: 0 1 calc((100% - 2 * var(--_gap)) / 3);
      max-width: 8rem;
      min-width: 4rem;
      height: 4.6rem;
      cursor: pointer;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      /* Cam şişe silueti: omuzları dik, tabanı yuvarlak. */
      border: 1px solid var(--_line);
      border-radius: 10px 10px 18px 18px;
      background: var(--_glass);
      color: inherit;
      font-family: inherit;
      transition: transform .14s, border-color .14s, box-shadow .14s, opacity .14s;
      animation: pour .28s cubic-bezier(.34,1.56,.64,1);
    }
    @keyframes pour {
      from { opacity: 0; transform: translateY(-8px) scale(.9); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    /* Şişenin boynundaki mantar. */
    .vial::before {
      content: '';
      position: absolute;
      top: 0; left: 50%;
      width: 42%;
      height: 6px;
      transform: translateX(-50%);
      border-radius: 0 0 4px 4px;
      background: var(--_fill-strong);
    }
    .liquid {
      position: absolute;
      inset: auto 0 0 0;
      height: var(--_fill-level, 50%);
      /* Düz dolgu — degrade yok. Yarı saydam kalır, çünkü sıvı camın
         arkasından görünür; ama tek renktir, geçiş içermez. */
      background: color-mix(in srgb, var(--og-octanum-potion, var(--_potion)) 42%, transparent);
      border-radius: 0 0 17px 17px;
      transition: height .2s ease;
    }
    /* Sıvının üst yüzeyindeki ışık çizgisi. */
    .liquid::after {
      content: '';
      position: absolute;
      inset: 0 0 auto 0;
      height: 2px;
      background: color-mix(in srgb, var(--og-octanum-potion, var(--_potion)) 90%, transparent);
    }
    .vial .value {
      position: relative;
      font-size: clamp(1rem, 5.5cqi, 1.45rem);
      font-weight: 800;
      line-height: 1;
      font-variant-numeric: tabular-nums;
      text-shadow: 0 1px 3px rgba(0,0,0,.35);
    }
    :host([theme='light']) .vial .value { text-shadow: none; }
    .vial.derived { border-style: dashed; }
    .vial:hover:not(:disabled) { transform: translateY(-2px); }
    .vial:active:not(:disabled) { transform: scale(.96); }
    .vial:focus-visible { outline: 3px solid var(--og-accent, var(--_accent)); outline-offset: 2px; }
    .vial.selected {
      border-color: var(--og-accent, var(--_accent));
      box-shadow: 0 0 0 2px var(--og-accent, var(--_accent)), 0 0 18px -2px var(--og-accent, var(--_accent));
    }
    .vial:disabled { cursor: default; opacity: .3; }

    /* ── 3. Bölge: işlem kazanları ── */
    .ops {
      display: flex;
      justify-content: center;
      gap: .5rem;
      margin-bottom: .7rem;
    }
    .op {
      cursor: pointer;
      flex: 0 1 4rem;
      min-width: 2.6rem;
      height: 2.9rem;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      border: 1px solid var(--_line);
      border-radius: 999px;
      background: var(--_fill-soft);
      color: inherit;
      font-family: inherit;
      font-size: 1.35rem;
      font-weight: 700;
      line-height: 1;
      transition: background .12s, transform .12s, border-color .12s, color .12s;
    }
    .op:hover:not(:disabled) { background: var(--_fill-strong); }
    .op:active:not(:disabled) { transform: scale(.93); }
    .op:focus-visible { outline: 3px solid var(--og-accent, var(--_accent)); outline-offset: 2px; }
    .op:disabled { cursor: default; opacity: .35; }
    .op.selected {
      background: var(--og-primary, var(--_primary));
      border-color: var(--og-primary, var(--_primary));
      color: #fff;
    }

    /* ── 4. Bölge: yönerge / uyarı satırı ── */
    .hint {
      min-height: 1.35rem;
      margin-bottom: .7rem;
      text-align: center;
      font-size: .8rem;
      color: var(--_text-dim);
      line-height: 1.3;
    }
    .hint.warn { color: var(--_bad); font-weight: 600; }

    /* ── 5. Bölge: eylem düğmeleri ── */
    .actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: .45rem;
      margin-bottom: .8rem;
    }
    button.btn {
      cursor: pointer;
      border: 1px solid var(--_line);
      border-radius: 10px;
      padding: .5rem .9rem;
      background: var(--_fill-soft);
      color: inherit;
      font-family: inherit;
      font-size: .8rem;
      font-weight: 600;
      transition: background .15s, transform .15s, opacity .15s;
    }
    button.btn:hover:not(:disabled) { background: var(--_fill-strong); }
    button.btn:active:not(:disabled) { transform: scale(.97); }
    button.btn:focus-visible { outline: 3px solid var(--og-accent, var(--_accent)); outline-offset: 2px; }
    button.btn:disabled { opacity: .35; cursor: default; }
    button.btn.accent {
      background: var(--og-accent, var(--_accent));
      border-color: transparent;
      color: #1b1206;
    }
    button.btn.accent:hover:not(:disabled) { filter: brightness(1.08); background: var(--og-accent, var(--_accent)); }

    /* ── 6. Bölge: karışım defteri ── */
    .log {
      border-radius: calc(var(--og-radius, 16px) * .55);
      border: 1px dashed var(--_line);
      background: var(--_fill-soft);
      padding: .55rem .7rem;
    }
    .log h3 {
      margin: 0 0 .35rem;
      font-size: .62rem;
      font-weight: 800;
      letter-spacing: .1em;
      text-transform: uppercase;
      color: var(--_text-dim);
    }
    .log ol {
      /* Uzun turlarda defter büyümesin diye kaydırılır; son satır daima
         görünür kalsın diye içerik ters çevrilmez, kaydırma JS'siz bırakılır. */
      margin: 0;
      padding: 0;
      list-style: none;
      max-height: 5.6rem;
      overflow-y: auto;
      font-size: .82rem;
      font-variant-numeric: tabular-nums;
      line-height: 1.55;
    }
    .log li::before { content: '⚗'; margin-inline-end: .4rem; opacity: .55; }
    .log .empty { margin: 0; font-size: .8rem; color: var(--_text-dim); }
    .log .eq { color: var(--og-accent, var(--_accent)); font-weight: 700; }

    /* ── Sonuç paneli ── */
    /* Bileşenin kendi kutusunun ortasında açılır (position: absolute, fixed
       değil): host bir modalın içine gömüldüğünde dışarı taşan ikinci bir
       tam-ekran katman oluşmaz. */
    .modal-backdrop {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.25rem;
      border-radius: inherit;
      background: rgba(26, 26, 26, .58);
      backdrop-filter: blur(3px);
      /* Kart içindeki her şeyin üstünde: açık kalmış ayar menüsü (z-index 60)
         tur biterken sonuç penceresinin önüne geçmemeli. */
      z-index: 999;
      animation: fadeIn .25s ease;
    }
    :host([theme='light']) .modal-backdrop { background: rgba(15, 23, 42, .35); }

    .result {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: .8rem;
      width: 100%;
      max-width: 380px;
      max-height: 100%;
      overflow-y: auto;
      padding: 1.4rem 1.2rem;
      border-radius: calc(var(--og-radius, 16px) * 1.1);
      background: var(--og-bg, var(--_bg));
      border: 1px solid var(--_border);
      box-shadow: var(--_shadow);
      text-align: center;
      animation: popIn .3s cubic-bezier(.34,1.56,.64,1) both;
    }
    .result h2 { margin: 0; font-size: 1.3rem; font-weight: 800; }
    .result .emoji { font-size: 2.3rem; line-height: 1; }
    @keyframes popIn {
      from { opacity: 0; transform: scale(.9) translateY(8px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .stats-row { display: flex; gap: .5rem; flex-wrap: wrap; justify-content: center; }
    .stat-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: .1rem;
      min-width: 78px;
      padding: .55rem .7rem;
      border-radius: 14px;
      background: var(--_fill);
      border: 1px solid var(--_line);
    }
    .stat-card.is-best {
      border-color: var(--og-accent, var(--_accent));
      box-shadow: 0 0 0 1px var(--og-accent, var(--_accent));
    }
    .stat-icon { font-size: 1.1rem; line-height: 1; }
    .stat-value {
      font-size: 1.35rem;
      font-weight: 800;
      line-height: 1.1;
      font-variant-numeric: tabular-nums;
      color: var(--og-text, var(--_text));
    }
    .stat-label {
      font-size: .6rem;
      font-weight: 700;
      letter-spacing: .04em;
      text-transform: uppercase;
      color: var(--_text-dim);
    }
    .best-badge { font-size: .72rem; font-weight: 700; color: var(--og-accent, var(--_accent)); }

    .solution {
      width: 100%;
      padding: .55rem .7rem;
      border-radius: 10px;
      border: 1px dashed var(--_line);
      background: var(--_fill-soft);
      font-size: .78rem;
      line-height: 1.6;
      font-variant-numeric: tabular-nums;
      color: var(--_text-dim);
    }
    .solution b { display: block; margin-bottom: .2rem; color: var(--og-accent, var(--_accent)); font-size: .62rem; letter-spacing: .08em; text-transform: uppercase; }
    .solution code { font-family: inherit; color: var(--og-text, var(--_text)); }

    /* ── Başlangıç ekranı ── */
    .overlay {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      padding: 1.6rem 1rem;
      text-align: center;
      animation: fadeIn .3s ease;
    }
    .overlay h2 { margin: 0; font-size: 1.5rem; font-weight: 800; }
    .overlay p { margin: 0; color: var(--_text-dim); font-size: .9rem; max-width: 34ch; line-height: 1.5; }
    /* Ayar düğmesi açılış ekranında da HUD'daki yerinde durur: oyuncu tek bir
       köşeyi öğrenir, ekran değişince aramak zorunda kalmaz. */
    .overlay-top { display: flex; justify-content: flex-end; align-items: center; }

    /* Açılış amblemi: ateşte kaynayan, ağzından bileşen atılan bir imbik.
       Emoji yerine kendi SVG'miz olduğu için tema renklerini alır ve her
       platformda aynı görünür. Bileşenler 1.4 sn arayla sırayla içeri düşer,
       yani hep tam biri havadadır.
       transform-box/origin olmadan SVG'de scale() parçaları sol üst köşeye
       doğru kaydırırdı; animasyonlu her öğede bu yüzden ayarlanır. */
    .still { width: 100%; max-width: 132px; height: auto; overflow: visible; }

    /* Arkadaki ışıma imbiği zeminden ayırır ve "canlı" hissi verir. */
    .still .halo {
      fill: var(--og-octanum-potion, var(--_potion));
      filter: blur(7px);
      opacity: .16;
      animation: halo-pulse 3.6s ease-in-out infinite alternate;
    }
    @keyframes halo-pulse {
      from { opacity: .12; transform: scale(.94); }
      to { opacity: .26; transform: scale(1.04); }
    }

    .still .glass { fill: var(--_glass); }
    .still .edge, .still .mouth {
      fill: none;
      stroke: var(--_metal);
      stroke-width: 3;
      stroke-linejoin: round;
      stroke-linecap: round;
    }
    .still .mouth { fill: var(--og-surface, var(--_surface)); stroke-width: 2.5; }
    .still .base { fill: var(--_metal); }
    .still .shine { fill: none; stroke: #fff; stroke-width: 2.5; stroke-linecap: round; opacity: .16; }
    .still .ticks { fill: none; stroke: var(--_metal); stroke-width: 1.6; stroke-linecap: round; opacity: .7; }

    /* İksir: iki periyotluk dalga sürekli yana kayar, sıvı böylece durgun
       durmaz. Dalga imbik gövdesine kırpıldığı için camdan taşmaz. */
    /* Düz dolgu — kazandaki .brew ile aynı ton; degrade tanımı kaldırıldı. */
    .still .brew { fill: var(--og-octanum-potion, var(--_potion)); }
    .still .wave { animation: wave-slide 3.4s linear infinite; }
    @keyframes wave-slide { to { transform: translateX(-40px); } }

    .still .bub {
      fill: #fff;
      opacity: 0;
      transform-box: fill-box;
      transform-origin: center;
      animation: bub-rise 2.8s ease-in infinite;
    }
    .still .bub.b2 { animation-duration: 3.4s; animation-delay: .7s; }
    .still .bub.b3 { animation-duration: 2.3s; animation-delay: 1.5s; }
    @keyframes bub-rise {
      0% { opacity: 0; transform: translateY(0) scale(.45); }
      20% { opacity: .6; }
      70% { opacity: .5; }
      100% { opacity: 0; transform: translateY(-19px) scale(1.15); }
    }

    /* Kazana atılan bileşenler: 7 ve 3 rakamlarıyla × işlemi, oyunun kendi
       dilinden. Ağza varınca sönerler; içeri girmiş gibi görünür. */
    .still .ing {
      fill: var(--og-accent, var(--_accent));
      font-size: 17px;
      font-weight: 800;
      text-anchor: middle;
      transform-box: fill-box;
      transform-origin: center;
      opacity: 0;
      animation: ing-drop 4.2s ease-in infinite;
    }
    .still .ing.i2 { animation-delay: 1.4s; }
    .still .ing.i3 { animation-delay: 2.8s; }
    @keyframes ing-drop {
      0% { opacity: 0; transform: translateY(-22px) rotate(-16deg) scale(.7); }
      8% { opacity: 1; }
      26% { opacity: 1; transform: translateY(-3px) rotate(7deg) scale(1); }
      33%, 100% { opacity: 0; transform: translateY(4px) rotate(11deg) scale(.6); }
    }

    /* Ocak ateşi: kaynamanın sebebi görünsün diye imbiğin altında titreşir. */
    .still .flame {
      fill: var(--og-accent, var(--_accent));
      transform-box: fill-box;
      transform-origin: bottom center;
      opacity: .9;
      animation: flicker 1.1s ease-in-out infinite alternate;
    }
    .still .flame.f2 { animation-duration: .8s; animation-delay: .25s; opacity: .6; }
    .still .flame.f3 { animation-duration: .95s; animation-delay: .5s; opacity: .6; }
    .still .flame.core {
      fill: color-mix(in srgb, var(--og-accent, var(--_accent)) 35%, #fff);
      animation-duration: .7s;
    }
    .still .fire-glow {
      fill: var(--og-accent, var(--_accent));
      filter: blur(6px);
      opacity: .22;
      animation: halo-pulse 1.6s ease-in-out infinite alternate;
    }
    @keyframes flicker {
      from { transform: scaleY(.82) scaleX(1.06); }
      to { transform: scaleY(1.08) scaleX(.94); }
    }

    button.btn-primary {
      cursor: pointer;
      border: none;
      border-radius: 10px;
      padding: .6rem 1.4rem;
      font-family: inherit;
      font-size: .9rem;
      font-weight: 600;
      /* Düz renk — degrade yok. Diğer oyunlarla aynı düğme dili. */
      background: var(--og-primary, var(--_primary));
      color: #fff;
      transition: transform .15s, filter .15s;
    }
    button.btn-primary:hover { filter: brightness(1.1); }
    button.btn-primary:active { transform: scale(.97); }
    button.btn-primary:focus-visible { outline: 3px solid var(--og-accent, var(--_accent)); outline-offset: 2px; }

    .sr-only {
      position: absolute;
      width: 1px; height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }

    @media (max-width: 400px) {
      .vial { height: 4.1rem; }
      .op { height: 2.6rem; font-size: 1.2rem; }
    }

    @media (prefers-reduced-motion: reduce) {
      .board.shake, .vial, .target.hit .target-value,
      .result, .modal-backdrop, .overlay { animation: none; }
      .cauldron .bubble { animation: none; opacity: .7; }
      /* Amblem hareketsiz kalır ama boş görünmesin diye parçalar
         okunur bir duruşta sabitlenir. */
      .still .halo, .still .wave, .still .bub,
      .still .ing, .still .flame, .still .fire-glow { animation: none; }
      .still .bub { opacity: .5; }
      /* Bileşenler tek tek düşemediği için yan yana dizilir: "7 × 3" okunur
         kalsın diye x ekseninde de açılırlar. */
      .still .ing { opacity: .9; }
      .still .ing.i1 { transform: translate(-12px, -14px); }
      .still .ing.i2 { transform: translate(-1px, -14px); }
      .still .ing.i3 { transform: translate(11px, -14px); }
      .chip.clock.low { animation: none; }
      .progress-fill, .liquid, .vial { transition: none; }
    }
  `];

  // ─── Public API (sözleşme) ───────────────────────────────────────────────
  @property({ type: String }) mode: 'levels' | 'random' = 'levels';
  @property({ type: Number }) levelCount = 10;
  @property({ attribute: false }) state: GameState | null = null;
  @property({ type: Boolean }) muted = false;
  @property({ type: Number }) seed?: number;
  /** Host sayfanın teması. Dahili açık/koyu paleti değiştirir; host'un verdiği
   *  --og-* değişkenleri yine de önceliklidir. */
  @property({ type: String, reflect: true }) theme: 'dark' | 'light' = 'dark';

  // ─── Internal state ──────────────────────────────────────────────────────
  @state() private _phase: Phase = 'idle';
  @state() private _round: Round = { numbers: [], target: 0, solution: [], timeLimitMs: FREE_MODE_TIME_MS };
  @state() private _cards: Card[] = [];
  @state() private _history: Move[] = [];
  @state() private _selected: Card | null = null;
  @state() private _op: Op | null = null;
  @state() private _remainingMs = 0;
  @state() private _currentLevel = 1;
  @state() private _notice: MessageKey | null = null;
  @state() private _shaking = false;
  @state() private _flash = false;
  @state() private _outcome: Outcome | null = null;
  @state() private _announce = '';

  private _initialCards: Card[] = [];
  private _completedLevels: LevelResult[] = [];
  private _bestTimes: Record<number, number> = {};
  private _bestScores: Record<number, number> = {};
  private _totalPlayMs = 0;

  private _nextCardId = 1;
  private _deadline = 0;
  private _focusResult = false;
  private _rafId = 0;
  private _shakeTimeout = 0;
  private _noticeTimeout = 0;
  private _finishTimer = 0;
  private _flashTimeout = 0;
  private _ctx: AudioContext | null = null;
  private _settings = new SettingsMenuController(this);

  private get _levelKey(): number {
    return this.mode === 'random' ? 0 : this._currentLevel;
  }

  private get _elapsedMs(): number {
    return this._round.timeLimitMs - this._remainingMs;
  }

  /** Sahnedeki kartlar arasında hedefe en yakın olan. */
  private get _closest(): number {
    let best = this._cards.length ? this._cards[0].value : 0;
    for (const card of this._cards) {
      if (Math.abs(card.value - this._round.target) < Math.abs(best - this._round.target)) {
        best = card.value;
      }
    }
    return best;
  }

  private _onVisibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(this._rafId);
    } else if (this._phase === 'playing') {
      // Sekme arka plandayken sayaç durur: dönüşte bitiş anı, kalan süre kadar
      // ileri taşınır (kök README §4).
      this._deadline = performance.now() + this._remainingMs;
      this._tick();
    }
  };

  /**
   * Fiziksel klavye desteği. Bileşenin kendi düğmelerine odaklanılmış olması
   * şart değil; oyuncu sayfanın herhangi bir yerindeyken kısayolu kullanabilsin
   * diye dinleyici `window` üzerinde durur. Host sayfadaki bir form alanına
   * yazı yazılıyorsa tuş yutulmaz.
   */
  private _onWindowKey = (e: KeyboardEvent) => {
    if (this._phase !== 'playing') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const target = e.composedPath()[0] as HTMLElement | undefined;
    if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;

    const key = e.key;

    if (/^[1-9]$/.test(key)) {
      const card = this._cards[Number(key) - 1];
      if (!card) return;
      e.preventDefault();
      this._pickCard(card);
      return;
    }

    const op = ({ '+': '+', '-': '-', '−': '-', '*': '*', 'x': '*', 'X': '*', '×': '*', '/': '/', ':': '/', '÷': '/' } as Record<string, Op>)[key];
    if (op) {
      e.preventDefault();
      this._pickOp(op);
      return;
    }

    if (key === 'Backspace') {
      e.preventDefault();
      this._undo();
    } else if (key === 'Enter') {
      e.preventDefault();
      this._finish('manual');
    } else if (key === 'Escape') {
      e.preventDefault();
      this._clearSelection();
    }
  };

  // ─── Lifecycle ───────────────────────────────────────────────────────────
  connectedCallback() {
    super.connectedCallback();
    if (this.state) {
      this._currentLevel = this.mode === 'levels' ? this.state.currentLevel : 1;
      this._completedLevels = [...this.state.completedLevels];
      this._bestTimes = { ...this.state.bestTimes };
      this._bestScores = { ...(this.state.bestScores ?? {}) };
      this._totalPlayMs = this.state.totalPlayMs;
    }
    document.addEventListener('visibilitychange', this._onVisibility);
    window.addEventListener('keydown', this._onWindowKey);
    this._dispatch('og-ready', { gameId: GAME_ID });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    cancelAnimationFrame(this._rafId);
    clearTimeout(this._shakeTimeout);
    clearTimeout(this._noticeTimeout);
    clearTimeout(this._finishTimer);
    clearTimeout(this._flashTimeout);
    document.removeEventListener('visibilitychange', this._onVisibility);
    window.removeEventListener('keydown', this._onWindowKey);
  }

  updated() {
    // Tur bitince basılan kart DOM'dan kalkar; klavyeyle oynayanın odağı
    // boşlukta kalmasın diye sonuç panelinin düğmesine taşınır.
    if (this._focusResult) {
      this._focusResult = false;
      this.renderRoot?.querySelector<HTMLButtonElement>('.result button')?.focus();
    }
  }

  // ─── Oyun akışı ──────────────────────────────────────────────────────────

  /** A. Tur başlatma: yeni bir çözülebilir formül üretilir, sayaç kurulur. */
  private _startLevel = () => {
    cancelAnimationFrame(this._rafId);
    clearTimeout(this._finishTimer);

    const rngSeed = this.seed != null
      ? this.seed + (this.mode === 'levels' ? this._currentLevel : this._completedLevels.length)
      : undefined;
    const rng = rngSeed != null ? mulberry32(rngSeed) : Math.random;

    // Serbest modda zorluk eğrisi yoktur; her tur bağımsız olduğu için orta
    // banttan sabit üretilir ve süre değişmez.
    const difficulty = this.mode === 'levels'
      ? difficultyFor(this._currentLevel, this.levelCount)
      : RANDOM_MODE_DIFFICULTY;
    const limit = this.mode === 'levels' ? timeLimitFor(difficulty) : FREE_MODE_TIME_MS;

    this._round = generateRound(rng, difficulty, limit);
    this._nextCardId = 1;
    this._initialCards = this._round.numbers.map((value) => ({
      id: this._nextCardId++,
      value,
      derived: false,
    }));
    this._cards = [...this._initialCards];
    this._history = [];
    this._selected = null;
    this._op = null;
    this._notice = null;
    this._outcome = null;
    this._shaking = false;
    this._remainingMs = this._round.timeLimitMs;
    this._deadline = performance.now() + this._round.timeLimitMs;
    this._announce = this.t('octanum.announceRound', {
      target: this._round.target,
      numbers: this._round.numbers.join(', '),
    });
    this._phase = 'playing';
    this._tick();

    this._dispatch('og-level-start', {
      gameId: GAME_ID,
      level: this._currentLevel,
      startedAt: new Date().toISOString(),
    });
  };

  private _tick() {
    this._rafId = requestAnimationFrame(() => {
      if (this._phase !== 'playing') return;
      const left = this._deadline - performance.now();
      this._remainingMs = left > 0 ? left : 0;
      if (left <= 0) {
        this._finish('time-up');
        return;
      }
      this._tick();
    });
  }

  /** B. Bileşen seçimi. */
  private _pickCard(card: Card) {
    if (this._phase !== 'playing') return;

    if (this._selected === null) {
      this._selected = card;
      return;
    }
    if (this._selected === card) {
      this._selected = null; // aynı şişeye ikinci dokunuş seçimi bırakır
      return;
    }
    if (this._op === null) {
      this._selected = card; // henüz kazan seçilmedi: fikir değiştirildi say
      return;
    }
    this._applyMove(this._selected, this._op, card);
  }

  private _pickOp(op: Op) {
    if (this._phase !== 'playing') return;
    this._op = this._op === op ? null : op;
    this._notice = null;
  }

  private _clearSelection() {
    this._selected = null;
    this._op = null;
    this._notice = null;
  }

  /** C. Karışım: iki bileşen sahneden kalkar, sonuçları yerlerine geçer. */
  private _applyMove(a: Card, op: Op, b: Card) {
    const value = combine(a.value, op, b.value);
    if (value === null) {
      // Kurala takılan birleşim: kartlar zaten pasifleştirilmiş olduğu için
      // buraya yalnızca klavye kısayolundan gelinir.
      this._rejectMove(op === '-' ? 'octanum.ruleNegative' : 'octanum.ruleFraction');
      return;
    }

    const indexA = this._cards.indexOf(a);
    const indexB = this._cards.indexOf(b);
    const result: Card = { id: this._nextCardId++, value, derived: true };

    const next = this._cards.filter((c) => c !== a && c !== b);
    next.splice(Math.min(indexA, indexB), 0, result);

    this._cards = next;
    this._history = [...this._history, { a, b, op, result, indexA, indexB }];
    this._selected = null;
    this._op = null;
    this._notice = null;
    this._announce = this.t('octanum.announceMove', {
      a: a.value, op: OP_SYMBOL[op], b: b.value, r: value,
    });

    if (value === this._round.target) {
      this._playTone('exact');
      this._flashTarget();
      this._finish('exact');
    } else {
      this._playTone('mix');
    }
  }

  private _rejectMove(notice: MessageKey) {
    this._notice = notice;
    this._playTone('reject');
    this._shaking = true;
    clearTimeout(this._shakeTimeout);
    clearTimeout(this._noticeTimeout);
    this._shakeTimeout = window.setTimeout(() => { this._shaking = false; }, 340);
    this._noticeTimeout = window.setTimeout(() => { this._notice = null; }, NOTICE_MS);
  }

  private _flashTarget() {
    this._flash = true;
    clearTimeout(this._flashTimeout);
    this._flashTimeout = window.setTimeout(() => { this._flash = false; }, 620);
  }

  /** D. Geri al: son karışım bozulur, iki bileşen eski yerlerine döner. */
  private _undo = () => {
    if (this._phase !== 'playing' || this._history.length === 0) return;
    const move = this._history[this._history.length - 1];

    const next = this._cards.filter((c) => c !== move.result);
    // Küçük index önce yerleştirilir; aksi hâlde ikinci ekleme birinciyi kaydırır.
    const restore: [number, Card][] = move.indexA < move.indexB
      ? [[move.indexA, move.a], [move.indexB, move.b]]
      : [[move.indexB, move.b], [move.indexA, move.a]];
    for (const [index, card] of restore) next.splice(index, 0, card);

    this._cards = next;
    this._history = this._history.slice(0, -1);
    this._clearSelection();
    this._announce = this.t('octanum.announceUndo');
    this._playTone('undo');
  };

  /** E. Sıfırla: bölümün başındaki altı bileşene dönülür (süre devam eder). */
  private _reset = () => {
    if (this._phase !== 'playing' || this._history.length === 0) return;
    this._cards = [...this._initialCards];
    this._history = [];
    this._clearSelection();
    this._announce = this.t('octanum.announceReset');
    this._playTone('undo');
  };

  /**
   * F. Turu bitirme. Girdi anında kilitlenir (faz 'playing' olmaktan çıktığı
   * için hem şişeler hem klavye reddedilir); sonuç paneli, tam isabette
   * kutlama animasyonu bitene kadar ertelenir.
   */
  private _finish = (reason: EndReason = 'manual') => {
    if (this._phase !== 'playing') return;
    cancelAnimationFrame(this._rafId);
    clearTimeout(this._finishTimer);

    const reached = reason === 'exact' ? this._round.target : this._closest;
    const diff = Math.abs(reached - this._round.target);
    const exact = diff === 0;

    if (reason === 'time-up') {
      this._remainingMs = 0;
      this._announce = this.t('octanum.announceTimeUp');
      this._playTone('timeup');
    } else if (exact) {
      this._announce = this.t('octanum.announceExact');
    } else {
      this._announce = this.t('octanum.announceFinish', { value: reached, diff });
      this._playTone('finish');
    }

    this._phase = 'finishing';

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const delay = reduced || !exact ? 0 : EXACT_REVEAL_MS;
    this._finishTimer = window.setTimeout(() => this._settle(exact, reached, diff, reason), delay);
  };

  /** Tur sonucunu kayda geçirir, event'leri yayınlar ve state'i dışarı bildirir. */
  private _settle(exact: boolean, reached: number, diff: number, reason: EndReason) {
    const durationMs = Math.round(this._elapsedMs);
    const key = this._levelKey;
    const moves = this._history.length;
    const score = scoreFor(exact, diff, this._remainingMs);

    this._totalPlayMs += durationMs;

    // İlk oynanışta "rekor" yazmamak için önceki bir kayıt aranır.
    const priorScore = this._bestScores[key];
    const isBest = priorScore !== undefined && score > priorScore;
    if (priorScore === undefined || score > priorScore) this._bestScores[key] = score;

    this._outcome = { exact, reached, diff, reason, durationMs, score, isBest };

    if (exact) {
      // bestTimes yalnızca başarıyla tamamlanan turlarda güncellenir (§4).
      if (!this._bestTimes[key] || durationMs < this._bestTimes[key]) this._bestTimes[key] = durationMs;
      this._completedLevels.push({
        level: this._currentLevel,
        durationMs,
        completedAt: new Date().toISOString(),
        moves,
        score,
      });
      this._dispatch('og-level-complete', {
        gameId: GAME_ID,
        level: this._currentLevel,
        durationMs,
        moves,
        score,
        isBest,
      });
    } else {
      this._dispatch('og-level-fail', {
        gameId: GAME_ID,
        level: this._currentLevel,
        reason: reason === 'time-up' ? 'time-up' : 'inexact',
      });
    }

    const isGameComplete = exact && this.mode === 'levels' && this._currentLevel >= this.levelCount;
    // Tam isabet olmayan tur seviyeyi ilerletmez; oyuncu aynı seviyeyi yeni bir
    // formülle tekrar dener.
    const nextLevel = this.mode !== 'levels'
      ? 1
      : exact ? Math.min(this._currentLevel + 1, this.levelCount) : this._currentLevel;
    this._persistState(nextLevel);

    this._phase = 'done';
    this._focusResult = true;
    if (isGameComplete) this._dispatch('og-game-complete', { gameId: GAME_ID, totalMs: this._totalPlayMs });
  }

  private _persistState(nextLevel: number) {
    const newState: GameState = {
      version: 1,
      gameId: GAME_ID,
      currentLevel: nextLevel,
      completedLevels: this._completedLevels,
      bestTimes: this._bestTimes,
      bestScores: this._bestScores,
      totalPlayMs: this._totalPlayMs,
    };
    this._dispatch('og-state-change', { gameId: GAME_ID, state: newState });
  }

  private _next = () => {
    if (this._outcome?.exact && this.mode === 'levels') {
      const isLast = this._currentLevel >= this.levelCount;
      this._currentLevel = isLast ? 1 : this._currentLevel + 1;
    }
    this._startLevel();
  };

  private _toggleTheme = () => {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    this._dispatch('og-theme-change', { gameId: GAME_ID, theme: this.theme });
  };

  // ─── Audio (Web Audio API) ───────────────────────────────────────────────
  private _audioCtx() {
    if (!this._ctx) this._ctx = new AudioContext();
    if (this._ctx.state === 'suspended') this._ctx.resume().catch(() => {});
    return this._ctx;
  }

  private _playTone(kind: 'mix' | 'reject' | 'undo' | 'exact' | 'finish' | 'timeup') {
    if (this.muted) return;
    try {
      const ctx = this._audioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;

      if (kind === 'mix') {
        // Şişeye damlayan iksir: kısa, yükselen bir "blup".
        osc.frequency.setValueAtTime(420, now);
        osc.frequency.exponentialRampToValueAtTime(700, now + 0.09);
        gain.gain.setValueAtTime(0.07, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
        osc.start(); osc.stop(now + 0.13);
      } else if (kind === 'reject') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, now);
        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.start(); osc.stop(now + 0.18);
      } else if (kind === 'undo') {
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.11);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.start(); osc.stop(now + 0.15);
      } else if (kind === 'exact') {
        osc.frequency.setValueAtTime(540, now);
        osc.frequency.exponentialRampToValueAtTime(1180, now + 0.26);
        gain.gain.setValueAtTime(0.16, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.start(); osc.stop(now + 0.45);
      } else if (kind === 'finish') {
        osc.frequency.setValueAtTime(430, now);
        osc.frequency.exponentialRampToValueAtTime(320, now + 0.24);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(); osc.stop(now + 0.3);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.5);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
        osc.start(); osc.stop(now + 0.55);
      }
    } catch (_) { /* silently ignore */ }
  }

  // ─── Dispatch helper ─────────────────────────────────────────────────────
  private _dispatch(name: string, detail: Record<string, unknown>) {
    this.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true, detail }));
  }

  // ─── Render ──────────────────────────────────────────────────────────────
  /**
   * Dil, tema ve host sayfanın kendi düğmeleri (mod, ses) üst barda yan yana
   * durmak yerine sağ üstteki üç nokta düğmesinin altında toplanır. Açılış
   * ekranı ile HUD aynı bileşeni kullanır.
   */
  private _renderSettings() {
    return renderSettingsMenu({
      locale: this.locale,
      open: this._settings.open,
      onTrigger: this._settings.toggle,
      theme: this.theme,
      onThemeToggle: () => this._toggleTheme(),
    });
  }

  private _renderHUD() {
    const levelText = this.mode === 'levels'
      ? this.t('common.level', { level: this._currentLevel, total: this.levelCount })
      : this.t('common.freeMode');
    const low = this._remainingMs <= 10_000;
    return html`
      <div class="hud" part="hud">
        <div class="hud-group">
          <span class="chip">${levelText}</span>
          <span class="chip clock ${low ? 'low' : ''}" aria-label=${this.t('octanum.timeLabel')}>
            ⏳ ${formatClock(this._remainingMs)}
          </span>
        </div>
        <div class="hud-group">${this._renderSettings()}</div>
      </div>
    `;
  }

  private _renderProgress() {
    const pct = this._round.timeLimitMs
      ? Math.max(0, Math.round((this._remainingMs / this._round.timeLimitMs) * 100))
      : 0;
    return html`
      <div
        class="progress-track"
        role="progressbar"
        aria-valuenow=${pct}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-label=${this.t('octanum.timeLabel')}
      >
        <div class="progress-fill ${pct <= 15 ? 'low' : ''}" style="width:${pct}%"></div>
      </div>
    `;
  }

  private _renderTarget() {
    return html`
      <div class="target ${this._flash ? 'hit' : ''}" part="target">
        <svg class="cauldron" viewBox="0 0 48 48" aria-hidden="true">
          <!-- kazan gövdesi: kirişten aşağı sarkan yarım daire -->
          <path class="pot" d="M8,28 h32 a16,16 0 0 1 -32,0 z" />
          <ellipse class="brew" cx="24" cy="28" rx="15" ry="2.5" />
          <rect class="pot" x="5" y="23" width="38" height="4" rx="2" />
          <rect class="pot" x="19" y="43" width="10" height="3" rx="1.5" />
          <circle class="bubble" cx="18" cy="22" r="2.4" />
          <circle class="bubble" cx="25" cy="22" r="1.8" />
          <circle class="bubble" cx="31" cy="22" r="2.1" />
        </svg>
        <div class="target-text">
          <span class="target-label">${this.t('octanum.targetLabel')}</span>
          <span
            class="target-value"
            role="img"
            aria-label=${this.t('octanum.targetAria', { n: this._round.target })}
          >${this._round.target}</span>
        </div>
      </div>
    `;
  }

  /**
   * Bir kart, seçili işlemin ikinci operandı olarak kullanılamıyorsa
   * pasifleştirilir: oyuncu kuralı denemeden önce görür, "olmuyor" hissiyle
   * uğraşmaz.
   */
  private _isBlocked(card: Card): boolean {
    if (!this._selected || !this._op || card === this._selected) return false;
    return combine(this._selected.value, this._op, card.value) === null;
  }

  private _renderBoard() {
    return html`
      <div
        class="board ltr-lock ${this._shaking ? 'shake' : ''}"
        part="board"
        role="group"
        aria-label=${this.t('octanum.cardsAria')}
      >
        ${repeat(this._cards, (card) => card.id, (card) => {
          const selected = this._selected === card;
          const blocked = this._isBlocked(card);
          const label = this.t('octanum.cardAria', { value: card.value })
            + (selected ? this.t('octanum.cardAriaSelected') : '')
            + (blocked ? this.t('octanum.cardAriaBlocked') : '');
          return html`
            <button
              class="vial ${selected ? 'selected' : ''} ${card.derived ? 'derived' : ''}"
              part="card"
              type="button"
              style="--_fill-level:${liquidFill(card.value)}%"
              ?disabled=${blocked || this._phase !== 'playing'}
              aria-pressed=${selected.toString()}
              aria-label=${label}
              @click=${() => this._pickCard(card)}
            >
              <span class="liquid" aria-hidden="true"></span>
              <span class="value">${card.value}</span>
            </button>
          `;
        })}
      </div>
    `;
  }

  private _renderOps() {
    return html`
      <div class="ops" part="ops" role="group" aria-label=${this.t('octanum.opsAria')}>
        ${OPS.map(({ op, symbol, key }) => html`
          <button
            class="op ${this._op === op ? 'selected' : ''}"
            part="op"
            type="button"
            ?disabled=${this._phase !== 'playing'}
            aria-pressed=${(this._op === op).toString()}
            aria-label=${this.t(key)}
            title=${this.t(key)}
            @click=${() => this._pickOp(op)}
          >${symbol}</button>
        `)}
      </div>
    `;
  }

  /** Akış yönergesi; bir kural ihlali varsa onun yerine uyarı gösterilir. */
  private _renderHint() {
    if (this._notice) {
      return html`<p class="hint warn" part="hint" role="status">${this.t(this._notice)}</p>`;
    }
    const key: MessageKey = this._cards.length === 1
      ? 'octanum.hintLast'
      : !this._selected
        ? 'octanum.hintPickFirst'
        : !this._op
          ? 'octanum.hintPickOp'
          : 'octanum.hintPickSecond';
    return html`<p class="hint" part="hint">${this.t(key)}</p>`;
  }

  private _renderActions() {
    const idle = this._history.length === 0;
    const locked = this._phase !== 'playing';
    return html`
      <div class="actions" part="actions">
        <button
          class="btn"
          part="button"
          type="button"
          ?disabled=${idle || locked}
          aria-label=${this.t('octanum.undoAria')}
          @click=${this._undo}
        >↺ ${this.t('octanum.undo')}</button>
        <button
          class="btn"
          part="button"
          type="button"
          ?disabled=${idle || locked}
          aria-label=${this.t('octanum.resetAria')}
          @click=${this._reset}
        >⟲ ${this.t('octanum.reset')}</button>
        <button
          class="btn accent"
          part="button"
          type="button"
          ?disabled=${locked}
          aria-label=${this.t('octanum.finishAria')}
          @click=${() => this._finish('manual')}
        >✦ ${this.t('octanum.finish')}</button>
      </div>
    `;
  }

  private _renderLog() {
    return html`
      <div class="log" part="log">
        <h3>${this.t('octanum.stepsTitle')}</h3>
        ${this._history.length === 0
          ? html`<p class="empty">${this.t('octanum.stepsEmpty')}</p>`
          : html`
              <ol class="ltr-lock" aria-label=${this.t('octanum.stepsTitle')}>
                ${this._history.map((m) => html`
                  <li>${m.a.value} ${OP_SYMBOL[m.op]} ${m.b.value} <span class="eq">= ${m.result.value}</span></li>
                `)}
              </ol>
            `}
      </div>
    `;
  }

  /** Üretim aşamasında doğrulanan çözüm — tur sonunda perde arkası gösterilir. */
  private _renderSolution(solution: readonly SolutionStep[]) {
    if (solution.length === 0) return nothing;
    return html`
      <div class="solution ltr-lock">
        <b>${this.t('octanum.solutionLabel')}</b>
        ${solution.map((s) => html`
          <code>${s.a} ${OP_SYMBOL[s.op]} ${s.b} = ${s.result}</code><br />
        `)}
      </div>
    `;
  }

  private _renderResult() {
    const outcome = this._outcome;
    if (!outcome) return nothing;

    const isGameComplete = outcome.exact && this.mode === 'levels' && this._currentLevel >= this.levelCount;
    const titleKey: MessageKey = isGameComplete
      ? 'octanum.allDone'
      : outcome.exact
        ? 'octanum.exact'
        : outcome.reason === 'time-up'
          ? 'octanum.timeUp'
          : outcome.diff <= 5
            ? 'octanum.near'
            : 'octanum.far';
    const emoji = isGameComplete ? '🏆' : outcome.exact ? '⚗️' : outcome.reason === 'time-up' ? '⏳' : '💨';
    const label = !outcome.exact
      ? this.t('octanum.retry')
      : isGameComplete
        ? this.t('common.playAgain')
        : this.mode === 'random'
          ? `${this.t('octanum.nextFormula')} ${this.arrow}`
          : `${this.t('octanum.nextLevel')} ${this.arrow}`;

    return html`
      <div class="modal-backdrop">
        <div
          class="result"
          part="result"
          role="dialog"
          aria-modal="true"
          aria-label=${this.t('octanum.resultAria')}
        >
          <div class="emoji">${emoji}</div>
          <h2>${this.t(titleKey)}</h2>
          <div class="stats-row">
            <div class="stat-card ${outcome.isBest ? 'is-best' : ''}">
              <span class="stat-icon">⭐</span>
              <span class="stat-value">${outcome.score}</span>
              <span class="stat-label">${this.t('octanum.score')}</span>
            </div>
            <div class="stat-card">
              <span class="stat-icon">🎯</span>
              <span class="stat-value">${outcome.reached}</span>
              <span class="stat-label">${this.t('octanum.reached')}</span>
            </div>
            ${outcome.exact
              ? html`
                  <div class="stat-card">
                    <span class="stat-icon">⏱️</span>
                    <span class="stat-value">${formatClock(outcome.durationMs)}</span>
                    <span class="stat-label">${this.t('common.time')}</span>
                  </div>
                `
              : html`
                  <div class="stat-card">
                    <span class="stat-icon">📏</span>
                    <span class="stat-value">${outcome.diff}</span>
                    <span class="stat-label">${this.t('octanum.diffLabel')}</span>
                  </div>
                `}
          </div>
          ${outcome.isBest ? html`<div class="best-badge">🌟 ${this.t('common.newRecord')}</div>` : nothing}
          ${outcome.exact ? nothing : this._renderSolution(this._round.solution)}
          <button class="btn-primary" part="button" @click=${this._next} aria-label=${label}>${label}</button>
        </div>
      </div>
    `;
  }

  /**
   * Açılış amblemi: ağzından içeri rakam düşen bir imbik. Oyunun kendi çizim
   * dilinden gelir, yani
   * tema renklerini alır ve her platformda aynı görünür.
   */
  private _renderStill() {
    return html`
      <svg class="still" viewBox="0 0 110 126" role="img" aria-label=${this.t('octanum.idleFigureAria')}>
        <defs>
          <!-- Gövde kırpması: dalga ve kabarcıklar camın dışına taşmaz. -->
          <clipPath id="og-flask">
            <path d="M45,24 V56 L26,104 H84 L65,56 V24 Z" />
          </clipPath>
        </defs>

        <ellipse class="halo" cx="55" cy="86" rx="30" ry="22" />

        <!-- Ağzın üstünden içeri düşen bileşenler; camdan önce çizilir ki
             ağız halkasının arkasına girip kaybolsunlar. -->
        <text class="ing i1" x="49" y="26">7</text>
        <text class="ing i2" x="56" y="26">×</text>
        <text class="ing i3" x="62" y="26">3</text>

        <path class="glass" d="M45,24 V56 L26,104 H84 L65,56 V24 Z" />
        <g clip-path="url(#og-flask)">
          <!-- Dalga 40 birimlik periyotla tekrarlar; tam bir periyot kayınca
               döngü dikişsiz kapanır. -->
          <path class="wave brew" d="M-10,80 q10,-5 20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 V112 H-10 Z" />
          <circle class="bub b1" cx="37" cy="101" r="2.2" />
          <circle class="bub b2" cx="71" cy="99" r="1.6" />
          <circle class="bub b3" cx="45" cy="103" r="1.9" />
        </g>
        <path class="edge" d="M45,24 V56 L26,104 H84 L65,56 V24 Z" />
        <path class="shine" d="M42,32 V56 L33,84" />
        <!-- Ölçek çizgileri: laboratuvar kabı olduğunu tek bakışta anlatır. -->
        <path class="ticks" d="M58,34 H64 M58,41 H64 M58,48 H64" />
        <ellipse class="mouth" cx="55" cy="24" rx="11" ry="3.2" />

        <!-- Ocak ateşi. Alevlerin ucu tabandan önce çizilir; böylece uçları
             taban plakasının arkasında kalır ve ateş kabı yalıyor gibi durur. -->
        <ellipse class="fire-glow" cx="55" cy="115" rx="22" ry="9" />
        <path class="flame f2" d="M41.5,109 Q42.5,114 45,116.5 Q47,118.7 46.4,120.7 Q45.2,123.5 42,123.5 Q38.8,123.5 37.6,120.7 Q37,118.7 39,116.5 Q41,114 41.5,109 Z" />
        <path class="flame f3" d="M68.5,109 Q67.5,114 65,116.5 Q63,118.7 63.6,120.7 Q64.8,123.5 68,123.5 Q71.2,123.5 72.4,120.7 Q73,118.7 71,116.5 Q69,114 68.5,109 Z" />
        <path class="flame f1" d="M57,101 Q56,109 60.5,113.5 Q64,117 63,120 Q61,124.5 55,124.5 Q49,124.5 47,120 Q46,117 49,113 Q54,108 57,101 Z" />
        <path class="flame core" d="M56,111 Q55.5,115.5 57.6,117.8 Q59.4,119.8 58.6,121.5 Q57.4,123.4 55,123.4 Q52.6,123.4 51.4,121.5 Q50.6,119.8 52.4,117.8 Q54.6,115.5 56,111 Z" />
        <rect class="base" x="27" y="103" width="56" height="5" rx="2.5" />
      </svg>
    `;
  }

  private _renderIdle() {
    return html`
      <div class="overlay-top">${this._renderSettings()}</div>
      <div class="overlay">
        ${this._renderStill()}
        <h2>${this.t('octanum.title')}</h2>
        <p>${this.t('octanum.tagline')}</p>
        <p style="opacity:.6;font-size:.8rem">${this.t('octanum.taglineSub')}</p>
        <button
          class="btn-primary"
          part="button"
          @click=${this._startLevel}
          aria-label=${this.t('common.startAria')}
        >${this.t('common.start')}</button>
      </div>
    `;
  }

  render() {
    if (this._phase === 'idle') return this._renderIdle();
    return html`
      ${this._renderHUD()}
      ${this._renderProgress()}
      ${this._renderTarget()}
      ${this._renderBoard()}
      ${this._renderOps()}
      ${this._renderHint()}
      ${this._renderActions()}
      ${this._renderLog()}
      ${this._phase === 'done' ? this._renderResult() : nothing}
      <div class="sr-only" aria-live="polite">${this._announce}</div>
    `;
  }
}
