import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import './index';
import type { OctafortGame } from './game';

// jsdom doesn't implement matchMedia; game.ts calls it to respect
// prefers-reduced-motion, so every test needs a stub.
beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
});

function createGame(): OctafortGame {
  return document.createElement('og-octafort') as OctafortGame;
}

// Internal shape reached into by the tests to drive the win path without
// solving a generated puzzle by hand.
interface Internals {
  _size: number;
  _puzzle: { size: number; regions: Uint8Array; solution: Uint8Array };
  _cells: Uint8Array;
  _beginWin(): void;
  _analyze(): { conflicts: Set<number>; attacked: Set<number>; towerCount: number };
}

describe('og-octafort event contract', () => {
  let el: OctafortGame;

  afterEach(() => {
    el?.remove();
  });

  it('dispatches og-ready with { gameId } as soon as it connects', () => {
    el = createGame();
    const handler = vi.fn();
    el.addEventListener('og-ready', handler);
    document.body.appendChild(el);

    expect(handler).toHaveBeenCalledTimes(1);
    expect((handler.mock.calls[0][0] as CustomEvent).detail).toEqual({ gameId: 'game-octafort' });
  });

  it('dispatches og-level-start with { gameId, level, startedAt } when play begins', async () => {
    el = createGame();
    document.body.appendChild(el);
    await el.updateComplete;

    const handler = vi.fn();
    el.addEventListener('og-level-start', handler);
    const startButton = el.shadowRoot!.querySelector('button') as HTMLButtonElement;
    startButton.click();

    expect(handler).toHaveBeenCalledTimes(1);
    const detail = (handler.mock.calls[0][0] as CustomEvent).detail as Record<string, unknown>;
    expect(detail.gameId).toBe('game-octafort');
    expect(detail.level).toBe(1);
    expect(typeof detail.startedAt).toBe('string');
  });

  it('fires og-level-complete before og-state-change, after the win animation finishes', async () => {
    vi.useFakeTimers();
    try {
      el = createGame();
      document.body.appendChild(el);
      await el.updateComplete;
      (el.shadowRoot!.querySelector('button') as HTMLButtonElement).click();

      const order: string[] = [];
      el.addEventListener('og-level-complete', (e) => order.push((e as CustomEvent).type));
      el.addEventListener('og-state-change', (e) => order.push((e as CustomEvent).type));

      // Filling the grid with the generator's reference solution is exactly the
      // board state the real game detects as a win; setting it directly and
      // starting the win sequence exercises the same path without solving a
      // generated puzzle in the test.
      const internals = el as unknown as Internals;
      internals._cells = Uint8Array.from(internals._puzzle.solution).map((v) => (v ? 2 : 0));
      internals._beginWin();

      expect(order).toEqual([]); // still mid-animation, controls locked, no result yet

      await vi.runAllTimersAsync();

      expect(order).toEqual(['og-level-complete', 'og-state-change']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('defaults to the dark theme and reflects the theme property to an attribute', async () => {
    el = createGame();
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.getAttribute('theme')).toBe('dark');

    el.theme = 'light';
    await el.updateComplete;
    expect(el.getAttribute('theme')).toBe('light');
  });

  it('recognises the reference solution as a conflict-free win state', async () => {
    el = createGame();
    document.body.appendChild(el);
    await el.updateComplete;
    (el.shadowRoot!.querySelector('button') as HTMLButtonElement).click();

    const internals = el as unknown as Internals;
    internals._cells = Uint8Array.from(internals._puzzle.solution).map((v) => (v ? 2 : 0));
    const { conflicts, towerCount } = internals._analyze();

    expect(towerCount).toBe(internals._size);
    expect(conflicts.size).toBe(0);
  });
});

describe('og-octafort puzzle generation', () => {
  it('produces a solvable, region-consistent puzzle across generated sizes', async () => {
    for (const seed of [1, 7, 42, 123, 2024]) {
      const el = createGame();
      el.seed = seed;
      document.body.appendChild(el);
      await el.updateComplete;
      (el.shadowRoot!.querySelector('button') as HTMLButtonElement).click();

      const internals = el as unknown as Internals;
      const { size, regions, solution } = internals._puzzle;

      // Every cell belongs to a valid region id, and all `size` regions exist.
      const seenRegions = new Set<number>();
      for (const rg of regions) {
        expect(rg).toBeGreaterThanOrEqual(0);
        expect(rg).toBeLessThan(size);
        seenRegions.add(rg);
      }
      expect(seenRegions.size).toBe(size);

      // The reference solution: one tower per row, per column, per region,
      // and no two touching (including diagonally).
      const towers: number[] = [];
      for (let i = 0; i < solution.length; i++) if (solution[i]) towers.push(i);
      expect(towers.length).toBe(size);

      const rows = new Set(towers.map((t) => (t / size) | 0));
      const cols = new Set(towers.map((t) => t % size));
      const regs = new Set(towers.map((t) => regions[t]));
      expect(rows.size).toBe(size);
      expect(cols.size).toBe(size);
      expect(regs.size).toBe(size);

      for (let i = 0; i < towers.length; i++) {
        for (let j = i + 1; j < towers.length; j++) {
          const ax = towers[i] % size, ay = (towers[i] / size) | 0;
          const bx = towers[j] % size, by = (towers[j] / size) | 0;
          const touching = Math.abs(ax - bx) <= 1 && Math.abs(ay - by) <= 1;
          expect(touching).toBe(false);
        }
      }

      el.remove();
    }
  });
});
