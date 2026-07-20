import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import './index';
import type { OctapusGame } from './game';

// jsdom doesn't implement matchMedia; game.ts calls it to respect
// prefers-reduced-motion, so every test needs a stub.
beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
});

function createGame(): OctapusGame {
  return document.createElement('og-octapus') as OctapusGame;
}

describe('og-octapus event contract', () => {
  let el: OctapusGame;

  afterEach(() => {
    el?.remove();
  });

  it('dispatches og-ready with { gameId } as soon as it connects', () => {
    el = createGame();
    const handler = vi.fn();
    el.addEventListener('og-ready', handler);
    document.body.appendChild(el);

    expect(handler).toHaveBeenCalledTimes(1);
    expect((handler.mock.calls[0][0] as CustomEvent).detail).toEqual({ gameId: 'game-octapus' });
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
    expect(detail.gameId).toBe('game-octapus');
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

      // Reaching the exit cell is what the real game checks for on every
      // move; jumping the player there directly exercises the same win
      // path without needing to solve a generated maze in a test.
      const internals = el as unknown as { _maze: { exitIdx: number }; _playerIdx: number; _beginWinSequence(): void };
      internals._playerIdx = internals._maze.exitIdx;
      internals._beginWinSequence();

      expect(order).toEqual([]); // still mid-animation, controls locked, no result yet

      await vi.runAllTimersAsync();

      expect(order).toEqual(['og-level-complete', 'og-state-change']);
    } finally {
      vi.useRealTimers();
    }
  });
});
