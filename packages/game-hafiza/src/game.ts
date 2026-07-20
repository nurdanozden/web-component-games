import { LitElement, html, css, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { GameState, LevelResult } from '@octapull-games/core';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Card {
  id: number;      // unique per card instance
  symbol: string;  // the emoji shown
  pairId: number;  // cards sharing same pairId are a match
  flipped: boolean;
  matched: boolean;
}

type Phase = 'idle' | 'playing' | 'paused' | 'won' | 'fail';

// ─── Symbol pool (emojis, no external assets) ─────────────────────────────────

const SYMBOL_POOL = [
  '🌙', '⭐', '🔮', '🦋', '🌸', '🍄', '🔥', '💎',
  '🌊', '🌿', '🎯', '🎪', '🏺', '🧩', '🪄', '🎭',
  '🦊', '🐉', '🦁', '🌈', '🍀', '🎵', '⚡', '🌺',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Build a grid from a level index (1-based). Returns pair count. */
function pairCountForLevel(level: number, levelCount: number): number {
  // scale from 3 pairs (easy) → 12 pairs (hard)
  const t = Math.min((level - 1) / Math.max(levelCount - 1, 1), 1);
  return Math.round(3 + t * 9); // 3…12
}

/** Seeded PRNG (mulberry32) */
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function buildDeck(pairCount: number, rng?: () => number): Card[] {
  const rand = rng ?? Math.random;
  const symbols = shuffle(SYMBOL_POOL).slice(0, pairCount);
  const pairs: Card[] = [];
  let id = 0;
  for (let p = 0; p < symbols.length; p++) {
    pairs.push({ id: id++, symbol: symbols[p], pairId: p, flipped: false, matched: false });
    pairs.push({ id: id++, symbol: symbols[p], pairId: p, flipped: false, matched: false });
  }
  // Seeded shuffle
  const arr = [...pairs];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ─── Component ────────────────────────────────────────────────────────────────

export class HafizaGame extends LitElement {
  // ─── Styles ─────────────────────────────────────────────────────────────────
  static styles = css`
    *,*::before,*::after { box-sizing: border-box; }

    :host {
      display: block;
      font-family: var(--og-font, 'Segoe UI', system-ui, sans-serif);
      background: var(--og-bg, #0d0d1a);
      color: var(--og-text, #e8e8f0);
      padding: 1.25rem;
      border-radius: var(--og-radius, 16px);
      user-select: none;
      min-width: 280px;
    }

    /* ── HUD ── */
    .hud {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }
    .hud-stat {
      display: flex;
      flex-direction: column;
      align-items: center;
      background: rgba(255,255,255,.06);
      border: 1px solid rgba(255,255,255,.1);
      border-radius: 10px;
      padding: .35rem .75rem;
      min-width: 56px;
    }
    .hud-stat .label {
      font-size: .6rem;
      letter-spacing: .08em;
      text-transform: uppercase;
      opacity: .55;
    }
    .hud-stat .value {
      font-size: 1rem;
      font-weight: 700;
      color: var(--og-primary, #a78bfa);
    }

    /* ── Board ── */
    .board {
      display: grid;
      gap: .6rem;
      justify-items: center;
    }

    /* ── Card ── */
    .card-wrap {
      perspective: 600px;
      width: 100%;
      aspect-ratio: 1;
    }
    .card {
      position: relative;
      width: 100%;
      height: 100%;
      transform-style: preserve-3d;
      transition: transform .38s cubic-bezier(.4,0,.2,1);
      cursor: pointer;
      border-radius: 10px;
    }
    .card.flipped,
    .card.matched {
      transform: rotateY(180deg);
    }
    .card-face {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: inherit;
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
    }
    .card-back {
      background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
      border: 1px solid rgba(167,139,250,.3);
      font-size: 1.3em;
    }
    .card-back::after {
      content: '✦';
      color: rgba(167,139,250,.35);
      font-size: 1.4em;
    }
    .card-front {
      background: linear-gradient(135deg, #2e1065 0%, #1e1b4b 100%);
      border: 1px solid rgba(167,139,250,.5);
      transform: rotateY(180deg);
      font-size: clamp(.9rem, 3vw, 1.8rem);
    }
    .card.matched .card-front {
      background: linear-gradient(135deg, #14532d 0%, #166534 100%);
      border-color: rgba(74,222,128,.5);
    }
    .card:not(.matched):not(.flipped):hover .card-back {
      border-color: rgba(167,139,250,.7);
      background: linear-gradient(135deg, #2e1065 0%, #3730a3 100%);
    }
    .card:not(.matched) { cursor: pointer; }
    .card.matched { cursor: default; pointer-events: none; }

    /* ── Overlay screens ── */
    .overlay {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      padding: 2rem 1rem;
      text-align: center;
      animation: fadeIn .3s ease;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .overlay h2 {
      margin: 0;
      font-size: 1.6rem;
      font-weight: 800;
      background: linear-gradient(135deg, #a78bfa, #c4b5fd);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .overlay p {
      margin: 0;
      opacity: .7;
      font-size: .9rem;
    }
    .overlay .emoji { font-size: 3rem; }

    /* ── Buttons ── */
    button {
      cursor: pointer;
      border: none;
      border-radius: 10px;
      padding: .6rem 1.4rem;
      font-size: .9rem;
      font-weight: 600;
      transition: transform .15s, box-shadow .15s;
    }
    button:active { transform: scale(.97); }
    .btn-primary {
      background: linear-gradient(135deg, #7c3aed, #a78bfa);
      color: #fff;
      box-shadow: 0 4px 14px rgba(124,58,237,.45);
    }
    .btn-primary:hover { box-shadow: 0 6px 20px rgba(124,58,237,.6); }

    /* ── Level badge ── */
    .level-badge {
      font-size: .75rem;
      font-weight: 600;
      letter-spacing: .06em;
      text-transform: uppercase;
      opacity: .5;
      margin-bottom: .25rem;
    }
  `;

  // ─── Public API (contract) ────────────────────────────────────────────────
  @property({ type: String }) mode: 'levels' | 'random' = 'levels';
  @property({ type: Number }) levelCount = 10;
  @property({ attribute: false }) gameState: GameState | null = null;
  @property({ type: Boolean }) muted = false;
  @property({ type: Number }) seed?: number;

  // ─── Internal state ───────────────────────────────────────────────────────
  @state() private _deck: Card[] = [];
  @state() private _phase: Phase = 'idle';
  @state() private _currentLevel = 1;
  @state() private _moves = 0;
  @state() private _elapsed = 0;       // ms
  @state() private _openCards: number[] = []; // ids of currently flipped (max 2)

  private _completedLevels: LevelResult[] = [];
  private _bestTimes: Record<number, number> = {};
  private _totalPlayMs = 0;

  private _startTime = 0;
  private _rafId = 0;
  private _lockFlip = false;

  // ─── Lifecycle ────────────────────────────────────────────────────────────
  connectedCallback() {
    super.connectedCallback();
    if (this.gameState) {
      this._currentLevel = this.gameState.currentLevel;
      this._completedLevels = [...this.gameState.completedLevels];
      this._bestTimes = { ...this.gameState.bestTimes };
      this._totalPlayMs = this.gameState.totalPlayMs;
    }
    this._dispatch('og-ready', { gameId: 'game-hafiza' });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    cancelAnimationFrame(this._rafId);
  }

  // ─── Game flow ────────────────────────────────────────────────────────────
  private _startLevel() {
    cancelAnimationFrame(this._rafId);
    const pairCount =
      this.mode === 'random'
        ? 6
        : pairCountForLevel(this._currentLevel, this.levelCount);

    const rng = this.seed != null ? mulberry32(this.seed + this._currentLevel) : undefined;
    this._deck = buildDeck(pairCount, rng);
    this._moves = 0;
    this._elapsed = 0;
    this._openCards = [];
    this._lockFlip = false;
    this._phase = 'playing';
    this._startTime = performance.now();
    this._tick();

    this._dispatch('og-level-start', {
      gameId: 'game-hafiza',
      level: this._currentLevel,
      startedAt: new Date().toISOString(),
    });
  }

  private _tick() {
    this._rafId = requestAnimationFrame(() => {
      if (this._phase !== 'playing') return;
      const rawNow = performance.now() - this._startTime;
      this._elapsed = rawNow;
      this._tick();
    });
  }

  private _handleCardClick(id: number) {
    if (this._phase !== 'playing') return;
    if (this._lockFlip) return;
    const card = this._deck.find(c => c.id === id);
    if (!card || card.flipped || card.matched) return;

    // Flip
    this._deck = this._deck.map(c => c.id === id ? { ...c, flipped: true } : c);
    this._openCards = [...this._openCards, id];

    if (this._openCards.length === 2) {
      this._moves++;
      this._lockFlip = true;
      const [a, b] = this._openCards.map(oid => this._deck.find(c => c.id === oid)!);

      if (a.pairId === b.pairId) {
        // Match
        this._deck = this._deck.map(c =>
          c.pairId === a.pairId ? { ...c, matched: true } : c,
        );
        this._openCards = [];
        this._lockFlip = false;
        this._playTone(true);
        this._checkWin();
      } else {
        // No match – unflip after delay
        this._playTone(false);
        setTimeout(() => {
          this._deck = this._deck.map(c =>
            this._openCards.includes(c.id) ? { ...c, flipped: false } : c,
          );
          this._openCards = [];
          this._lockFlip = false;
        }, 800);
      }
    }
  }

  private _checkWin() {
    if (this._deck.every(c => c.matched)) {
      cancelAnimationFrame(this._rafId);
      const durationMs = Math.round(this._elapsed);
      const isBest = !this._bestTimes[this._currentLevel] ||
        durationMs < this._bestTimes[this._currentLevel];
      if (isBest) this._bestTimes[this._currentLevel] = durationMs;
      this._totalPlayMs += durationMs;

      const result: LevelResult = {
        level: this._currentLevel,
        durationMs,
        completedAt: new Date().toISOString(),
        moves: this._moves,
      };
      this._completedLevels.push(result);

      this._dispatch('og-level-complete', {
        gameId: 'game-hafiza',
        level: this._currentLevel,
        durationMs,
        moves: this._moves,
        isBest,
      });

      const newState: GameState = {
        version: 1,
        gameId: 'game-hafiza',
        currentLevel: this._currentLevel + 1,
        completedLevels: this._completedLevels,
        bestTimes: this._bestTimes,
        totalPlayMs: this._totalPlayMs,
      };
      this._dispatch('og-state-change', { gameId: 'game-hafiza', state: newState });

      const isLastLevel = this.mode === 'levels' && this._currentLevel >= this.levelCount;
      if (isLastLevel) {
        this._phase = 'won';
        this._dispatch('og-game-complete', { gameId: 'game-hafiza', totalMs: this._totalPlayMs });
      } else {
        this._phase = 'won';
      }
    }
  }

  private _nextLevel() {
    if (this.mode === 'levels') {
      this._currentLevel = Math.min(this._currentLevel + 1, this.levelCount);
    }
    this._startLevel();
  }

  // ─── Audio (Web Audio API) ────────────────────────────────────────────────
  private _ctx: AudioContext | null = null;
  private _audioCtx() {
    if (!this._ctx) this._ctx = new AudioContext();
    if (this._ctx.state === 'suspended') this._ctx.resume().catch(() => {});
    return this._ctx;
  }
  private _playTone(success: boolean) {
    if (this.muted) return;
    try {
      const ctx = this._audioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      if (success) {
        osc.frequency.setValueAtTime(520, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start(); osc.stop(ctx.currentTime + 0.3);
      } else {
        osc.frequency.setValueAtTime(280, ctx.currentTime);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.start(); osc.stop(ctx.currentTime + 0.2);
      }
    } catch (_) { /* silently ignore */ }
  }

  // ─── Dispatch helper ─────────────────────────────────────────────────────
  private _dispatch(name: string, detail: Record<string, unknown>) {
    this.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true, detail }));
  }

  // ─── Render ──────────────────────────────────────────────────────────────
  private _gridCols(count: number): string {
    // aim for roughly square-ish grid
    if (count <= 6) return '3';
    if (count <= 8) return '4';
    if (count <= 12) return '4';
    return '4';
  }

  private _renderHUD() {
    const secs = Math.floor(this._elapsed / 1000);
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    return html`
      <div class="hud" part="hud">
        <div class="hud-stat">
          <span class="label">Seviye</span>
          <span class="value">
            ${this.mode === 'levels' ? `${this._currentLevel}/${this.levelCount}` : '∞'}
          </span>
        </div>
        <div class="hud-stat">
          <span class="label">Süre</span>
          <span class="value">${m}:${s}</span>
        </div>
        <div class="hud-stat">
          <span class="label">Hamle</span>
          <span class="value">${this._moves}</span>
        </div>
        <div class="hud-stat">
          <span class="label">Kalan</span>
          <span class="value">${this._deck.filter(c => !c.matched).length / 2}</span>
        </div>
      </div>
    `;
  }

  private _renderBoard() {
    const cols = this._gridCols(this._deck.length / 2);
    return html`
      <div
        class="board"
        part="board"
        style="grid-template-columns: repeat(${cols}, 1fr); max-width: ${parseInt(cols) * 80}px; margin: 0 auto;"
        role="grid"
        aria-label="Hafıza oyun tahtası"
      >
        ${this._deck.map(card => this._renderCard(card))}
      </div>
    `;
  }

  private _renderCard(card: Card) {
    const cls = [
      'card',
      card.flipped || card.matched ? 'flipped' : '',
      card.matched ? 'matched' : '',
    ].filter(Boolean).join(' ');

    return html`
      <div class="card-wrap" role="gridcell">
        <div
          class=${cls}
          @click=${() => this._handleCardClick(card.id)}
          aria-label=${card.flipped || card.matched ? card.symbol : 'Kapalı kart'}
          aria-pressed=${(card.flipped || card.matched).toString()}
          tabindex=${card.matched ? '-1' : '0'}
          @keydown=${(e: KeyboardEvent) => e.key === 'Enter' && this._handleCardClick(card.id)}
        >
          <div class="card-face card-back"></div>
          <div class="card-face card-front">${card.symbol}</div>
        </div>
      </div>
    `;
  }

  private _renderIdle() {
    return html`
      <div class="overlay">
        <div class="emoji">🧠</div>
        <h2>Hafıza</h2>
        <p>Kartları çevir, çiftleri bul.</p>
        <button class="btn-primary" @click=${this._startLevel} aria-label="Oyunu başlat">
          Başla
        </button>
      </div>
    `;
  }

  private _renderWon() {
    const durationMs = this._completedLevels.at(-1)?.durationMs ?? 0;
    const secs = (durationMs / 1000).toFixed(1);
    const isLast = this.mode === 'levels' && this._currentLevel >= this.levelCount;

    return html`
      <div class="overlay">
        <div class="emoji">${isLast ? '🏆' : '✨'}</div>
        <h2>${isLast ? 'Tebrikler!' : 'Seviye Tamam!'}</h2>
        <p>${this._moves} hamlede ${secs} saniye</p>
        ${isLast
        ? html`<p>Tüm seviyeleri tamamladın!</p>`
        : nothing
      }
        <button class="btn-primary"
          @click=${this._nextLevel}
          aria-label=${isLast ? 'Yeniden oyna' : 'Sonraki seviye'}
        >
          ${isLast ? 'Tekrar Oyna' : 'Devam →'}
        </button>
      </div>
    `;
  }

  render() {
    if (this._phase === 'idle') return this._renderIdle();
    if (this._phase === 'won') return html`${this._renderHUD()}${this._renderBoard()}${this._renderWon()}`;
    return html`${this._renderHUD()}${this._renderBoard()}`;
  }
}
