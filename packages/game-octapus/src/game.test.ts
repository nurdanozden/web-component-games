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
    const startButton = el.shadowRoot!.querySelector('button.btn-primary') as HTMLButtonElement;
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
      (el.shadowRoot!.querySelector('button.btn-primary') as HTMLButtonElement).click();

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

describe('og-octapus settings menu', () => {
  let el: OctapusGame;

  afterEach(() => {
    el?.remove();
  });

  const trigger = () => el.shadowRoot!.querySelector<HTMLButtonElement>('.settings-trigger')!;
  const isOpen = () => el.shadowRoot!.querySelector('.settings')!.classList.contains('is-open');

  async function mount(): Promise<void> {
    el = createGame();
    document.body.appendChild(el);
    await el.updateComplete;
  }

  it('keeps language, theme and the host-controls slot inside the menu, not on the bar', async () => {
    await mount();
    const panel = el.shadowRoot!.querySelector('.settings-panel')!;

    expect(panel.querySelector('.lang-picker select')).not.toBeNull();
    expect(panel.querySelector('button.theme-toggle')).not.toBeNull();
    expect(panel.querySelector('slot[name="host-controls"]')).not.toBeNull();
    // Nothing may sit outside the panel — that is the whole point of the move.
    expect(el.shadowRoot!.querySelectorAll('.lang-picker')).toHaveLength(1);
    expect(el.shadowRoot!.querySelectorAll('slot[name="host-controls"]')).toHaveLength(1);
  });

  it('opens on the kebab button and closes when it is pressed again', async () => {
    await mount();
    expect(isOpen()).toBe(false);
    expect(trigger().getAttribute('aria-expanded')).toBe('false');

    trigger().click();
    await el.updateComplete;
    expect(isOpen()).toBe(true);
    expect(trigger().getAttribute('aria-expanded')).toBe('true');

    trigger().click();
    await el.updateComplete;
    expect(isOpen()).toBe(false);
  });

  it('closes on an outside click and on Escape', async () => {
    await mount();

    trigger().click();
    await el.updateComplete;
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true }));
    await el.updateComplete;
    expect(isOpen()).toBe(false);

    trigger().click();
    await el.updateComplete;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await el.updateComplete;
    expect(isOpen()).toBe(false);
  });

  it('stays open when the click lands inside the panel', async () => {
    await mount();
    trigger().click();
    await el.updateComplete;

    const themeButton = el.shadowRoot!.querySelector<HTMLButtonElement>('button.theme-toggle')!;
    themeButton.dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true }));
    themeButton.click();
    await el.updateComplete;

    expect(el.theme).toBe('light');
    expect(isOpen()).toBe(true);
  });

  it('drops its document listeners when the game is removed', async () => {
    await mount();
    trigger().click();
    await el.updateComplete;

    const removeSpy = vi.spyOn(document, 'removeEventListener');
    el.remove();
    const removed = removeSpy.mock.calls.map((c) => c[0]);
    expect(removed).toContain('pointerdown');
    expect(removed).toContain('keydown');
    removeSpy.mockRestore();
  });
});
