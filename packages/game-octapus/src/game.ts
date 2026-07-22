import { LitElement, html, svg, css, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { GameState, LevelResult } from '@octapull-games/core';

// ─── Constants ──────────────────────────────────────────────────────────────

const GAME_ID = 'game-octapus';
const RANDOM_SIZE = 13;
const MIN_SIZE = 10;
const MAX_SIZE = 15;
const CELL_PX = 30;
const MAZE_PAD = 3;
const STEP_MS = 130; // per-cell delay while auto-walking a clicked path
const DRAIN_ANIMATION_MS = 1200; // lid opens + octopus sinks before the "won" modal appears

// Wall bitmask: North=1, East=2, South=4, West=8
const DIRS: ReadonlyArray<readonly [number, number, number, number]> = [
  [0, -1, 1, 4], // up:    clear current's N, neighbor's S
  [1, 0, 2, 8], // right: clear current's E, neighbor's W
  [0, 1, 4, 1], // down:  clear current's S, neighbor's N
  [-1, 0, 8, 2], // left:  clear current's W, neighbor's E
];

type Phase = 'idle' | 'playing' | 'draining' | 'won';

interface MazeData {
  size: number;
  walls: Uint8Array;
  startIdx: number;
  exitIdx: number;
  distFromExit: Int32Array;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Seeded PRNG (mulberry32) */
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

function neighborsOf(walls: Uint8Array, size: number, cur: number): number[] {
  const cx = cur % size, cy = (cur / size) | 0;
  const w = walls[cur];
  const result: number[] = [];
  if (!(w & 1) && cy > 0) result.push(cur - size);
  if (!(w & 2) && cx < size - 1) result.push(cur + 1);
  if (!(w & 4) && cy < size - 1) result.push(cur + size);
  if (!(w & 8) && cx > 0) result.push(cur - 1);
  return result;
}

function bfsDistances(walls: Uint8Array, size: number, startIdx: number): Int32Array {
  const dist = new Int32Array(size * size).fill(-1);
  dist[startIdx] = 0;
  const queue = [startIdx];
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    for (const n of neighborsOf(walls, size, cur)) {
      if (dist[n] < 0) { dist[n] = dist[cur] + 1; queue.push(n); }
    }
  }
  return dist;
}

/**
 * Growing-tree carve: builds a spanning tree of the grid, so exactly one
 * path connects any two cells and every maze is solvable by construction.
 * `deadEndBias` blends two classic strategies for picking the next frontier
 * edge to carve: 0 is plain randomized Prim's (uniform pick), which grows
 * uniformly from the start and tends to produce short, direct solution
 * paths with many shallow dead-ends near the surface. Closer to 1 biases
 * toward always extending the most-recently-carved edge (DFS-like), which
 * produces longer winding corridors and deeper dead-end branches — harder
 * to visually solve since wrong turns cost more backtracking.
 */
function buildMaze(size: number, rng?: () => number, deadEndBias = 0): MazeData {
  const rand = rng ?? Math.random;
  const walls = new Uint8Array(size * size).fill(15);
  const inMaze = new Uint8Array(size * size);
  const idx = (x: number, y: number) => y * size + x;

  // Each frontier entry is an edge from an in-maze cell to an out-of-maze
  // neighbor: [fromIdx, toIdx, wallBitOnFrom, wallBitOnTo].
  const frontier: Array<[number, number, number, number]> = [];
  const addFrontier = (cellIdx: number) => {
    const cx = cellIdx % size, cy = (cellIdx / size) | 0;
    for (const [dx, dy, wc, wn] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
        const nIdx = idx(nx, ny);
        if (!inMaze[nIdx]) frontier.push([cellIdx, nIdx, wc, wn]);
      }
    }
  };

  // Start spawns in a random corner each time; the exit always lands in the
  // diagonally opposite corner, so the two keep swapping across the four
  // corner pairings instead of sitting in the same spots every playthrough.
  const corners = [
    idx(0, 0),
    idx(size - 1, 0),
    idx(0, size - 1),
    idx(size - 1, size - 1),
  ];
  const startCorner = Math.floor(rand() * 4);
  const startIdx = corners[startCorner];
  const exitIdx = corners[3 - startCorner];

  inMaze[startIdx] = 1;
  addFrontier(startIdx);

  while (frontier.length) {
    const pick = rand() < deadEndBias
      ? frontier.length - 1 // extend the most recently carved edge (DFS-like)
      : Math.floor(rand() * frontier.length);
    const [fromIdx, toIdx, wc, wn] = frontier[pick];
    frontier[pick] = frontier[frontier.length - 1];
    frontier.pop();
    if (inMaze[toIdx]) continue; // stale entry, neighbor already carved in from elsewhere

    walls[fromIdx] &= ~wc;
    walls[toIdx] &= ~wn;
    inMaze[toIdx] = 1;
    addFrontier(toIdx);
  }

  const distFromExit = bfsDistances(walls, size, exitIdx);

  return { size, walls, startIdx, exitIdx, distFromExit };
}

