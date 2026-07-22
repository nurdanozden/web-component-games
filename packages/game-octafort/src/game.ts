import { LitElement, html, css, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { GameState, LevelResult } from '@octapull-games/core';

// ─── Constants ──────────────────────────────────────────────────────────────

const GAME_ID = 'game-octafort';
const RANDOM_SIZE = 8;
const MIN_SIZE = 5; // level 1 (easy)
const MAX_SIZE = 9; // last level (hard)
const WIN_ANIMATION_MS = 900; // towers glow/lock before the "won" modal appears

// Cell contents. The tap cycle walks EMPTY → MARK → TOWER → EMPTY.
const EMPTY = 0;
const MARK = 1; // 🧱 "Sur" — player-eliminated cell ("kule kurulamaz")
const TOWER = 2; // 🏰 Siber-Kale Kulesi

type Phase = 'idle' | 'playing' | 'winning' | 'won';

interface Puzzle {
  size: number;
  /** region id (0..size-1) per cell, row-major */
  regions: Uint8Array;
  /** 1 where the generator's reference solution has a tower (not shown to the player) */
  solution: Uint8Array;
}

interface Analysis {
  /** tower cells that break a rule (row/col/region duplicate or adjacency) */
  conflicts: Set<number>;
  /** empty cells eliminated by a placed tower (row/col/region/8-neighbours) */
  attacked: Set<number>;
  towerCount: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Seeded PRNG (mulberry32) — same generator the other games use. */
function mulberry32(seed: number) {
  return function (): number {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/** Grid size (n×n) scaled from level 1 (easy) to the last level (hard). */
function sizeForLevel(level: number, levelCount: number): number {
  const t = Math.min((level - 1) / Math.max(levelCount - 1, 1), 1);
  return Math.round(MIN_SIZE + t * (MAX_SIZE - MIN_SIZE));
}

/** Chebyshev-distance-1 neighbours (the 8 surrounding cells) of a tower. */
function touchesAdjacently(a: number, b: number, n: number): boolean {
  const ax = a % n, ay = (a / n) | 0;
  const bx = b % n, by = (b / n) | 0;
  return Math.abs(ax - bx) <= 1 && Math.abs(ay - by) <= 1 && a !== b;
}

/**
 * Backtracking search for a valid tower placement: exactly one tower per row
 * and column, and no two towers touching (including diagonally). Because
 * there is one tower per row and column, the only way two towers can touch is
 * across two *consecutive* rows, so it is enough to require the columns of
 * neighbouring rows to differ by at least 2. Columns are tried in random order
 * so different seeds yield different base solutions. Returns the chosen column
 * for each row, or null if no arrangement exists (never happens for n ≥ 5).
 */
function generateSolution(n: number, rand: () => number): number[] | null {
  const cols = new Array<number>(n);
  const used = new Array<boolean>(n).fill(false);

  const order = (): number[] => {
    const a = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = (rand() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const place = (row: number): boolean => {
    if (row === n) return true;
    for (const c of order()) {
      if (used[c]) continue;
      if (row > 0 && Math.abs(cols[row - 1] - c) < 2) continue;
      cols[row] = c;
      used[c] = true;
      if (place(row + 1)) return true;
      used[c] = false;
    }
    return false;
  };

  return place(0) ? cols : null;
}

/**
 * Grows one connected security-sector (region) per tower via a randomised
 * multi-source flood fill. Every region is seeded with exactly one tower cell,
 * so each region is guaranteed contiguous and contains exactly one solution
 * tower — which is what makes the "one tower per sector" rule satisfiable by
 * construction. Random frontier selection gives the sectors organic shapes.
 */
function growRegions(n: number, seeds: number[], rand: () => number): Uint8Array {
  const total = n * n;
  const regions = new Int16Array(total).fill(-1);
  const frontier: Array<[number, number]> = []; // [unassignedCell, region]

  const pushNeighbours = (cell: number, region: number) => {
    const r = (cell / n) | 0, c = cell % n;
    if (r > 0 && regions[cell - n] === -1) frontier.push([cell - n, region]);
    if (r < n - 1 && regions[cell + n] === -1) frontier.push([cell + n, region]);
    if (c > 0 && regions[cell - 1] === -1) frontier.push([cell - 1, region]);
    if (c < n - 1 && regions[cell + 1] === -1) frontier.push([cell + 1, region]);
  };

  seeds.forEach((cell, region) => { regions[cell] = region; });
  seeds.forEach((cell, region) => pushNeighbours(cell, region));

  let assigned = seeds.length;
  while (assigned < total && frontier.length) {
    const k = (rand() * frontier.length) | 0;
    const [cell, region] = frontier[k];
    frontier[k] = frontier[frontier.length - 1];
    frontier.pop();
    if (regions[cell] !== -1) continue;
    regions[cell] = region;
    assigned++;
    pushNeighbours(cell, region);
  }

  // Defensive: a fully connected grid never leaves gaps, but if one somehow
  // remains, hand it to any already-assigned neighbour.
  for (let cell = 0; assigned < total && cell < total; cell++) {
    if (regions[cell] !== -1) continue;
    const r = (cell / n) | 0, c = cell % n;
    const nb = [r > 0 ? cell - n : -1, r < n - 1 ? cell + n : -1, c > 0 ? cell - 1 : -1, c < n - 1 ? cell + 1 : -1];
    for (const m of nb) {
      if (m >= 0 && regions[m] !== -1) { regions[cell] = regions[m]; assigned++; break; }
    }
  }

  return Uint8Array.from(regions);
}

/**
 * Counts distinct solutions (capped at `limit`) for a region layout: one tower
 * per row and column, one per region, none touching. Used to keep only puzzles
 * with a *unique* solution, so every board is deducible by logic alone rather
 * than guessing. n ≤ 9, so the row-by-row backtracker is effectively instant.
 */
function countSolutions(n: number, regions: Uint8Array, limit: number): number {
  const colUsed = new Array<boolean>(n).fill(false);
  const regUsed = new Array<boolean>(n).fill(false);
  const placedCol = new Array<number>(n);
  let count = 0;

  const solve = (row: number): void => {
    if (count >= limit) return;
    if (row === n) { count++; return; }
    for (let c = 0; c < n; c++) {
      if (colUsed[c]) continue;
      if (row > 0 && Math.abs(placedCol[row - 1] - c) < 2) continue;
      const reg = regions[row * n + c];
      if (regUsed[reg]) continue;
      colUsed[c] = true; regUsed[reg] = true; placedCol[row] = c;
      solve(row + 1);
      colUsed[c] = false; regUsed[reg] = false;
      if (count >= limit) return;
    }
  };

  solve(0);
  return count;
}

/**
 * Builds a uniquely-solvable puzzle: pick a base solution, grow regions around
 * it, and keep the layout only if the solver finds exactly one solution.
 * Falls back to the last solvable-but-not-unique layout if the attempt budget
 * runs out — the contract requires guaranteed solvability, and uniqueness is a
 * best-effort quality bar on top of that.
 */
function generatePuzzle(n: number, rand: () => number): Puzzle {
  let fallback: Puzzle | null = null;

  for (let attempt = 0; attempt < 80; attempt++) {
    const cols = generateSolution(n, rand);
    if (!cols) continue;
    const seeds = cols.map((c, r) => r * n + c);
    const solution = new Uint8Array(n * n);
    for (const s of seeds) solution[s] = 1;

    for (let regionTry = 0; regionTry < 14; regionTry++) {
      const regions = growRegions(n, seeds, rand);
      const puzzle: Puzzle = { size: n, regions, solution };
      if (countSolutions(n, regions, 2) === 1) return puzzle;
      fallback = puzzle;
    }
  }

  // Guaranteed reachable only if generateSolution kept failing (impossible for
  // n ≥ 5); build one last solvable layout so we never return null.
  if (!fallback) {
    const cols = generateSolution(n, rand) ?? Array.from({ length: n }, (_, i) => i);
    const seeds = cols.map((c, r) => r * n + c);
    const solution = new Uint8Array(n * n);
    for (const s of seeds) solution[s] = 1;
    fallback = { size: n, regions: growRegions(n, seeds, rand), solution };
  }
  return fallback;
}

/** Distinct region colour via the golden-angle hue sequence (good separation). */
function regionHue(region: number): number {
  return Math.round(region * 137.508) % 360;
}

// ─── Component ──────────────────────────────────────────────────────────────

export class OctafortGame extends LitElement {
  static styles = css`
    *, *::before, *::after { box-sizing: border-box; }

    :host {
      /* Internal themed palette. The public --og-* variables always win when
         the host page sets them; these only supply theme-aware fallbacks so
         the component looks right in a light or dark modal with zero config. */
      /* Midnight Slate — soft deep navy, no pure black, no neon glow. */
      --_bg: #1e293b;        /* card */
      --_surface: #0f172a;   /* grid, inset a step deeper than the card */
      --_text: #f8fafc;
      --_text-dim: #94a3b8;
      --_wall: #64748b;      /* sector ramparts — soft slate, not neon */
      --_border: #334155;
      --_shadow: 0 20px 25px -5px rgba(0,0,0,.4), 0 8px 10px -6px rgba(0,0,0,.3);
      --_line: rgba(255,255,255,.10);
      --_fill: rgba(255,255,255,.06);
      --_fill-soft: rgba(255,255,255,.03);
      --_fill-strong: rgba(255,255,255,.10);
      --_grid-line: rgba(148,163,184,.14);
      --_dot: rgba(148,163,184,.32);

      /* Accents are shared by both themes (Octapull orange + soft sapphire). */
      --_primary: #3b82f6;
      --_accent: #ff5b00;

      display: block;
      box-sizing: border-box;
      position: relative; /* contains the win overlay within the component box */
      font-family: var(--og-font, system-ui, -apple-system, sans-serif);
      background: var(--og-bg, var(--_bg));
      color: var(--og-text, var(--_text));
      padding: 1.1rem;
      border: 1px solid var(--_border);
      border-radius: var(--og-radius, 16px);
      box-shadow: var(--_shadow);
      min-width: 280px;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
    }

    /* Explicit theme switch via the theme attribute (reflected property). */
    /* Soft Modern Light — warm off-white surroundings, pure white card. */
    :host([theme='light']) {
      --_bg: #ffffff;        /* card */
      --_surface: #f1f5f9;   /* grid */
      --_text: #0f172a;
      --_text-dim: #64748b;
      --_wall: #94a3b8;
      --_border: #e2e8f0;
      --_shadow: 0 20px 25px -5px rgba(15,23,42,.08), 0 8px 10px -6px rgba(15,23,42,.04);
      --_line: rgba(15,23,42,.10);
      --_fill: rgba(15,23,42,.05);
      --_fill-soft: rgba(15,23,42,.03);
      --_fill-strong: rgba(15,23,42,.07);
      --_grid-line: rgba(15,23,42,.10);
      --_dot: rgba(15,23,42,.26);
    }

    /* ── HUD ── */
    .hud {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: .5rem;
      margin-bottom: .7rem;
    }
    .level-chip {
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
    .hud-actions { display: flex; gap: .4rem; }
    button.ghost {
      cursor: pointer;
      border: 1px solid var(--_line);
      background: var(--_fill-soft);
      color: inherit;
      border-radius: 999px;
      padding: .3rem .7rem;
      font-size: .7rem;
      font-weight: 700;
      letter-spacing: .03em;
      transition: background .15s, border-color .15s;
    }
    button.ghost:hover { background: var(--_fill); }
    button.ghost:focus-visible { outline: 3px solid var(--og-accent, var(--_accent)); outline-offset: 2px; }

    .progress-track {
      height: 10px;
      border-radius: 999px;
      background: var(--_fill);
      overflow: hidden;
      margin-bottom: .9rem;
    }
    .progress-fill {
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, var(--og-accent, var(--_accent)), var(--og-primary, var(--_primary)));
      transition: width .25s ease;
    }

    /* ── Board ── */
    .board-wrap { display: flex; justify-content: center; }
    .board {
      container-type: inline-size;
      width: 100%;
      max-width: min(480px, 92vw, 62vh);
    }
    .grid {
      display: grid;
      width: 100%;
      aspect-ratio: 1;
      border-radius: calc(var(--og-radius, 16px) * .55);
      overflow: hidden;
      background: var(--og-surface, var(--_surface));
      box-shadow: 0 0 0 2px var(--og-octafort-wall, var(--_wall));
      touch-action: none;
    }
    .grid.shake { animation: shake .34s ease; }
    @keyframes shake {
      10%, 90% { transform: translateX(-2px); }
      20%, 80% { transform: translateX(3px); }
      30%, 50%, 70% { transform: translateX(-5px); }
      40%, 60% { transform: translateX(5px); }
    }

    .cell {
      position: relative;
      aspect-ratio: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      margin: 0;
      border: 0;
      background: transparent;
      cursor: pointer;
      color: inherit;
      line-height: 1;
      transition: background-color .12s ease;
    }
    .cell:focus-visible {
      outline: none;
      box-shadow: inset 0 0 0 3px var(--og-accent, var(--_accent));
      z-index: 3;
    }
    /* faint per-cell grid lines under the thicker sector walls */
    .cell::after {
      content: '';
      position: absolute;
      inset: 0;
      box-shadow: inset 0 0 0 1px var(--_grid-line);
      pointer-events: none;
    }
    .cell .glyph {
      font-size: 62cqi; /* overwritten inline to (~half a cell) per grid size */
      filter: drop-shadow(0 1px 1px rgba(0,0,0,.35));
      transition: transform .12s ease;
    }
    .cell.tower .glyph { animation: pop .22s cubic-bezier(.34,1.56,.64,1); }
    @keyframes pop {
      from { transform: scale(.4); }
      to { transform: scale(1); }
    }
    .cell.mark .glyph { opacity: .5; font-size: 40cqi; }

    /* eliminated (attacked) empty cell — subtle guide dot */
    .cell.attacked::before {
      content: '';
      position: absolute;
      width: 12cqi;
      height: 12cqi;
      border-radius: 50%;
      background: var(--_dot);
      pointer-events: none;
    }

    /* conflicting towers glow red-neon */
    .cell.conflict {
      background: rgba(255, 45, 85, .16) !important;
    }
    .cell.conflict .glyph {
      filter: drop-shadow(0 0 6px #ff2d55) drop-shadow(0 0 2px #ff2d55);
      animation: conflict-pulse .9s ease-in-out infinite;
    }
    @keyframes conflict-pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.12); }
    }

    /* win — every tower lights up cyan/neon */
    .cell.victory .glyph {
      filter: drop-shadow(0 0 8px var(--og-accent, var(--_accent))) drop-shadow(0 0 3px var(--og-primary, var(--_primary)));
      animation: victory-pulse .7s ease-in-out;
    }
    @keyframes victory-pulse {
      0% { transform: scale(1); }
      40% { transform: scale(1.28); }
      100% { transform: scale(1); }
    }

    /* ── Idle / overlay ── */
    .overlay {
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
      to { opacity: 1; transform: translateY(0); }
    }
    .overlay h2 { margin: 0; font-size: 1.5rem; font-weight: 800; }
    .overlay p { margin: 0; color: var(--_text-dim); font-size: .9rem; max-width: 34ch; line-height: 1.5; }
    .overlay .emoji { font-size: 3rem; }
    .legend {
      display: flex;
      gap: 1.1rem;
      font-size: .8rem;
      color: var(--_text-dim);
      flex-wrap: wrap;
      justify-content: center;
    }
    .legend span { display: inline-flex; align-items: center; gap: .35rem; }

    /* ── Win modal ── */
    /* Stays inside the component's own box (position: absolute, not fixed) so
       the game can be embedded in a host modal without a second full-viewport
       overlay escaping its bounds. */
    .modal-backdrop {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: inherit;
      background: rgba(4, 10, 20, .58);
      backdrop-filter: blur(3px);
      z-index: 5;
      padding: 1.5rem;
      animation: fadeIn .25s ease;
    }
    .modal-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      width: 100%;
      max-width: 320px;
      max-height: 100%;
      overflow-y: auto;
      padding: 2rem 1.5rem;
      border-radius: calc(var(--og-radius, 16px) * 1.1);
      background: var(--og-bg, var(--_bg));
      border: 1px solid var(--_border);
      box-shadow: var(--_shadow);
      text-align: center;
      animation: popIn .3s cubic-bezier(.34,1.56,.64,1) both;
    }
    .modal-card h2 { margin: 0; font-size: 1.5rem; font-weight: 800; }
    .modal-card .emoji { font-size: 3rem; }

    .stats-row { display: flex; gap: .7rem; }
    .stat-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: .15rem;
      min-width: 92px;
      padding: .7rem .9rem;
      border-radius: 14px;
      background: linear-gradient(160deg, var(--_fill-strong), var(--_fill-soft));
      border: 1px solid var(--_line);
      animation: popIn .35s cubic-bezier(.34,1.56,.64,1) both;
    }
    .stat-card.is-best {
      border-color: var(--og-accent, var(--_accent));
      box-shadow: 0 0 0 1px var(--og-accent, var(--_accent)), 0 0 18px rgba(255,91,0,.3);
    }
    .stat-card:nth-child(2) { animation-delay: .08s; }
    .stat-icon { font-size: 1.3rem; line-height: 1; }
    .stat-value {
      font-size: 1.7rem;
      font-weight: 800;
      line-height: 1.1;
      font-variant-numeric: tabular-nums;
      background: linear-gradient(135deg, var(--og-accent, var(--_accent)), var(--og-primary, var(--_primary)));
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }
    .stat-label {
      font-size: .65rem;
      font-weight: 700;
      letter-spacing: .04em;
      text-transform: uppercase;
      color: var(--_text-dim);
    }
    .best-badge { font-size: .7rem; font-weight: 700; color: var(--og-accent, var(--_accent)); }
    @keyframes popIn {
      from { opacity: 0; transform: scale(.7) translateY(6px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }

    button.btn-primary {
      cursor: pointer;
      border: none;
      border-radius: 10px;
      padding: .6rem 1.4rem;
      font-size: .9rem;
      font-weight: 600;
      background: linear-gradient(135deg, var(--og-primary, var(--_primary)), var(--og-accent, var(--_accent)));
      color: #fff;
      transition: transform .15s;
    }
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
      .grid.shake { animation: none; }
      .cell .glyph, .cell.tower .glyph, .cell.conflict .glyph, .cell.victory .glyph { animation: none; }
      .progress-fill { transition: none; }
      .overlay, .modal-backdrop, .modal-card, .stat-card { animation: none; }
    }
  `;

  // ─── Public API (contract) ─────────────────────────────────────────────
  @property({ type: String }) mode: 'levels' | 'random' = 'levels';
  @property({ type: Number }) levelCount = 10;
  @property({ attribute: false }) state: GameState | null = null;
  @property({ type: Boolean }) muted = false;
  @property({ type: Number }) seed?: number;
  /** Host-page theme. Flips the component's built-in light/dark palette; any
   *  explicit --og-* variable the host sets still overrides it. */
  @property({ type: String, reflect: true }) theme: 'dark' | 'light' = 'dark';

  // ─── Internal state ─────────────────────────────────────────────────────
  @state() private _phase: Phase = 'idle';
  @state() private _puzzle!: Puzzle;
  @state() private _cells: Uint8Array = new Uint8Array(0);
  @state() private _cursor = 0;
  @state() private _currentLevel = 1;
  @state() private _moves = 0;
  @state() private _elapsed = 0; // ms
  @state() private _shaking = false;
  @state() private _announce = '';

  private _completedLevels: LevelResult[] = [];
  private _bestTimes: Record<number, number> = {};
  private _totalPlayMs = 0;
  private _lastResultIsBest = false;

  private _startTime = 0;
  private _rafId = 0;
  private _shakeTimeout = 0;
  private _winTimer = 0;
  private _focusPending = false;
  private _ctx: AudioContext | null = null;

  private _onVisibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(this._rafId);
    } else if (this._phase === 'playing') {
      this._startTime = performance.now() - this._elapsed;
      this._tick();
    }
  };

  // ─── Lifecycle ───────────────────────────────────────────────────────────
  connectedCallback() {
    super.connectedCallback();
    if (this.state) {
      this._currentLevel = this.mode === 'levels' ? this.state.currentLevel : 1;
      this._completedLevels = [...this.state.completedLevels];
      this._bestTimes = { ...this.state.bestTimes };
      this._totalPlayMs = this.state.totalPlayMs;
    }
    document.addEventListener('visibilitychange', this._onVisibility);
    this._dispatch('og-ready', { gameId: GAME_ID });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    cancelAnimationFrame(this._rafId);
    clearTimeout(this._shakeTimeout);
    clearTimeout(this._winTimer);
    document.removeEventListener('visibilitychange', this._onVisibility);
  }

  updated() {
    // Roving-tabindex focus: after an arrow-key move, pull DOM focus onto the
    // cursor cell so keyboard navigation stays visible and screen-reader-aware.
    if (this._focusPending) {
      this._focusPending = false;
      const btn = this.renderRoot?.querySelector<HTMLButtonElement>(`.cell[data-i="${this._cursor}"]`);
      btn?.focus();
    }
  }

  // ─── Game flow ───────────────────────────────────────────────────────────
  private get _size(): number {
    return this._puzzle?.size ?? 0;
  }

  private get _levelKey(): number {
    return this.mode === 'random' ? 0 : this._currentLevel;
  }

  private _startLevel = () => {
    cancelAnimationFrame(this._rafId);
    clearTimeout(this._winTimer);
    const size = this.mode === 'levels' ? sizeForLevel(this._currentLevel, this.levelCount) : RANDOM_SIZE;
    const rngSeed = this.seed != null ? this.seed + (this.mode === 'levels' ? this._currentLevel : 0) : undefined;
    const rng = rngSeed != null ? mulberry32(rngSeed) : Math.random;

    this._puzzle = generatePuzzle(size, rng);
    this._cells = new Uint8Array(size * size);
    this._cursor = 0;
    this._moves = 0;
    this._elapsed = 0;
    this._shaking = false;
    this._announce = '';
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

  /** Analyse the current board: which towers clash, which empties are ruled out. */
  private _analyze(): Analysis {
    const n = this._size;
    const conflicts = new Set<number>();
    const attacked = new Set<number>();
    const towers: number[] = [];
    for (let i = 0; i < this._cells.length; i++) if (this._cells[i] === TOWER) towers.push(i);

    // Row/column/region duplicates → every tower sharing that line conflicts.
    const byRow = new Map<number, number[]>();
    const byCol = new Map<number, number[]>();
    const byReg = new Map<number, number[]>();
    for (const t of towers) {
      const r = (t / n) | 0, c = t % n, reg = this._puzzle.regions[t];
      (byRow.get(r) ?? byRow.set(r, []).get(r)!).push(t);
      (byCol.get(c) ?? byCol.set(c, []).get(c)!).push(t);
      (byReg.get(reg) ?? byReg.set(reg, []).get(reg)!).push(t);
    }
    for (const group of [...byRow.values(), ...byCol.values(), ...byReg.values()]) {
      if (group.length > 1) for (const t of group) conflicts.add(t);
    }
    // Adjacency (the 8 neighbours) → both towers conflict.
    for (let i = 0; i < towers.length; i++) {
      for (let j = i + 1; j < towers.length; j++) {
        if (touchesAdjacently(towers[i], towers[j], n)) {
          conflicts.add(towers[i]);
          conflicts.add(towers[j]);
        }
      }
    }

    // Eliminated cells (assist): any empty cell a placed tower rules out.
    for (const t of towers) {
      const tr = (t / n) | 0, tc = t % n, treg = this._puzzle.regions[t];
      for (let i = 0; i < this._cells.length; i++) {
        if (this._cells[i] !== EMPTY) continue;
        const r = (i / n) | 0, c = i % n;
        if (r === tr || c === tc || this._puzzle.regions[i] === treg || touchesAdjacently(t, i, n)) {
          attacked.add(i);
        }
      }
    }

    return { conflicts, attacked, towerCount: towers.length };
  }

  private _onCellClick = (i: number) => {
    if (this._phase !== 'playing') return;
    this._cursor = i;
    this._cycleCell(i);
  };

  /** EMPTY → MARK (🧱) → TOWER (🏰) → EMPTY, matching the tap-cycle rules. */
  private _cycleCell(i: number) {
    if (this._phase !== 'playing') return;
    const next = this._cells.slice();
    next[i] = (next[i] + 1) % 3;
    this._cells = next;
    this._moves++;

    if (next[i] === TOWER) {
      const { conflicts } = this._analyze();
      if (conflicts.has(i)) { this._wallFeedback(); this._playTone('bump'); }
      else this._playTone('place');
    } else {
      this._playTone('tick');
    }

    this._checkWin();
  }

  private _checkWin() {
    const { conflicts, towerCount } = this._analyze();
    if (towerCount === this._size && conflicts.size === 0) this._beginWin();
  }

  private _handleKey(e: KeyboardEvent) {
    if (this._phase !== 'playing') return;
    const n = this._size;
    const cx = this._cursor % n, cy = (this._cursor / n) | 0;
    let nx = cx, ny = cy;
    switch (e.key) {
      case 'ArrowUp': case 'w': case 'W': ny = Math.max(0, cy - 1); break;
      case 'ArrowDown': case 's': case 'S': ny = Math.min(n - 1, cy + 1); break;
      case 'ArrowLeft': case 'a': case 'A': nx = Math.max(0, cx - 1); break;
      case 'ArrowRight': case 'd': case 'D': nx = Math.min(n - 1, cx + 1); break;
      case 'Enter': case ' ': case 'Spacebar':
        e.preventDefault();
        this._cycleCell(this._cursor);
        return;
      default: return;
    }
    e.preventDefault();
    this._cursor = ny * n + nx;
    this._focusPending = true;
  }

  private _wallFeedback() {
    this._shaking = true;
    clearTimeout(this._shakeTimeout);
    this._shakeTimeout = window.setTimeout(() => { this._shaking = false; }, 340);
  }

  private _resetBoard = () => {
    if (this._phase !== 'playing') return;
    this._cells = new Uint8Array(this._size * this._size);
    this._playTone('tick');
  };

  /**
   * Completing the grid locks input immediately (phase leaves 'playing', so the
   * cell/key handlers reject further input) and plays the victory glow. The win
   * bookkeeping (stats, dispatch, persistence) is deferred until the animation
   * ends so the "Güvende!" modal lands as the towers finish lighting up.
   */
  private _beginWin() {
    cancelAnimationFrame(this._rafId);
    clearTimeout(this._winTimer);
    this._phase = 'winning';
    this._announce = 'Tüm kuleler yerleştirildi, güvende!';
    this._playTone('win');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this._winTimer = window.setTimeout(() => this._handleWin(), reduced ? 0 : WIN_ANIMATION_MS);
  }

  private _handleWin() {
    const durationMs = Math.round(this._elapsed);
    const key = this._levelKey;
    // "Yeni Rekor" reflects the single fastest solve across every level so far,
    // not just this level's own best — a slower run on a fresh level must not
    // read as a record.
    const priorBestTimes = Object.values(this._bestTimes);
    const priorGlobalBest = priorBestTimes.length ? Math.min(...priorBestTimes) : Infinity;
    const isBest = durationMs < priorGlobalBest;
    if (!this._bestTimes[key] || durationMs < this._bestTimes[key]) {
      this._bestTimes[key] = durationMs;
    }
    this._lastResultIsBest = isBest;
    this._totalPlayMs += durationMs;

    this._completedLevels.push({
      level: this._currentLevel,
      durationMs,
      completedAt: new Date().toISOString(),
      moves: this._moves,
    });

    this._dispatch('og-level-complete', {
      gameId: GAME_ID,
      level: this._currentLevel,
      durationMs,
      moves: this._moves,
      isBest,
    });

    const isGameComplete = this.mode === 'levels' && this._currentLevel >= this.levelCount;
    const nextLevel = this.mode === 'levels' ? Math.min(this._currentLevel + 1, this.levelCount) : 1;
    this._persistState(nextLevel);

    this._phase = 'won';
    this._announce = isGameComplete ? 'Tüm seviyeler tamamlandı!' : 'Seviye tamamlandı!';
    if (isGameComplete) this._dispatch('og-game-complete', { gameId: GAME_ID, totalMs: this._totalPlayMs });
  }

  private _persistState(nextLevel: number) {
    const newState: GameState = {
      version: 1,
      gameId: GAME_ID,
      currentLevel: nextLevel,
      completedLevels: this._completedLevels,
      bestTimes: this._bestTimes,
      totalPlayMs: this._totalPlayMs,
    };
    this._dispatch('og-state-change', { gameId: GAME_ID, state: newState });
  }

  private _nextLevel = () => {
    if (this.mode === 'levels') {
      const isLast = this._currentLevel >= this.levelCount;
      this._currentLevel = isLast ? 1 : this._currentLevel + 1;
    }
    this._startLevel();
  };

  // ─── Audio (Web Audio API) ──────────────────────────────────────────────
  private _audioCtx() {
    if (!this._ctx) this._ctx = new AudioContext();
    return this._ctx;
  }

  private _playTone(kind: 'place' | 'tick' | 'bump' | 'win') {
    if (this.muted) return;
    try {
      const ctx = this._audioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      if (kind === 'place') {
        osc.frequency.setValueAtTime(520, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(760, ctx.currentTime + 0.09);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        osc.start(); osc.stop(ctx.currentTime + 0.12);
      } else if (kind === 'tick') {
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
        osc.start(); osc.stop(ctx.currentTime + 0.06);
      } else if (kind === 'bump') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        gain.gain.setValueAtTime(0.11, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.start(); osc.stop(ctx.currentTime + 0.2);
      } else {
        osc.frequency.setValueAtTime(500, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(950, ctx.currentTime + 0.22);
        gain.gain.setValueAtTime(0.16, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start(); osc.stop(ctx.currentTime + 0.4);
      }
    } catch (_) { /* silently ignore */ }
  }

  // ─── Dispatch helper ─────────────────────────────────────────────────────
  private _dispatch(name: string, detail: Record<string, unknown>) {
    this.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true, detail }));
  }

  // ─── Render ──────────────────────────────────────────────────────────────
  private _renderHUD() {
    const secs = Math.floor(this._elapsed / 1000);
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    return html`
      <div class="hud" part="hud">
        <div class="level-chip">
          ${this.mode === 'levels' ? html`Seviye ${this._currentLevel}/${this.levelCount}` : html`Serbest Mod`}
          · ${this._size}×${this._size} · ${m}:${s}
        </div>
        <div class="hud-actions">
          <button class="ghost" part="button" @click=${this._resetBoard} aria-label="Tahtayı temizle">Sıfırla</button>
        </div>
      </div>
    `;
  }

  private _renderProgress(towerCount: number) {
    const pct = this._size ? Math.round((towerCount / this._size) * 100) : 0;
    return html`
      <div
        class="progress-track"
        role="progressbar"
        aria-valuenow=${pct}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-label="Yerleştirilen kuleler"
      >
        <div class="progress-fill" style="width:${pct}%"></div>
      </div>
    `;
  }

  private _renderBoard(analysis: Analysis) {
    const n = this._size;
    const regions = this._puzzle.regions;
    const glyphSize = `${Math.round(52 / n * 10) / 10}cqi`;
    const isVictory = this._phase === 'winning' || this._phase === 'won';

    const cells = [];
    for (let i = 0; i < n * n; i++) {
      const r = (i / n) | 0, c = i % n;
      const region = regions[i];
      const hue = regionHue(region);
      // Thicker "sur" (rampart) borders wherever a cell meets a different sector.
      const wall = 'var(--og-octafort-wall, var(--_wall))';
      const bTop = r === 0 || regions[i - n] !== region;
      const bLeft = c === 0 || regions[i - 1] !== region;
      const bRight = c === n - 1 || regions[i + 1] !== region;
      const bBottom = r === n - 1 || regions[i + n] !== region;
      const borders =
        `border-top:${bTop ? `3px solid ${wall}` : '0'};` +
        `border-left:${bLeft ? `3px solid ${wall}` : '0'};` +
        `border-right:${bRight ? `3px solid ${wall}` : '0'};` +
        `border-bottom:${bBottom ? `3px solid ${wall}` : '0'};`;
      const bg = `background-color:hsla(${hue}, 62%, 52%, .26);`;

      const v = this._cells[i];
      const isConflict = v === TOWER && analysis.conflicts.has(i);
      const classes =
        'cell' +
        (v === TOWER ? ' tower' : '') +
        (v === MARK ? ' mark' : '') +
        (v === EMPTY && analysis.attacked.has(i) ? ' attacked' : '') +
        (isConflict ? ' conflict' : '') +
        (v === TOWER && isVictory ? ' victory' : '');

      const glyph = v === TOWER ? '🏰' : v === MARK ? '✕' : '';
      const label =
        `Satır ${r + 1}, sütun ${c + 1}, sektör ${region + 1}. ` +
        (v === TOWER ? (isConflict ? 'Kule — kural ihlali.' : 'Kule.') : v === MARK ? 'Sur işareti.' : 'Boş.');

      cells.push(html`
        <button
          class=${classes}
          data-i=${i}
          role="gridcell"
          tabindex=${i === this._cursor ? 0 : -1}
          style="${borders}${bg}"
          aria-label=${label}
          @click=${() => this._onCellClick(i)}
        >
          <span class="glyph" style="font-size:${glyphSize}">${glyph}</span>
        </button>
      `);
    }

    return html`
      <div class="board-wrap">
        <div class="board">
          <div
            part="board"
            class="grid ${this._shaking ? 'shake' : ''}"
            role="grid"
            aria-label="Octafort tahtası, ${n} çarpı ${n}. Bir hücreye dokunmak sırayla sur, kule ve boş durumları arasında geçiş yaptırır. Ok tuşlarıyla gezinip Boşluk ile değiştir."
            style="grid-template-columns:repeat(${n}, 1fr);"
            @keydown=${(e: KeyboardEvent) => this._handleKey(e)}
          >
            ${cells}
          </div>
        </div>
      </div>
    `;
  }

  private _renderIdle() {
    return html`
      <div class="overlay">
        <div class="emoji">🏰</div>
        <h2>Octafort</h2>
        <p>
          Her satıra, sütuna ve renkli güvenlik bölgelerine tam olarak bir
          Kale yerleştir. Kaleler sınır komşusu olamaz (çapraz bile!).
        </p>
        <div class="legend">
          <span>🏰 Kule</span>
          <span>✕ Sur (eleme)</span>
        </div>
        <p style="opacity:.55;font-size:.8rem">Dokun: Sur → Kule → Boş</p>
        <button class="btn-primary" part="button" @click=${this._startLevel} aria-label="Oyunu başlat">Başla</button>
      </div>
    `;
  }

  private _renderWon() {
    const last = this._completedLevels.at(-1);
    const durationMs = last?.durationMs ?? 0;
    const totalSecs = Math.floor(durationMs / 1000);
    const m = String(Math.floor(totalSecs / 60)).padStart(2, '0');
    const s = String(totalSecs % 60).padStart(2, '0');
    const isGameComplete = this.mode === 'levels' && this._currentLevel >= this.levelCount;
    const label = isGameComplete ? 'Tekrar Oyna' : this.mode === 'random' ? 'Yeni Bölüm →' : 'Devam →';

    return html`
      <div class="modal-backdrop">
        <div class="modal-card" part="modal">
          <div class="emoji">${isGameComplete ? '🏆' : '🏰'}</div>
          <h2>${isGameComplete ? 'Tebrikler!' : 'Güvende!'}</h2>
          <div class="stats-row">
            <div class="stat-card ${this._lastResultIsBest ? 'is-best' : ''}">
              <span class="stat-icon">⏱️</span>
              <span class="stat-value">${m}:${s}</span>
              <span class="stat-label">Süre</span>
            </div>
            <div class="stat-card">
              <span class="stat-icon">👆</span>
              <span class="stat-value">${this._moves}</span>
              <span class="stat-label">Hamle</span>
            </div>
          </div>
          ${this._lastResultIsBest ? html`<div class="best-badge">🌟 Yeni Rekor!</div>` : nothing}
          <button class="btn-primary" part="button" @click=${this._nextLevel} aria-label=${label}>${label}</button>
        </div>
      </div>
    `;
  }

  render() {
    if (this._phase === 'idle') return this._renderIdle();
    const analysis = this._analyze();
    return html`
      ${this._renderHUD()}
      ${this._renderProgress(analysis.towerCount)}
      ${this._renderBoard(analysis)}
      ${this._phase === 'won' ? this._renderWon() : nothing}
      <div class="sr-only" aria-live="polite">${this._announce}</div>
    `;
  }
}
