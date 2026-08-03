import { LitElement, html, svg, css, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import {
  GameState,
  LevelResult,
  Localized,
  i18nStyles,
  renderLanguagePicker,
  type MessageKey,
} from '@octapull-games/core';
import { getWordPool } from './words';
import type { Tier, WordEntry, WordPool } from './words';

// ─── Constants ──────────────────────────────────────────────────────────────

const GAME_ID = 'game-octahang';
const MAX_MISTAKES = 6; // kafa, gövde, iki kol, iki bacak
/**
 * Tekrar etmemesi için state.extra içinde saklanan son kelime sayısı. En küçük
 * katmandaki kelime sayısının altında tutulur; aksi halde bir katman tümüyle
 * "kullanılmış" duruma düşer ve seçim sürekli yedek dallara sapar. Havuz
 * büyüdükçe bu sınır da yükseltilebilir — testler ikisi arasındaki payı korur.
 */
export const USED_WORD_MEMORY = 60;
/** Sonuç paneli açılmadan önce son animasyonun oynaması için beklenen süre. */
const WIN_REVEAL_MS = 520; // son harfler yerine otururken
const LOSS_REVEAL_MS = 780; // son uzuv çizilirken

type Phase = 'idle' | 'playing' | 'finishing' | 'won' | 'lost';

/** İpucu kutusundaki zorluk rozetinin çeviri anahtarları. */
const TIER_KEYS: Record<Tier, MessageKey> = {
  1: 'octahang.tier1',
  2: 'octahang.tier2',
  3: 'octahang.tier3',
  4: 'octahang.tier4',
};

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
 * Türkçeye duyarlı büyük harf dönüşümü. JavaScript'in varsayılan
 * `toUpperCase()` metodu 'i' harfini 'I' yapar; Türkçede doğrusu 'İ'dir.
 * ('ı' → 'I' dönüşümünü motor zaten doğru yapar, ama açıkça yazmak niyeti
 * belli eder ve locale ayarından bağımsız kılar.)
 */
export const trUpper: (input: string) => string = getWordPool('tr').normalize;

/**
 * Tekrar önleme belleğini havuzun boyuna uydurur. Sabit 60'ta kalsaydı, katman
 * başına 12 kelimelik daha küçük dil havuzlarında bir katman tümüyle
 * "kullanılmış" duruma düşer ve seçim sürekli yedek dallara saparak zorluk
 * eğrisini bozardı. Sınır, en küçük katmanın bir altında tutulur.
 */
function usedMemoryFor(pool: WordPool): number {
  const perTier = ([1, 2, 3, 4] as Tier[])
    .map((t) => pool.words.filter((e) => e.tier === t).length)
    .filter((n) => n > 0);
  const smallest = perTier.length ? Math.min(...perTier) : 0;
  return Math.max(1, Math.min(USED_WORD_MEMORY, smallest - 1));
}

/**
 * Zorluk katmanı: seviyeler dörde bölünür, yani oyun kolaydan zora doğru
 * ilerler. İlk çeyrek ısınma turudur (tanıdık, somut sözcükler), son çeyrekte
 * edebî ve bilimsel terimlere çıkılır.
 */
function tierForLevel(level: number, levelCount: number): Tier {
  const t = Math.min((level - 1) / Math.max(levelCount - 1, 1), 1);
  return t < 0.25 ? 1 : t < 0.5 ? 2 : t < 0.75 ? 3 : 4;
}

/**
 * Havuzdan kelime seçer. Önce istenen katmandaki, daha önce çıkmamış adaylar
 * denenir; tükenirse komşu katmanlara (önce bir üste, sonra aşağı doğru)
 * bakılır; en son çare olarak "kullanılmış" filtresi kaldırılır. Böylece havuz
 * tükendiğinde bile oyun daima bir kelime bulur.
 */
function pickWord(
  rand: () => number,
  tier: Tier,
  used: ReadonlySet<string>,
  words: readonly WordEntry[],
): WordEntry {
  // İstenen katman başta; kalanlar ona olan uzaklığa göre, eşitlikte zor olan
  // önce gelecek biçimde sıralanır.
  const order = ([1, 2, 3, 4] as Tier[]).sort((a, b) => {
    const da = Math.abs(a - tier), db = Math.abs(b - tier);
    return da === db ? b - a : da - db;
  });

  for (const t of order) {
    const fresh = words.filter((e) => e.tier === t && !used.has(e.word));
    if (fresh.length) return fresh[(rand() * fresh.length) | 0];
  }
  for (const t of order) {
    const any = words.filter((e) => e.tier === t);
    if (any.length) return any[(rand() * any.length) | 0];
  }
  return words[(rand() * words.length) | 0];
}

/**
 * Klavye satırları: alfabe, alfabetik sırayı bozmadan üç dengeli satıra
 * bölünür (Türkçede 29 harf → 10-10-9, İngilizcede 26 → 9-9-8, İtalyancada
 * 21 → 7-7-7). Harfleri aramak sıraya bağlı olduğu için bölme noktaları
 * daima baştan sona ilerler; satır uzunlukları birbirine yakın kaldığından
 * klavye her dilde dengeli bir blok hâlinde durur.
 */
function keyboardRows(alphabet: string): string[][] {
  const letters = [...alphabet];
  const perRow = Math.ceil(letters.length / 3);
  return [
    letters.slice(0, perRow),
    letters.slice(perRow, perRow * 2),
    letters.slice(perRow * 2),
  ].filter((row) => row.length > 0);
}

/** Kelimedeki benzersiz harfler (ilerleme çubuğu ve kazanma kontrolü için). */
function uniqueLetters(word: string): string[] {
  return [...new Set(word.split(''))];
}

// ─── Component ──────────────────────────────────────────────────────────────

export class OctahangGame extends Localized(LitElement) {
  static styles = [i18nStyles, css`
    *, *::before, *::after { box-sizing: border-box; }

    :host {
      /* Dahili tema paleti. Host sayfanın verdiği --og-* değişkenleri daima
         kazanır; buradakiler yalnızca sıfır ayarla doğru görünmeyi sağlayan
         temaya duyarlı varsayılanlardır. */
      /* Midnight Slate — yumuşak koyu lacivert, saf siyah yok. */
      --_bg: #1e293b;
      --_surface: #0f172a;
      --_text: #f8fafc;
      --_text-dim: #94a3b8;
      --_border: #334155;
      --_shadow: 0 20px 25px -5px rgba(0,0,0,.4), 0 8px 10px -6px rgba(0,0,0,.3);
      --_line: rgba(255,255,255,.12);
      --_fill: rgba(255,255,255,.07);
      --_fill-soft: rgba(255,255,255,.035);
      --_fill-strong: rgba(255,255,255,.11);
      --_gallows: #64748b;

      /* Vurgu renkleri iki temada da ortak (Octapull turuncusu + safir). */
      --_primary: #3b82f6;
      --_accent: #ff5b00;
      --_ok: #22c55e;
      --_bad: #ef4444;

      display: block;
      position: relative;
      font-family: var(--og-font, system-ui, -apple-system, sans-serif);
      background: var(--og-bg, var(--_bg));
      color: var(--og-text, var(--_text));
      /* Yüzde, kapsayıcının genişliğine göre çözülür: geniş kartta içerik
         kenarlara yapışmaz, 320 px'lik ekranda ise alt sınıra düşerek yeri
         israf etmez. Alt sınır, köşedeki tuşların yuvarlatılmış çerçeveye
         değmemesi için border-radius'un (16 px) üzerinde tutulur. */
      padding: clamp(1.25rem, 5%, 2.1rem);
      border: 1px solid var(--_border);
      border-radius: var(--og-radius, 16px);
      box-shadow: var(--_shadow);
      min-width: 280px;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
    }

    /* Soft Modern Light — sıcak kırık beyaz zemin. */
    :host([theme='light']) {
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
      --_gallows: #94a3b8;
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
    .chip.lives { color: inherit; }
    .chip.lives.low { color: var(--_bad); }

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
      background: var(--_fill);
      overflow: hidden;
      margin-bottom: .85rem;
    }
    .progress-fill {
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, var(--og-accent, var(--_accent)), var(--og-primary, var(--_primary)));
      transition: width .25s ease;
    }

    /* ── 1. Bölge: ipucu ── */
    .hint {
      display: flex;
      align-items: center;
      gap: .55rem;
      padding: .75rem .95rem;
      margin-bottom: .9rem;
      border-radius: calc(var(--og-radius, 16px) * .7);
      background: var(--og-surface, var(--_surface));
      border: 1px solid var(--_line);
      font-size: .9rem;
      line-height: 1.35;
    }
    .hint .icon { font-size: 1.05rem; line-height: 1; flex: none; }
    .hint .text { flex: 1; min-width: 0; }
    .hint .label {
      font-weight: 700;
      color: var(--og-accent, var(--_accent));
      margin-right: .2rem;
    }
    /* Kelimenin hangi zorluk katmanından geldiğini gösterir; oyuncu neyle
       karşı karşıya olduğunu bilsin diye ipucunun yanında durur. */
    .tier-badge {
      flex: none;
      align-self: flex-start;
      font-size: .6rem;
      font-weight: 800;
      letter-spacing: .06em;
      text-transform: uppercase;
      padding: .25rem .45rem;
      border-radius: 999px;
      border: 1px solid currentColor;
      opacity: .8;
      white-space: nowrap;
    }
    .tier-badge.t1 { color: var(--_ok); }
    .tier-badge.t2 { color: var(--og-primary, var(--_primary)); }
    .tier-badge.t3 { color: var(--og-accent, var(--_accent)); }
    .tier-badge.t4 { color: var(--_bad); }

    /* ── 2. Bölge: darağacı ── */
    .stage { display: flex; justify-content: center; margin-bottom: .5rem; }
    .stage svg {
      width: 100%;
      /* Kartla birlikte büyür ama bir yerde durur: daha büyüğü kartı gereksiz
         uzatır, modal içine sığmaz. */
      max-width: 270px;
      height: auto;
      overflow: visible;
    }
    .stage.shake svg { animation: shake .34s ease; }
    @keyframes shake {
      10%, 90% { transform: translateX(-2px); }
      20%, 80% { transform: translateX(3px); }
      30%, 50%, 70% { transform: translateX(-5px); }
      40%, 60% { transform: translateX(5px); }
    }

    .gallows {
      fill: none;
      stroke: var(--og-octahang-gallows, var(--_gallows));
      stroke-width: 6;
      stroke-linecap: round;
    }
    .rope {
      fill: none;
      stroke: var(--og-octahang-gallows, var(--_gallows));
      stroke-width: 3;
      stroke-linecap: round;
    }
    .limb {
      fill: none;
      stroke: var(--og-octahang-figure, var(--og-accent, var(--_accent)));
      stroke-width: 5;
      stroke-linecap: round;
      stroke-dasharray: 1;
      stroke-dashoffset: 1;
      animation: draw .42s ease forwards;
    }
    @keyframes draw { to { stroke-dashoffset: 0; } }

    /* ── 3. Bölge: kelime çizgileri ── */
    .word {
      container-type: inline-size;
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: .35rem .4rem;
      margin: .5rem 0 1.1rem;
      min-height: 2.8rem;
    }
    .slot {
      display: flex;
      align-items: flex-end;
      justify-content: center;
      width: clamp(1.15rem, 7cqi, 2.4rem);
      height: 2.5rem;
      padding-bottom: .12rem;
      border-bottom: 3px solid var(--_line);
      font-size: clamp(.95rem, 5.4cqi, 1.8rem);
      font-weight: 800;
      line-height: 1;
      letter-spacing: 0;
    }
    .slot.filled {
      border-bottom-color: var(--og-accent, var(--_accent));
      animation: rise .22s cubic-bezier(.34,1.56,.64,1);
    }
    .slot.missed { color: var(--_bad); border-bottom-color: var(--_bad); }
    @keyframes rise {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* ── 4. Bölge: sanal klavye ── */
    /* Alfabe sabit üç satıra bölünür (10-10-9). Tek bir auto-fit ızgarada
       satır başına 13 tuş sıkışıyor, kalan harfler de son satırda sola yaslı
       kalıp simetriyi bozuyordu. Tuş genişliği en uzun satıra (10 tuş) göre
       hesaplanır: 9 tuşlu son satır aynı boyda kalır, yalnızca ortalanır.
       max-width geniş kartta tuşların şişmesini önler; alt sınır ise düzeni
       telefonda da üç satır hâlinde tutacak kadar küçük (asıl dokunma alanını
       min-height verir). Bu sınırın da altına inen aşırı dar kartlarda satır
       kendiliğinden alta sarar ve ortalı kalır. */
    .keyboard {
      --_kb-gap: .4rem;
      display: flex;
      flex-direction: column;
      gap: var(--_kb-gap);
    }
    .kb-row {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: var(--_kb-gap);
    }
    .key {
      /* Tuş genişliği en uzun satıra göre hesaplanır; sütun sayısı dile göre
         değiştiği için (TR 10, EN 9, IT 7 …) satır çizilirken inline verilir. */
      flex: 0 1 calc((100% - (var(--_kb-cols, 10) - 1) * var(--_kb-gap)) / var(--_kb-cols, 10));
      min-width: 1.35rem;
      max-width: 3rem;
      cursor: pointer;
      aspect-ratio: 1 / 1.05;
      min-height: 2.2rem;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      border: 1px solid var(--_line);
      border-radius: 8px;
      background: var(--_fill-soft);
      color: inherit;
      font-family: inherit;
      font-size: 1rem;
      font-weight: 700;
      line-height: 1;
      transition: background .12s, transform .12s, border-color .12s, opacity .12s;
    }
    .key:hover:not(:disabled) { background: var(--_fill-strong); }
    .key:active:not(:disabled) { transform: scale(.93); }
    .key:focus-visible { outline: 3px solid var(--og-accent, var(--_accent)); outline-offset: 2px; }
    .key:disabled { cursor: default; }
    .key.hit {
      background: color-mix(in srgb, var(--_ok) 26%, transparent);
      border-color: var(--_ok);
      color: var(--_ok);
    }
    .key.miss {
      background: color-mix(in srgb, var(--_bad) 20%, transparent);
      border-color: color-mix(in srgb, var(--_bad) 55%, transparent);
      color: var(--_bad);
      opacity: .65;
    }
    /* Telefonda satır aralığını ve yazıyı kısarak on tuşun yan yana kalmasını
       sağlar; sarma, ancak bundan da dar bir kartta devreye girer. */
    @media (max-width: 480px) {
      .keyboard { --_kb-gap: .28rem; }
      .key { font-size: .9rem; border-radius: 7px; }
    }

    /* ── Sonuç paneli ── */
    /* Bileşenin kendi kutusunun ortasında açılır (position: absolute, fixed
       değil): host bir modalın içine gömüldüğünde dışarı taşan ikinci bir
       tam-ekran katman oluşmaz. Altta kalan klavye yerinde durduğu için de
       düzen zıplamaz. */
    .modal-backdrop {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.25rem;
      border-radius: inherit;
      background: rgba(4, 10, 20, .55);
      backdrop-filter: blur(3px);
      z-index: 5;
      animation: fadeIn .25s ease;
    }
    :host([theme='light']) .modal-backdrop { background: rgba(15, 23, 42, .35); }

    .result {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: .85rem;
      width: 100%;
      max-width: 360px;
      max-height: 100%;
      overflow-y: auto;
      padding: 1.5rem 1.25rem;
      border-radius: calc(var(--og-radius, 16px) * 1.1);
      background: var(--og-bg, var(--_bg));
      border: 1px solid var(--_border);
      box-shadow: var(--_shadow);
      text-align: center;
      animation: popIn .3s cubic-bezier(.34,1.56,.64,1) both;
    }
    .result h2 { margin: 0; font-size: 1.35rem; font-weight: 800; }
    .result .emoji { font-size: 2.4rem; line-height: 1; }
    .result .answer { font-size: .9rem; color: var(--_text-dim); }
    .result .answer b { color: var(--og-text, var(--_text)); letter-spacing: .06em; }
    @keyframes popIn {
      from { opacity: 0; transform: scale(.9) translateY(8px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }

    .stats-row { display: flex; gap: .6rem; flex-wrap: wrap; justify-content: center; }
    .stat-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: .1rem;
      min-width: 84px;
      padding: .6rem .8rem;
      border-radius: 14px;
      background: linear-gradient(160deg, var(--_fill-strong), var(--_fill-soft));
      border: 1px solid var(--_line);
    }
    .stat-card.is-best {
      border-color: var(--og-accent, var(--_accent));
      box-shadow: 0 0 0 1px var(--og-accent, var(--_accent));
    }
    .stat-icon { font-size: 1.15rem; line-height: 1; }
    .stat-value {
      font-size: 1.45rem;
      font-weight: 800;
      line-height: 1.1;
      font-variant-numeric: tabular-nums;
      background: linear-gradient(135deg, var(--og-accent, var(--_accent)), var(--og-primary, var(--_primary)));
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }
    .stat-label {
      font-size: .62rem;
      font-weight: 700;
      letter-spacing: .04em;
      text-transform: uppercase;
      color: var(--_text-dim);
    }
    .best-badge { font-size: .72rem; font-weight: 700; color: var(--og-accent, var(--_accent)); }

    /* ── Başlangıç ekranı ── */
    .overlay {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      padding: 1.8rem 1rem;
      text-align: center;
      animation: fadeIn .3s ease;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .overlay h2 { margin: 0; font-size: 1.5rem; font-weight: 800; }
    .overlay p { margin: 0; color: var(--_text-dim); font-size: .9rem; max-width: 34ch; line-height: 1.5; }
    .overlay-top { display: flex; justify-content: center; align-items: center; gap: .4rem; flex-wrap: wrap; }

    /* Açılış amblemi: oyunun kendi çizim dilinden küçültülmüş bir darağacı ve
       ipte sallanan çöp adam. Emoji yerine kendi SVG'miz olduğu için tema
       renklerini alır ve her platformda aynı görünür. */
    .idle-figure {
      width: 100%;
      max-width: 108px;
      height: auto;
      overflow: visible;
    }
    .idle-figure .swing {
      transform-box: view-box;
      transform-origin: 80px 10px; /* ipin kirişe bağlandığı nokta */
      animation: swing 3.6s ease-in-out infinite;
    }
    @keyframes swing {
      0%, 100% { transform: rotate(-3.5deg); }
      50% { transform: rotate(3.5deg); }
    }
    .idle-figure .body {
      fill: none;
      stroke: var(--og-octahang-figure, var(--og-accent, var(--_accent)));
      stroke-width: 4;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    /* Tahtadaki çizimden daha küçük bir viewBox olduğu için çizgiler inceltilir. */
    .idle-figure .gallows { stroke-width: 5; }
    .idle-figure .rope { stroke-width: 2.5; }

    button.btn-primary {
      cursor: pointer;
      border: none;
      border-radius: 10px;
      padding: .6rem 1.4rem;
      font-family: inherit;
      font-size: .9rem;
      font-weight: 600;
      /* Düz renk — degrade yok. Üç oyunda da aynı düğme dili kullanılır. */
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

    @media (prefers-reduced-motion: reduce) {
      .stage.shake svg { animation: none; }
      .limb { animation: none; stroke-dashoffset: 0; }
      .slot.filled, .result, .modal-backdrop, .overlay { animation: none; }
      .idle-figure .swing { animation: none; }
      .progress-fill { transition: none; }
      .key { transition: none; }
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
  @state() private _entry: WordEntry = getWordPool('tr').words[0];
  @state() private _guessed: string[] = [];
  @state() private _wrong = 0;
  @state() private _currentLevel = 1;
  @state() private _elapsed = 0; // ms
  @state() private _shaking = false;
  @state() private _announce = '';

  private _completedLevels: LevelResult[] = [];
  private _bestTimes: Record<number, number> = {};
  private _bestScores: Record<number, number> = {};
  private _totalPlayMs = 0;
  private _usedWords: string[] = [];

  private _finalMs = 0;
  private _lastScore = 0;
  private _lastIsBest = false;

  private _startTime = 0;
  private _focusResult = false;
  private _rafId = 0;
  private _shakeTimeout = 0;
  private _finishTimer = 0;
  private _ctx: AudioContext | null = null;

  private get _word(): string {
    return this._entry.word;
  }

  /** Seçili dilin alfabesi, kelime havuzu ve girdi normalizasyonu. */
  private get _pool(): WordPool {
    return getWordPool(this.locale);
  }

  private get _levelKey(): number {
    return this.mode === 'random' ? 0 : this._currentLevel;
  }

  private get _lives(): number {
    return MAX_MISTAKES - this._wrong;
  }

  private _onVisibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(this._rafId);
    } else if (this._phase === 'playing') {
      this._startTime = performance.now() - this._elapsed;
      this._tick();
    }
  };

  /**
   * Fiziksel klavye desteği. Bileşenin kendi düğmelerine odaklanılmış olması
   * şart değil; oyuncu sayfanın herhangi bir yerindeyken harfe basabilsin diye
   * dinleyici window üzerinde durur. Host sayfadaki bir form alanına yazı
   * yazılıyorsa tuş yutulmaz.
   */
  private _onWindowKey = (e: KeyboardEvent) => {
    if (this._phase !== 'playing') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const target = e.composedPath()[0] as HTMLElement | undefined;
    if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;

    const pool = this._pool;
    const letter = pool.normalize(e.key);
    if (letter.length !== 1 || !pool.alphabet.includes(letter)) return;
    if (this._guessed.includes(letter)) return;

    e.preventDefault();
    this._guess(letter);
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
      const used = this.state.extra?.usedWords;
      if (Array.isArray(used)) this._usedWords = used.filter((w): w is string => typeof w === 'string');
    }
    document.addEventListener('visibilitychange', this._onVisibility);
    window.addEventListener('keydown', this._onWindowKey);
    this._dispatch('og-ready', { gameId: GAME_ID });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    cancelAnimationFrame(this._rafId);
    clearTimeout(this._shakeTimeout);
    clearTimeout(this._finishTimer);
    document.removeEventListener('visibilitychange', this._onVisibility);
    window.removeEventListener('keydown', this._onWindowKey);
  }

  willUpdate(changed: Map<PropertyKey, unknown>) {
    super.willUpdate(changed);
    // Tur ortasında dil değişirse kelime eski havuzdan, klavye yeni alfabeden
    // gelir — Türkçe bir kelimeyi Arapça klavyeyle bulmak imkânsız olurdu.
    // Bu yüzden tur, yeni dilin havuzundan seçilen bir kelimeyle baştan başlar.
    // (changed.get eski değeri verir; ilk render'da undefined olur ve atlanır.)
    // render öncesinde çalışır, böylece kelime ve klavye aynı karede tazelenir.
    if (changed.has('locale') && changed.get('locale') !== undefined && this._phase === 'playing') {
      this._startLevel();
    }
  }

  updated() {
    // Tur bitince basılan harf düğmesi DOM'dan kalkar; klavyeyle oynayanın
    // odağı boşlukta kalmasın diye sonuç panelinin düğmesine taşınır.
    if (this._focusResult) {
      this._focusResult = false;
      this.renderRoot?.querySelector<HTMLButtonElement>('.result button')?.focus();
    }
  }

  // ─── Oyun akışı ──────────────────────────────────────────────────────────

  /** A. Oyunu başlatma: sayaçlar sıfırlanır, yeni kelime seçilir. */
  private _startLevel = () => {
    cancelAnimationFrame(this._rafId);
    clearTimeout(this._finishTimer);

    const rngSeed = this.seed != null
      ? this.seed + (this.mode === 'levels' ? this._currentLevel : this._completedLevels.length)
      : undefined;
    const rng = rngSeed != null ? mulberry32(rngSeed) : Math.random;
    // Serbest modda zorluk eğrisi yoktur; her tur bağımsız olduğu için orta-zor
    // banttan (2. ve 3. katman) seçilir.
    const tier: Tier = this.mode === 'levels'
      ? tierForLevel(this._currentLevel, this.levelCount)
      : rng() < 0.5 ? 2 : 3;

    this._entry = pickWord(rng, tier, new Set(this._usedWords), this._pool.words);
    // Her tur bomboş tahtayla başlar; hiçbir harf baştan açık gelmez.
    this._guessed = [];
    this._wrong = 0;
    this._elapsed = 0;
    this._finalMs = 0;
    this._shaking = false;
    this._announce = this.t('octahang.announceNewWord', {
      len: this._word.length,
      hint: this._entry.hint,
    });
    this._phase = 'playing';
    this._startTime = performance.now();
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
      this._elapsed = performance.now() - this._startTime;
      this._tick();
    });
  }

  /** B. Harf tahmini. */
  private _guess(letter: string) {
    if (this._phase !== 'playing') return;
    if (this._guessed.includes(letter)) return;

    this._guessed = [...this._guessed, letter];

    if (this._word.includes(letter)) {
      this._playTone('hit');
      const remaining = uniqueLetters(this._word).filter((c) => !this._guessed.includes(c));
      this._announce = this.t('octahang.announceCorrect', { letter, n: remaining.length });
      if (remaining.length === 0) this._finish(true);
      return;
    }

    this._wrong++;
    this._wallFeedback();
    this._playTone('miss');
    this._announce = this.t('octahang.announceWrong', { letter, n: this._lives });
    if (this._wrong >= MAX_MISTAKES) this._finish(false);
  }

  private _onKeyClick = (letter: string) => this._guess(letter);

  /**
   * Tur biter bitmez girdi kilitlenir (faz 'playing' olmaktan çıktığı için
   * hem sanal hem fiziksel klavye reddedilir); sonuç panelinin açılması son
   * animasyon (kazanınca harflerin oturması, kaybedince son uzvun çizilmesi)
   * bitene kadar ertelenir.
   */
  private _finish(won: boolean) {
    cancelAnimationFrame(this._rafId);
    clearTimeout(this._finishTimer);
    this._finalMs = Math.round(this._elapsed);
    this._phase = 'finishing';
    this._announce = won
      ? this.t('octahang.announceFound')
      : this.t('octahang.announceOutOfLives', { word: this._word });
    this._playTone(won ? 'win' : 'lose');

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const delay = reduced ? 0 : (won ? WIN_REVEAL_MS : LOSS_REVEAL_MS);
    this._finishTimer = window.setTimeout(() => this._settle(won), delay);
  }

  /** Tur sonucunu kayda geçirir, event'leri yayınlar ve state'i dışarı bildirir. */
  private _settle(won: boolean) {
    const durationMs = this._finalMs;
    const key = this._levelKey;
    this._totalPlayMs += durationMs;
    this._rememberWord(this._word);

    if (won) {
      const score = this._score(durationMs);
      const moves = this._guessed.length;
      // İlk oynanışta "rekor" yazmamak için önceki bir kayıt aranır.
      const priorScore = this._bestScores[key];
      const isBest = priorScore !== undefined && score > priorScore;
      if (priorScore === undefined || score > priorScore) this._bestScores[key] = score;
      if (!this._bestTimes[key] || durationMs < this._bestTimes[key]) this._bestTimes[key] = durationMs;
      this._lastScore = score;
      this._lastIsBest = isBest;

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
      this._lastScore = 0;
      this._lastIsBest = false;
      this._dispatch('og-level-fail', {
        gameId: GAME_ID,
        level: this._currentLevel,
        reason: 'out-of-lives',
      });
    }

    const isGameComplete = won && this.mode === 'levels' && this._currentLevel >= this.levelCount;
    // Kaybedilen tur seviyeyi ilerletmez; oyuncu aynı seviyeyi yeni bir
    // kelimeyle tekrar dener.
    const nextLevel = this.mode !== 'levels'
      ? 1
      : won ? Math.min(this._currentLevel + 1, this.levelCount) : this._currentLevel;
    this._persistState(nextLevel);

    this._phase = won ? 'won' : 'lost';
    this._focusResult = true;
    if (isGameComplete) this._dispatch('og-game-complete', { gameId: GAME_ID, totalMs: this._totalPlayMs });
  }

  /**
   * Tur puanı: zor kelime + uzun kelime + harcanmayan hak + hızlı çözüm
   * ödüllendirilir. Kaybedilen turda puan verilmez.
   */
  private _score(durationMs: number): number {
    const tierPoints = (this._entry.tier - 1) * 40;
    const lengthPoints = this._word.length * 10;
    const lifePoints = this._lives * 25;
    const timeBonus = Math.max(0, 120 - Math.floor(durationMs / 1000));
    return tierPoints + lengthPoints + lifePoints + timeBonus;
  }

  /** Aynı kelimenin yakın turlarda tekrar gelmemesi için son N kelime tutulur. */
  private _rememberWord(word: string) {
    const limit = usedMemoryFor(this._pool);
    this._usedWords = [...this._usedWords.filter((w) => w !== word), word].slice(-limit);
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
      extra: { usedWords: this._usedWords },
    };
    this._dispatch('og-state-change', { gameId: GAME_ID, state: newState });
  }

  private _next = () => {
    if (this._phase === 'won' && this.mode === 'levels') {
      const isLast = this._currentLevel >= this.levelCount;
      this._currentLevel = isLast ? 1 : this._currentLevel + 1;
    }
    this._startLevel();
  };

  private _wallFeedback() {
    this._shaking = true;
    clearTimeout(this._shakeTimeout);
    this._shakeTimeout = window.setTimeout(() => { this._shaking = false; }, 340);
  }

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

  private _playTone(kind: 'hit' | 'miss' | 'win' | 'lose') {
    if (this.muted) return;
    try {
      const ctx = this._audioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      if (kind === 'hit') {
        osc.frequency.setValueAtTime(560, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(820, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        osc.start(); osc.stop(ctx.currentTime + 0.12);
      } else if (kind === 'miss') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(160, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.start(); osc.stop(ctx.currentTime + 0.2);
      } else if (kind === 'win') {
        osc.frequency.setValueAtTime(520, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(990, ctx.currentTime + 0.22);
        gain.gain.setValueAtTime(0.16, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start(); osc.stop(ctx.currentTime + 0.4);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
        osc.start(); osc.stop(ctx.currentTime + 0.55);
      }
    } catch (_) { /* silently ignore */ }
  }

  // ─── Dispatch helper ─────────────────────────────────────────────────────
  private _dispatch(name: string, detail: Record<string, unknown>) {
    this.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true, detail }));
  }

  // ─── Render ──────────────────────────────────────────────────────────────
  private _renderThemeToggle() {
    const isLight = this.theme === 'light';
    return html`
      <button
        class="theme-toggle"
        part="theme-toggle"
        type="button"
        @click=${this._toggleTheme}
        aria-pressed=${isLight.toString()}
        aria-label=${this.t(isLight ? 'common.switchToDark' : 'common.switchToLight')}
        title=${this.t(isLight ? 'common.themeDarkTitle' : 'common.themeLightTitle')}
      >${isLight ? '☀️' : '🌙'} ${this.t(isLight ? 'common.themeLight' : 'common.themeDark')}</button>
    `;
  }

  private _renderHUD() {
    const secs = Math.floor(this._elapsed / 1000);
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    const levelText = this.mode === 'levels'
      ? this.t('common.level', { level: this._currentLevel, total: this.levelCount })
      : this.t('common.freeMode');
    return html`
      <div class="hud" part="hud">
        <div class="hud-group">
          ${renderLanguagePicker(this.locale)}
          ${this._renderThemeToggle()}
          <slot name="host-controls"></slot>
        </div>
        <div class="hud-group">
          <span class="chip">${levelText} · ${m}:${s}</span>
          <span
            class="chip lives ${this._lives <= 2 ? 'low' : ''}"
            aria-label=${this.t('octahang.livesAria', { n: this._lives })}
          >
            ❤️ ${this._lives}/${MAX_MISTAKES}
          </span>
        </div>
      </div>
    `;
  }

  private _renderProgress() {
    const letters = uniqueLetters(this._word);
    const found = letters.filter((c) => this._guessed.includes(c)).length;
    const pct = letters.length ? Math.round((found / letters.length) * 100) : 0;
    return html`
      <div
        class="progress-track"
        role="progressbar"
        aria-valuenow=${pct}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-label=${this.t('octahang.progress')}
      >
        <div class="progress-fill" style="width:${pct}%"></div>
      </div>
    `;
  }

  private _renderHint() {
    const tier = this._entry.tier;
    const tierLabel = this.t(TIER_KEYS[tier]);
    return html`
      <div class="hint" part="hint">
        <span class="icon" aria-hidden="true">💡</span>
        <span class="text">
          <span class="label">${this.t('octahang.hintLabel')}</span>${this._entry.hint}
        </span>
        <span
          class="tier-badge t${tier}"
          aria-label=${this.t('octahang.difficultyAria', { tier: tierLabel })}
        >${tierLabel}</span>
      </div>
    `;
  }

  /**
   * Sehpa (taban, direk, üst kiriş, ip) oyun boyunca görünür kalır; adam ise
   * hata sayısı kadar parçayla çizilir. Her parçada pathLength="1" olduğu için
   * çizim animasyonu tek bir stroke-dashoffset geçişiyle yapılabilir; Lit
   * diziyi index'e göre eşlediğinden önceki parçalar yeniden animasyona
   * girmez.
   */
  private _renderStage() {
    const limbs = [
      svg`<path class="limb" pathLength="1" d="M130,45 a17,17 0 1,1 -0.01,0" />`, // 1. kafa
      svg`<path class="limb" pathLength="1" d="M130,79 V135" />`,                  // 2. gövde
      svg`<path class="limb" pathLength="1" d="M130,92 L104,118" />`,              // 3. sol kol
      svg`<path class="limb" pathLength="1" d="M130,92 L156,118" />`,              // 4. sağ kol
      svg`<path class="limb" pathLength="1" d="M130,135 L106,172" />`,             // 5. sol bacak
      svg`<path class="limb" pathLength="1" d="M130,135 L154,172" />`,             // 6. sağ bacak
    ];

    const label = this._wrong === 0
      ? this.t('octahang.stageEmpty')
      : this.t('octahang.stageDrawn', { wrong: this._wrong, lives: this._lives });

    return html`
      <div class="stage ltr-lock ${this._shaking ? 'shake' : ''}" part="stage">
        <svg viewBox="0 0 200 210" role="img" aria-label=${label}>
          <g class="gallows">
            <path d="M18,200 H118" />
            <path d="M48,200 V18" />
            <path d="M48,18 H130" />
          </g>
          <path class="rope" d="M130,18 V45" />
          ${limbs.slice(0, this._wrong)}
        </svg>
      </div>
    `;
  }

  private _renderWord() {
    const revealAll = this._phase === 'lost' || (this._phase === 'finishing' && this._wrong >= MAX_MISTAKES);
    const letters = this._word.split('');

    return html`
      <div class="word" part="word" role="img" aria-label=${this._wordAriaLabel(revealAll)}>
        ${letters.map((ch) => {
          const found = this._guessed.includes(ch);
          const show = found || revealAll;
          return html`<span
            class="slot ${show ? 'filled' : ''} ${show && !found ? 'missed' : ''}"
          >${show ? ch : ''}</span>`;
        })}
      </div>
    `;
  }

  private _wordAriaLabel(revealAll: boolean): string {
    const blank = this.t('octahang.blank');
    const spoken = this._word
      .split('')
      .map((ch) => (this._guessed.includes(ch) || revealAll ? ch : blank))
      .join(', ');
    return this.t('octahang.wordAria', { n: this._word.length, spoken });
  }

  private _renderKeyboard() {
    const rows = keyboardRows(this._pool.alphabet);
    // Tuş genişliği en uzun satıra göre hesaplanır;
    // kısa son satır aynı boyda kalıp yalnızca ortalanır.
    const cols = Math.max(...rows.map((r) => r.length));
    return html`
      <div
        class="keyboard"
        part="keyboard"
        role="group"
        aria-label=${this.t('octahang.keyboardAria')}
        style="--_kb-cols:${cols}"
      >
        ${rows.map((row) => html`
          <div class="kb-row">
            ${row.map((ch) => {
              const used = this._guessed.includes(ch);
              const hit = used && this._word.includes(ch);
              const disabled = used || this._phase !== 'playing';
              const suffix = used
                ? this.t(hit ? 'octahang.keyAriaCorrect' : 'octahang.keyAriaWrong')
                : '';
              return html`
                <button
                  class="key ${hit ? 'hit' : used ? 'miss' : ''}"
                  part="key"
                  type="button"
                  ?disabled=${disabled}
                  aria-label=${this.t('octahang.keyAria', { letter: ch }) + suffix}
                  @click=${() => this._onKeyClick(ch)}
                >${ch}</button>
              `;
            })}
          </div>
        `)}
      </div>
    `;
  }

  private _renderResult() {
    const won = this._phase === 'won';
    const isGameComplete = won && this.mode === 'levels' && this._currentLevel >= this.levelCount;
    const secs = Math.floor(this._finalMs / 1000);
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    const label = !won
      ? this.t('octahang.restart')
      : isGameComplete
        ? this.t('common.playAgain')
        : this.mode === 'random'
          ? `${this.t('octahang.nextWord')} ${this.arrow}`
          : `${this.t('octahang.nextLevel')} ${this.arrow}`;

    return html`
      <div class="modal-backdrop">
        <div
          class="result"
          part="result"
          role="dialog"
          aria-modal="true"
          aria-label=${this.t('octahang.resultAria')}
        >
          <div class="emoji">${isGameComplete ? '🏆' : won ? '🎉' : '💀'}</div>
          <h2>${this.t(isGameComplete ? 'octahang.allDone' : won ? 'octahang.won' : 'octahang.lost')}</h2>
          <p class="answer">${this.t('octahang.answer')} <b>${this._word}</b></p>
          ${won
            ? html`
                <div class="stats-row">
                  <div class="stat-card ${this._lastIsBest ? 'is-best' : ''}">
                    <span class="stat-icon">⭐</span>
                    <span class="stat-value">${this._lastScore}</span>
                    <span class="stat-label">${this.t('octahang.score')}</span>
                  </div>
                  <div class="stat-card">
                    <span class="stat-icon">⏱️</span>
                    <span class="stat-value">${m}:${s}</span>
                    <span class="stat-label">${this.t('common.time')}</span>
                  </div>
                  <div class="stat-card">
                    <span class="stat-icon">❤️</span>
                    <span class="stat-value">${this._lives}</span>
                    <span class="stat-label">${this.t('octahang.livesLeft')}</span>
                  </div>
                </div>
              `
            : nothing}
          ${this._lastIsBest ? html`<div class="best-badge">🌟 ${this.t('common.newRecord')}</div>` : nothing}
          <button class="btn-primary" part="button" @click=${this._next} aria-label=${label}>${label}</button>
        </div>
      </div>
    `;
  }

  /**
   * Açılış amblemi: tahtadaki darağacının küçültülmüş hâli ve tamamlanmış çöp
   * adam. İpin kirişe bağlandığı noktadan hafifçe sallanır; ölçüler oyun içi
   * çizimle aynı oranlardadır ki oyuncu ilk bakışta neyle karşılaşacağını
   * anlasın.
   */
  private _renderIdleFigure() {
    return html`
      <svg
        class="idle-figure"
        viewBox="0 0 110 132"
        role="img"
        aria-label=${this.t('octahang.idleFigureAria')}
      >
        <g class="gallows">
          <path d="M10,122 H62" />
          <path d="M26,122 V10" />
          <path d="M26,10 H80" />
        </g>
        <g class="swing">
          <path class="rope" d="M80,10 V26" />
          <g class="body">
            <path d="M80,26 a10,10 0 1,1 -0.01,0" />
            <path d="M80,46 V78" />
            <path d="M80,54 L66,68" />
            <path d="M80,54 L94,68" />
            <path d="M80,78 L67,98" />
            <path d="M80,78 L93,98" />
          </g>
        </g>
      </svg>
    `;
  }

  private _renderIdle() {
    return html`
      <div class="overlay-top">
        ${renderLanguagePicker(this.locale)}
        ${this._renderThemeToggle()}
        <slot name="host-controls"></slot>
      </div>
      <div class="overlay">
        ${this._renderIdleFigure()}
        <h2>${this.t('octahang.title')}</h2>
        <p>${this.t('octahang.tagline')}</p>
        <p style="opacity:.6;font-size:.8rem">${this.t('octahang.taglineSub')}</p>
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
    const finished = this._phase === 'won' || this._phase === 'lost';
    return html`
      ${this._renderHUD()}
      ${this._renderProgress()}
      ${this._renderHint()}
      ${this._renderStage()}
      ${this._renderWord()}
      ${this._renderKeyboard()}
      ${finished ? this._renderResult() : nothing}
      <div class="sr-only" aria-live="polite">${this._announce}</div>
    `;
  }
}