// ─── Component ──────────────────────────────────────────────────────────────

export class OctapusGame extends LitElement {
  static styles = css`
    *,*::before,*::after { box-sizing: border-box; }

    :host {
      display: block;
      font-family: var(--og-font, system-ui, -apple-system, sans-serif);
      --og-bg: #0b1220;
      --og-surface: #f4f7fb;
      --og-primary: #0066cc;
      --og-accent: #ff9900;
      --og-text: #eaf2ff;
      box-sizing: border-box;
      width: 100%;
      background: var(--og-bg);
      color: var(--og-text);
      padding: 1.5rem;
      border-radius: var(--og-radius, 16px);
      min-width: 280px;
      user-select: none;
      transition: background .2s ease, color .2s ease;
    }

    /* Light-theme token overrides — toggled via the theme property/attribute. */
    :host([theme='light']) {
      --og-bg: #f4f7fb;
      --og-surface: #ffffff;
      --og-primary: #0057b3;
      --og-accent: #d97400;
      --og-text: #16202e;
    }

    .hud {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: .5rem;
      margin-bottom: .6rem;
    }
    .hud-left {
      display: flex;
      align-items: center;
      gap: .4rem;
      min-width: 0;
    }
    /* Lets a host page project its own controls (mode switch, mute, etc.)
       right next to the built-in theme toggle instead of elsewhere on the page. */
    ::slotted(*) {
      flex: none;
    }
    .theme-toggle {
      cursor: pointer;
      border: none;
      border-radius: 999px;
      width: 2rem;
      height: 2rem;
      flex: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 1rem;
      line-height: 1;
      background: color-mix(in srgb, var(--og-text) 10%, transparent);
      color: var(--og-text);
      transition: background .15s, transform .15s;
    }
    .theme-toggle:hover { background: color-mix(in srgb, var(--og-text) 18%, transparent); }
    .theme-toggle:active { transform: scale(.92); }
    .theme-toggle:focus-visible { outline: 3px solid var(--og-accent, #ff9900); outline-offset: 2px; }

    .level-chip {
      font-size: .7rem;
      font-weight: 700;
      letter-spacing: .04em;
      text-transform: uppercase;
      opacity: .75;
      background: color-mix(in srgb, var(--og-text) 8%, transparent);
      padding: .3rem .65rem;
      border-radius: 999px;
      white-space: nowrap;
    }

    .progress-track {
      height: 10px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--og-text) 8%, transparent);
      overflow: hidden;
      margin-bottom: .9rem;
    }
    .progress-fill {
      height: 100%;
      border-radius: inherit;
      background: var(--og-accent, #ff9900);
      transition: width .25s ease;
    }

    .board-wrap { display: flex; justify-content: center; }
    .maze {
      width: 100%;
      max-width: min(640px, 100%);
      aspect-ratio: 1;
      background: var(--og-surface, #f4f7fb);
      border-radius: calc(var(--og-radius, 16px) * .6);
      touch-action: none;
      cursor: pointer;
    }
    :host([theme='light']) .maze {
      border: 1px solid color-mix(in srgb, var(--og-text) 12%, transparent);
    }
    .maze:focus-visible { outline: 3px solid var(--og-accent, #ff9900); outline-offset: 2px; }
    .maze.shake { animation: shake .32s ease; }
    @keyframes shake {
      10%, 90% { transform: translateX(-2px); }
      20%, 80% { transform: translateX(3px); }
      30%, 50%, 70% { transform: translateX(-5px); }
      40%, 60% { transform: translateX(5px); }
    }
    line.wall {
      stroke: var(--og-primary, #0066cc);
      stroke-width: 2.4;
      stroke-linecap: round;
    }
    .exit-cell { fill: var(--og-accent, #ff9900); opacity: .18; }
    .player-g { transition: transform .13s ease; transform-origin: 0 0; }
    .player-g.sinking {
      transition: transform .7s cubic-bezier(.55,0,.85,.35) .3s, opacity .55s ease .4s;
      opacity: 0;
    }
    .player-emoji { font-size: 20px; }

    .drain-hole {
      fill: url(#drain-hole-grad);
      opacity: 0;
      transition: opacity .35s ease .15s;
    }
    .drain-hole.is-open { opacity: 1; }

    .drain-lid {
      transform-origin: 0 0;
      transition: transform .55s cubic-bezier(.6,0,.3,1), opacity .35s ease .35s;
    }
    .drain-icon.draining .drain-lid {
      transform: rotate(230deg) translate(15px, -5px) scale(.3);
      opacity: 0;
    }
    .drain-rim { fill: #7c8894; stroke: #3d4750; stroke-width: 1; }
    .drain-face { fill: #b7c2cc; }
    .drain-slats line { stroke: #4b5860; stroke-width: 1.8; stroke-linecap: round; }
    .drain-bolt { fill: #333d45; }
    .drain-hinge { fill: #8a97a3; stroke: #46525c; stroke-width: 0.6; }

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
    .overlay p { margin: 0; opacity: .7; font-size: .9rem; }
    .overlay .emoji { font-size: 3rem; }

    .modal-backdrop {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(4, 10, 20, .72);
      backdrop-filter: blur(3px);
      z-index: 999;
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
      max-height: 90vh;
      overflow-y: auto;
      padding: 2rem 1.5rem;
      border-radius: calc(var(--og-radius, 16px) * 1.1);
      background: var(--og-bg, #0b1220);
      border: 1px solid color-mix(in srgb, var(--og-text) 14%, transparent);
      box-shadow: 0 24px 70px rgba(0,0,0,.55);
      text-align: center;
      animation: popIn .3s cubic-bezier(.34,1.56,.64,1) both;
    }
    :host([theme='light']) .modal-card { box-shadow: 0 24px 70px rgba(20,30,50,.18); }
    .modal-card h2 { margin: 0; font-size: 1.5rem; font-weight: 800; }
    .modal-card .emoji { font-size: 3rem; }

    .stats-row {
      display: flex;
      gap: .7rem;
    }
    .stat-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: .15rem;
      min-width: 92px;
      padding: .7rem .9rem;
      border-radius: 14px;
      background: color-mix(in srgb, var(--og-text) 6%, transparent);
      border: 1px solid color-mix(in srgb, var(--og-text) 14%, transparent);
      animation: popIn .35s cubic-bezier(.34,1.56,.64,1) both;
    }
    .stat-card.is-best {
      border-color: var(--og-accent, #ff9900);
      box-shadow: 0 0 0 1px var(--og-accent, #ff9900), 0 0 18px rgba(255,153,0,.35);
    }
    .stat-card:nth-child(2) { animation-delay: .08s; }
    .stat-icon { font-size: 1.3rem; line-height: 1; }
    .stat-value {
      font-size: 1.7rem;
      font-weight: 800;
      line-height: 1.1;
      font-variant-numeric: tabular-nums;
      color: var(--og-accent, #ff9900);
    }
    .stat-label {
      font-size: .65rem;
      font-weight: 700;
      letter-spacing: .04em;
      text-transform: uppercase;
      opacity: .65;
    }
    .best-badge {
      font-size: .7rem;
      font-weight: 700;
      color: var(--og-accent, #ff9900);
    }
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
      background: var(--og-primary, #0066cc);
      color: #fff;
      transition: transform .15s, filter .15s;
    }
    button.btn-primary:hover { filter: brightness(1.1); }
    button.btn-primary:active { transform: scale(.97); }
    button.btn-primary:focus-visible { outline: 3px solid var(--og-accent, #ff9900); outline-offset: 2px; }

    .sr-only {
      position: absolute;
      width: 1px; height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }

    @media (prefers-reduced-motion: reduce) {
      .maze.shake { animation: none; }
      .player-g { transition: none; }
      .drain-lid { transition: none; }
      .drain-hole { transition: none; }
      .progress-fill { transition: none; }
      .overlay { animation: none; }
      .stat-card { animation: none; }
      .modal-backdrop, .modal-card { animation: none; }
    }
  `;

  // ─── Public API (contract) ─────────────────────────────────────────────
  @property({ type: String }) mode: 'levels' | 'random' = 'levels';
  @property({ type: Number }) levelCount = 10;
  @property({ attribute: false }) state: GameState | null = null;
  @property({ type: Boolean }) muted = false;
  @property({ type: Number }) seed?: number;
  @property({ type: String, reflect: true }) theme: 'dark' | 'light' = 'dark';

  // ─── Internal state ─────────────────────────────────────────────────────
  @state() private _phase: Phase = 'idle';
  @state() private _maze!: MazeData;
  @state() private _playerIdx = 0;
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
  private _walkTimer = 0;
  private _drainTimer = 0;
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
    clearTimeout(this._walkTimer);
    clearTimeout(this._drainTimer);
    document.removeEventListener('visibilitychange', this._onVisibility);
  }

  // ─── Game flow ───────────────────────────────────────────────────────────
  private get _levelKey(): number {
    return this.mode === 'random' ? 0 : this._currentLevel;
  }

  private get _progress(): number {
    if (!this._maze) return 0;
    const total = this._maze.distFromExit[this._maze.startIdx] || 1;
    const remaining = this._maze.distFromExit[this._playerIdx] ?? total;
    return Math.max(0, Math.min(1, 1 - remaining / total));
  }

  private _startLevel() {
    cancelAnimationFrame(this._rafId);
    clearTimeout(this._walkTimer);
    clearTimeout(this._drainTimer);
    const size = this.mode === 'levels' ? sizeForLevel(this._currentLevel, this.levelCount) : RANDOM_SIZE;
    const rngSeed = this.seed != null ? this.seed + (this.mode === 'levels' ? this._currentLevel : 0) : undefined;
    const rng = rngSeed != null ? mulberry32(rngSeed) : undefined;

    const deadEndBias = this.mode === 'random' ? 0.65 : 0;
    this._maze = buildMaze(size, rng, deadEndBias);
    this._playerIdx = this._maze.startIdx;
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
  }

  private _tick() {
    this._rafId = requestAnimationFrame(() => {
      if (this._phase !== 'playing') return;
      this._elapsed = performance.now() - this._startTime;
      this._tick();
    });
  }

  private _handleKey(e: KeyboardEvent) {
    const map: Record<string, [number, number]> = {
      ArrowUp: [0, -1], w: [0, -1], W: [0, -1],
      ArrowDown: [0, 1], s: [0, 1], S: [0, 1],
      ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0],
      ArrowRight: [1, 0], d: [1, 0], D: [1, 0],
    };
    const dir = map[e.key];
    if (!dir) return;
    e.preventDefault();
    this._tryMove(dir[0], dir[1]);
  }

  /** Single-cell nudge — the keyboard-accessible fallback to click-to-path. */
  private _tryMove(dx: number, dy: number) {
    if (this._phase !== 'playing') return;
    clearTimeout(this._walkTimer);
    const maze = this._maze;
    const size = maze.size;
    const cx = this._playerIdx % size, cy = (this._playerIdx / size) | 0;
    const nx = cx + dx, ny = cy + dy;
    const outOfBounds = nx < 0 || nx >= size || ny < 0 || ny >= size;
    const wallBit = dx === 0 && dy === -1 ? 1 : dx === 1 && dy === 0 ? 2 : dx === 0 && dy === 1 ? 4 : 8;
    const blocked = outOfBounds || !!(maze.walls[this._playerIdx] & wallBit);

    if (blocked) {
      this._wallFeedback();
      return;
    }

    this._playerIdx = ny * size + nx;
    this._moves++;
    this._playTone('step');
    if (this._playerIdx === maze.exitIdx) this._beginWinSequence();
  }

  /**
   * Click/tap-to-slide. This deliberately does NOT pathfind to the clicked
   * cell — that would let a player reach the door by clicking it once
   * without ever solving the maze. Instead the click only picks a cardinal
   * direction (whichever axis — horizontal or vertical — the click is more
   * offset along), and the octopus slides one cell at a time in that exact
   * direction until the maze forces a decision: a wall (dead end), a
   * junction, or a bend. The player has to click again at every such point.
   */
  private _handlePointerDown(e: PointerEvent) {
    if (this._phase !== 'playing') return;
    const svgEl = e.currentTarget as SVGSVGElement;
    svgEl.focus();
    const pt = svgEl.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svgEl.getScreenCTM();
    if (!ctm) return;
    const local = pt.matrixTransform(ctm.inverse());
    const size = this._maze.size;
    const cx = Math.floor((local.x - MAZE_PAD) / CELL_PX);
    const cy = Math.floor((local.y - MAZE_PAD) / CELL_PX);
    if (cx < 0 || cx >= size || cy < 0 || cy >= size) return;

    const px = this._playerIdx % size, py = (this._playerIdx / size) | 0;
    const dx = cx - px, dy = cy - py;
    if (dx === 0 && dy === 0) return;

    // Dominant axis decides the slide direction; ties favor horizontal.
    if (Math.abs(dx) >= Math.abs(dy)) {
      this._slide(Math.sign(dx), 0);
    } else {
      this._slide(0, Math.sign(dy));
    }
  }

  private _slide(dx: number, dy: number) {
    clearTimeout(this._walkTimer);
    const path = this._buildSlidePath(dx, dy);
    if (!path.length) {
      this._wallFeedback();
      return;
    }
    this._walkPath(path);
  }

  /**
   * Steps from the player's cell in a single cardinal direction, stopping
   * the instant the maze offers (or forces) a choice: only a cell whose
   * *sole* two openings are "where we came from" and "straight ahead" gets
   * passed through automatically. A junction (3+ openings) or a bend (2
   * openings that aren't opposite each other) ends the slide there.
   */
  private _buildSlidePath(dx: number, dy: number): number[] {
    const { walls, size, exitIdx } = this._maze;
    const wallBit = dx === 0 && dy === -1 ? 1 : dx === 1 && dy === 0 ? 2 : dx === 0 && dy === 1 ? 4 : 8;
    const backBit = dx === 0 && dy === -1 ? 4 : dx === 1 && dy === 0 ? 8 : dx === 0 && dy === 1 ? 1 : 2;

    const path: number[] = [];
    let cur = this._playerIdx;
    for (;;) {
      const cx = cur % size, cy = (cur / size) | 0;
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || nx >= size || ny < 0 || ny >= size) break;
      if (walls[cur] & wallBit) break; // wall straight ahead — nothing to do

      cur = ny * size + nx;
      path.push(cur);
      if (cur === exitIdx) break;

      const w = walls[cur];
      const openings = (w & 1 ? 0 : 1) + (w & 2 ? 0 : 1) + (w & 4 ? 0 : 1) + (w & 8 ? 0 : 1);
      const isPassThrough = openings === 2 && !(w & wallBit) && !(w & backBit);
      if (!isPassThrough) break;
    }
    return path;
  }

  private _walkPath(path: number[]) {
    clearTimeout(this._walkTimer);
    if (!path.length) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const stepMs = reduced ? 0 : STEP_MS;
    const advance = (i: number) => {
      if (this._phase !== 'playing') return;
      this._playerIdx = path[i];
      this._moves++;
      this._playTone('step');
      if (this._playerIdx === this._maze.exitIdx) {
        this._beginWinSequence();
        return;
      }
      if (i + 1 < path.length) {
        this._walkTimer = window.setTimeout(() => advance(i + 1), stepMs);
      }
    };
    advance(0);
  }

  private _wallFeedback() {
    this._playTone('bump');
    this._shaking = true;
    clearTimeout(this._shakeTimeout);
    this._shakeTimeout = window.setTimeout(() => { this._shaking = false; }, 320);
  }

  /**
   * Reaching the drain locks controls immediately (phase leaves 'playing',
   * so every move handler's phase guard rejects further input) and kicks
   * off the lid-opening/octopus-sinking visuals. The actual win bookkeeping
   * (stats, dispatch, persistence) is deferred until the visuals finish so
   * the "Tebrikler!" modal lands right as the octopus disappears.
   */
  private _beginWinSequence() {
    cancelAnimationFrame(this._rafId);
    clearTimeout(this._walkTimer);
    clearTimeout(this._drainTimer);
    this._phase = 'draining';
    this._playTone('win');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this._drainTimer = window.setTimeout(() => this._handleWin(), reduced ? 0 : DRAIN_ANIMATION_MS);
  }

  private _handleWin() {
    const durationMs = Math.round(this._elapsed);
    const key = this._levelKey;
    // "Yeni Rekor" must reflect the single fastest time across every level
    // played so far, not just this level's own best — otherwise a slower
    // run on a level with no prior record incorrectly reads as a record.
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

  private _nextLevel() {
    if (this.mode === 'levels') {
      const isLast = this._currentLevel >= this.levelCount;
      this._currentLevel = isLast ? 1 : this._currentLevel + 1;
    }
    this._startLevel();
  }

  private _toggleTheme() {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    this._dispatch('og-theme-change', { gameId: GAME_ID, theme: this.theme });
  }

  // ─── Audio (Web Audio API) ──────────────────────────────────────────────
  private _audioCtx() {
    if (!this._ctx) this._ctx = new AudioContext();
    if (this._ctx.state === 'suspended') this._ctx.resume().catch(() => {});
    return this._ctx;
  }

  private _playTone(kind: 'step' | 'bump' | 'win') {
    if (this.muted) return;
    try {
      const ctx = this._audioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      if (kind === 'step') {
        osc.frequency.setValueAtTime(340, ctx.currentTime);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.start(); osc.stop(ctx.currentTime + 0.08);
      } else if (kind === 'bump') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(140, ctx.currentTime);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
        osc.start(); osc.stop(ctx.currentTime + 0.18);
      } else {
        osc.frequency.setValueAtTime(500, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.16, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.start(); osc.stop(ctx.currentTime + 0.35);
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
        aria-label=${isLight ? 'Koyu temaya geç' : 'Açık temaya geç'}
        title=${isLight ? 'Koyu tema' : 'Açık tema'}
      >${isLight ? '☀️' : '🌙'}</button>
    `;
  }

  private _renderHUD() {
    const secs = Math.floor(this._elapsed / 1000);
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    return html`
      <div class="hud" part="hud">
        <div class="hud-left">
          ${this._renderThemeToggle()}
          <slot name="host-controls"></slot>
        </div>
        <div class="level-chip">
          ${this.mode === 'levels' ? html`Seviye ${this._currentLevel}/${this.levelCount}` : html`Serbest Mod`}
          · ${m}:${s}
        </div>
      </div>
    `;
  }

  private _renderProgress() {
    const pct = Math.round(this._progress * 100);
    return html`
      <div
        class="progress-track"
        role="progressbar"
        aria-valuenow=${pct}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-label="Kapıya ilerleme"
      >
        <div class="progress-fill" style="width:${pct}%"></div>
      </div>
    `;
  }

  /**
   * Vector "gider" (drain) icon marking the exit — replaces the door emoji.
   * While `isDraining`, the lid (rim/face/slats/bolt/hinge) spins and slides
   * away via CSS, uncovering the dark hole circle rendered underneath it.
   */
  private _renderDrainIcon(cx: number, cy: number, isDraining: boolean) {
    const r = CELL_PX * 0.34;
    const slatCount = 6;
    const slats = [];
    for (let i = 0; i < slatCount; i++) {
      const t = (i / (slatCount - 1)) * 2 - 1; // -1..1 across the grate
      const off = t * (r - 1.5);
      slats.push(svg`<line x1=${off - r * 0.55} y1=${-r * 0.85} x2=${off + r * 0.55} y2=${r * 0.85}></line>`);
    }
    return svg`
      <radialGradient id="drain-hole-grad" cx="50%" cy="42%" r="65%">
        <stop offset="0%" stop-color="#000"></stop>
        <stop offset="70%" stop-color="#000"></stop>
        <stop offset="100%" stop-color="#101a24"></stop>
      </radialGradient>
      <circle
        class="drain-hole ${isDraining ? 'is-open' : ''}"
        cx=${cx} cy=${cy} r=${r - 1}
      ></circle>
      <g class="drain-icon ${isDraining ? 'draining' : ''}" transform="translate(${cx} ${cy})">
        <g class="drain-lid">
          <clipPath id="drain-clip">
            <circle r=${r}></circle>
          </clipPath>
          <circle class="drain-rim" r=${r + 1.6}></circle>
          <g clip-path="url(#drain-clip)">
            <circle class="drain-face" r=${r}></circle>
            <g class="drain-slats">${slats}</g>
          </g>
          <circle class="drain-bolt" r=${r * 0.14}></circle>
          <rect class="drain-hinge" x=${-r - 2.6} y=${-r * 0.16} width="2.6" height=${r * 0.32} rx="0.7"></rect>
        </g>
      </g>
    `;
  }

  private _renderMaze() {
    const maze = this._maze;
    const size = maze.size;
    const viewSize = size * CELL_PX + MAZE_PAD * 2;
    const wallEls = [];

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        const w = maze.walls[i];
        const x0 = MAZE_PAD + x * CELL_PX, y0 = MAZE_PAD + y * CELL_PX;
        const x1 = x0 + CELL_PX, y1 = y0 + CELL_PX;
        if (w & 1) wallEls.push(svg`<line class="wall" x1=${x0} y1=${y0} x2=${x1} y2=${y0}></line>`);
        if (w & 2) wallEls.push(svg`<line class="wall" x1=${x1} y1=${y0} x2=${x1} y2=${y1}></line>`);
        if (w & 4) wallEls.push(svg`<line class="wall" x1=${x0} y1=${y1} x2=${x1} y2=${y1}></line>`);
        if (w & 8) wallEls.push(svg`<line class="wall" x1=${x0} y1=${y0} x2=${x0} y2=${y1}></line>`);
      }
    }

    const exitX = maze.exitIdx % size, exitY = (maze.exitIdx / size) | 0;
    const exCellX = MAZE_PAD + exitX * CELL_PX, exCellY = MAZE_PAD + exitY * CELL_PX;
    const ex = exCellX + CELL_PX / 2, ey = exCellY + CELL_PX / 2;
    const plX = this._playerIdx % size, plY = (this._playerIdx / size) | 0;
    const px = MAZE_PAD + (plX + 0.5) * CELL_PX, py = MAZE_PAD + (plY + 0.5) * CELL_PX;
    const isDraining = this._phase === 'draining' || this._phase === 'won';

    return html`
      <div class="board-wrap">
        <svg
          part="board"
          class="maze ${this._shaking ? 'shake' : ''}"
          viewBox="0 0 ${viewSize} ${viewSize}"
          role="application"
          aria-label="Octapus tahtası. Kapıya ilerleme yüzde ${Math.round(this._progress * 100)}. Bir hücreye tıklayarak ya da ok tuşları/WASD ile hareket et."
          tabindex="0"
          @keydown=${this._handleKey}
          @pointerdown=${this._handlePointerDown}
        >
          ${wallEls}
          <rect class="exit-cell" x=${exCellX} y=${exCellY} width=${CELL_PX} height=${CELL_PX} rx="4"></rect>
          ${this._renderDrainIcon(ex, ey, isDraining)}
          <g
            class="player-g ${isDraining ? 'sinking' : ''}"
            transform="translate(${px} ${py}) ${isDraining ? 'scale(0.12)' : ''}"
          >
            <text class="player-emoji" text-anchor="middle" dominant-baseline="central">🐙</text>
          </g>
        </svg>
      </div>
    `;
  }

  private _renderIdle() {
    return html`
      <div class="overlay">
        <div class="emoji">🐙</div>
        <h2>Octapus</h2>
        <p>Ahtapotu kaçış giderine ulaştır. Bir yola tıkla, ahtapot süzülsün.</p>
        <button class="btn-primary" part="button" @click=${this._startLevel} aria-label="Oyunu başlat">Başla</button>
        ${this._renderThemeToggle()}
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
          <div class="emoji">${isGameComplete ? '🏆' : '✨'}</div>
          <h2>${isGameComplete ? 'Tebrikler!' : 'Seviye Tamam!'}</h2>
          <div class="stats-row">
            <div class="stat-card ${this._lastResultIsBest ? 'is-best' : ''}">
              <span class="stat-icon">⏱️</span>
              <span class="stat-value">${m}:${s}</span>
              <span class="stat-label">Süre</span>
            </div>
            <div class="stat-card">
              <span class="stat-icon">👣</span>
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
    return html`
      ${this._renderHUD()}
      ${this._renderProgress()}
      ${this._renderMaze()}
      ${this._phase === 'won' ? this._renderWon() : nothing}
      <div class="sr-only" aria-live="polite">${this._announce}</div>
    `;
  }
}
