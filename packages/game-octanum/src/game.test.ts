import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import './index';
import type { OctanumGame } from './game';
import { combine, scoreFor, difficultyFor } from './game';
import { solve, type Op, type SolutionStep } from './solver';
import {
  FREE_MODE_TIME_MS,
  RANDOM_MODE_DIFFICULTY,
  stepsFor,
  type Round,
} from './round';

// jsdom matchMedia'yı uygulamıyor; game.ts prefers-reduced-motion'a saygı
// göstermek için çağırdığından her testte bir stub gerekiyor.
beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
});

function createGame(): OctanumGame {
  return document.createElement('og-octanum') as OctanumGame;
}

/** Testlerin oyunu sürmek için uzandığı iç yapı. */
interface Internals {
  _round: Round;
  _cards: { id: number; value: number; derived: boolean }[];
  _history: unknown[];
  _currentLevel: number;
  _remainingMs: number;
}

function internals(el: OctanumGame): Internals {
  return el as unknown as Internals;
}

function start(el: OctanumGame) {
  (el.shadowRoot!.querySelector('button.btn-primary') as HTMLButtonElement).click();
}

function vials(el: OctanumGame): HTMLButtonElement[] {
  return [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('button.vial')];
}

function vialValue(btn: HTMLButtonElement): number {
  return Number(btn.querySelector('.value')!.textContent);
}

function values(el: OctanumGame): number[] {
  return vials(el).map(vialValue);
}

const OP_SYMBOL: Record<Op, string> = { '+': '+', '-': '−', '*': '×', '/': '÷' };

function opButton(el: OctanumGame, op: Op): HTMLButtonElement {
  const btn = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('button.op')]
    .find((b) => b.textContent?.trim() === OP_SYMBOL[op]);
  if (!btn) throw new Error(`${op} kazanı yok`);
  return btn;
}

function actionButton(el: OctanumGame, label: 'undo' | 'reset' | 'finish'): HTMLButtonElement {
  const index = { undo: 0, reset: 1, finish: 2 }[label];
  return [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('.actions button')][index];
}

/** İstenen değerdeki (varsa henüz seçilmemiş) şişeye tıklar. */
function clickValue(el: OctanumGame, value: number) {
  const btn = vials(el).find(
    (b) => vialValue(b) === value && b.getAttribute('aria-pressed') !== 'true',
  );
  if (!btn) throw new Error(`Sahnede ${value} değerinde şişe yok: ${values(el).join(', ')}`);
  btn.click();
}

/** Bir karışımı arayüz üzerinden oynar: bileşen → kazan → bileşen. */
async function play(el: OctanumGame, step: SolutionStep) {
  clickValue(el, step.a);
  await el.updateComplete;
  opButton(el, step.op).click();
  await el.updateComplete;
  clickValue(el, step.b);
  await el.updateComplete;
}

/** Üretim aşamasında doğrulanan çözümü baştan sona oynar. */
async function playSolution(el: OctanumGame) {
  for (const step of internals(el)._round.solution) await play(el, step);
}

// ─── Sözleşme ───────────────────────────────────────────────────────────────

describe('og-octanum sözleşme event akışı', () => {
  let el: OctanumGame;

  afterEach(() => {
    el?.remove();
  });

  it('bağlanır bağlanmaz og-ready yayınlar', () => {
    el = createGame();
    const handler = vi.fn();
    el.addEventListener('og-ready', handler);
    document.body.appendChild(el);

    expect(handler).toHaveBeenCalledTimes(1);
    expect((handler.mock.calls[0][0] as CustomEvent).detail).toEqual({ gameId: 'game-octanum' });
  });

  it('tur başlayınca og-level-start yayınlar', async () => {
    el = createGame();
    document.body.appendChild(el);
    await el.updateComplete;

    const handler = vi.fn();
    el.addEventListener('og-level-start', handler);
    start(el);

    expect(handler).toHaveBeenCalledTimes(1);
    const detail = (handler.mock.calls[0][0] as CustomEvent).detail as Record<string, unknown>;
    expect(detail.gameId).toBe('game-octanum');
    expect(detail.level).toBe(1);
    expect(typeof detail.startedAt).toBe('string');
  });

  it('tam isabette önce og-level-complete, sonra og-state-change yayınlar', async () => {
    vi.useFakeTimers();
    try {
      el = createGame();
      el.seed = 3;
      document.body.appendChild(el);
      await el.updateComplete;
      start(el);
      await el.updateComplete;

      const order: string[] = [];
      let complete: Record<string, unknown> = {};
      let saved: GameStateLike = {} as GameStateLike;
      el.addEventListener('og-level-complete', (e) => {
        order.push(e.type);
        complete = (e as CustomEvent).detail;
      });
      el.addEventListener('og-state-change', (e) => {
        order.push(e.type);
        saved = (e as CustomEvent).detail.state;
      });

      const solution = internals(el)._round.solution;
      await playSolution(el);

      expect(order).toEqual([]); // kutlama sürerken sonuç henüz işlenmez

      await vi.runAllTimersAsync();

      expect(order).toEqual(['og-level-complete', 'og-state-change']);
      expect(complete.level).toBe(1);
      expect(complete.moves).toBe(solution.length);
      expect(complete.score).toBeGreaterThanOrEqual(100); // tam isabet tabanı
      expect(typeof complete.durationMs).toBe('number');
      // Puana dayalı oyun: bestScores dolar, seviye bir ilerler.
      expect(saved.bestScores).toBeDefined();
      expect(saved.currentLevel).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('tam isabet olmadan bitirilen tur og-level-fail yayınlar ve seviyeyi ilerletmez', async () => {
    vi.useFakeTimers();
    try {
      el = createGame();
      el.seed = 5;
      document.body.appendChild(el);
      await el.updateComplete;
      start(el);
      await el.updateComplete;

      const failed = vi.fn();
      const changed = vi.fn();
      el.addEventListener('og-level-fail', failed);
      el.addEventListener('og-state-change', changed);

      actionButton(el, 'finish').click();
      await vi.runAllTimersAsync();

      expect(failed).toHaveBeenCalledTimes(1);
      expect((failed.mock.calls[0][0] as CustomEvent).detail).toEqual({
        gameId: 'game-octanum',
        level: 1,
        reason: 'inexact',
      });
      expect((changed.mock.calls[0][0] as CustomEvent).detail.state.currentLevel).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('süre dolunca turu kendiliğinden bitirir', async () => {
    vi.useFakeTimers();
    // Sayaç performance.now() üzerinden ilerler; sahte zamanlayıcılar bu saati
    // kapsamadığı için kendimiz ileri sarıyoruz. (Aksi hâlde her karede yeniden
    // kurulan rAF döngüsü hiç bitmez.)
    let clock = 0;
    const nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => clock);
    try {
      el = createGame();
      el.seed = 9;
      document.body.appendChild(el);
      await el.updateComplete;
      start(el);
      await el.updateComplete;

      const failed = vi.fn();
      el.addEventListener('og-level-fail', failed);

      // En uzun tur 150 saniyedir; fazlasıyla ilerletmek sayacı sıfırlar.
      clock += 160_000;
      await vi.advanceTimersByTimeAsync(50); // bir sonraki kare sayacı görsün
      await vi.runAllTimersAsync();

      expect(failed).toHaveBeenCalledTimes(1);
      expect((failed.mock.calls[0][0] as CustomEvent).detail.reason).toBe('time-up');
      expect(internals(el)._remainingMs).toBe(0);
    } finally {
      nowSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it('son seviye tam isabetle bitince og-game-complete yayınlar', async () => {
    vi.useFakeTimers();
    try {
      el = createGame();
      el.levelCount = 3;
      el.seed = 2;
      el.state = {
        version: 1,
        gameId: 'game-octanum',
        currentLevel: 3,
        completedLevels: [],
        bestTimes: {},
        totalPlayMs: 0,
      };
      document.body.appendChild(el);
      await el.updateComplete;
      start(el);
      await el.updateComplete;

      const done = vi.fn();
      el.addEventListener('og-game-complete', done);
      await playSolution(el);
      await vi.runAllTimersAsync();

      expect(done).toHaveBeenCalledTimes(1);
      expect((done.mock.calls[0][0] as CustomEvent).detail.gameId).toBe('game-octanum');
    } finally {
      vi.useRealTimers();
    }
  });

  it('verilen state ile kaldığı seviyeden devam eder', async () => {
    el = createGame();
    el.state = {
      version: 1,
      gameId: 'game-octanum',
      currentLevel: 4,
      completedLevels: [],
      bestTimes: {},
      bestScores: {},
      totalPlayMs: 12345,
    };
    document.body.appendChild(el);
    await el.updateComplete;

    const handler = vi.fn();
    el.addEventListener('og-level-start', handler);
    start(el);

    expect((handler.mock.calls[0][0] as CustomEvent).detail.level).toBe(4);
  });

  it('koyu temayla açılır ve theme özelliğini attribute olarak yansıtır', async () => {
    el = createGame();
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.getAttribute('theme')).toBe('dark');

    el.theme = 'light';
    await el.updateComplete;
    expect(el.getAttribute('theme')).toBe('light');
  });
});

interface GameStateLike {
  currentLevel: number;
  bestScores?: Record<number, number>;
}

// ─── Oynanış ────────────────────────────────────────────────────────────────

describe('og-octanum oynanış', () => {
  let el: OctanumGame;

  afterEach(() => {
    el?.remove();
  });

  async function begin(seed = 1): Promise<OctanumGame> {
    el = createGame();
    el.seed = seed;
    document.body.appendChild(el);
    await el.updateComplete;
    start(el);
    await el.updateComplete;
    return el;
  }

  it('altı bileşenle ve üretilen hedefle başlar', async () => {
    await begin();
    expect(vials(el)).toHaveLength(6);
    expect(values(el)).toEqual(internals(el)._round.numbers);
    expect(el.shadowRoot!.querySelector('.target-value')!.textContent).toBe(
      String(internals(el)._round.target),
    );
  });

  it('iki bileşeni sahneden kaldırıp yerine sonucu koyar', async () => {
    await begin();
    const before = values(el);
    const [a, b] = before;

    await play(el, { a, op: '+', b, result: a + b });

    const after = values(el);
    expect(after).toHaveLength(5);
    expect(after).toContain(a + b);
    // Sonuç, ilk operandın yerine oturur.
    expect(after[0]).toBe(a + b);
  });

  it('geri al son karışımı bozar ve kartları eski yerlerine koyar', async () => {
    await begin();
    const before = values(el);
    await play(el, { a: before[1], op: '+', b: before[3], result: before[1] + before[3] });
    expect(values(el)).toHaveLength(5);

    actionButton(el, 'undo').click();
    await el.updateComplete;

    expect(values(el)).toEqual(before);
    expect(internals(el)._history).toHaveLength(0);
  });

  it('sıfırla bütün karışımları bozup ilk altı bileşene döner', async () => {
    await begin();
    const before = values(el);
    await play(el, { a: before[0], op: '+', b: before[1], result: before[0] + before[1] });
    await play(el, { a: before[2], op: '+', b: before[3], result: before[2] + before[3] });
    expect(values(el)).toHaveLength(4);

    actionButton(el, 'reset').click();
    await el.updateComplete;

    expect(values(el)).toEqual(before);
    expect(internals(el)._history).toHaveLength(0);
  });

  it('geri al ve sıfırla hiç karışım yokken pasiftir', async () => {
    await begin();
    expect(actionButton(el, 'undo').disabled).toBe(true);
    expect(actionButton(el, 'reset').disabled).toBe(true);
    expect(actionButton(el, 'finish').disabled).toBe(false);
  });

  it('aynı şişeye ikinci dokunuş seçimi bırakır', async () => {
    await begin();
    const first = vials(el)[0];
    first.click();
    await el.updateComplete;
    expect(vials(el)[0].getAttribute('aria-pressed')).toBe('true');

    vials(el)[0].click();
    await el.updateComplete;
    expect(vials(el)[0].getAttribute('aria-pressed')).toBe('false');
  });

  it('eksi sonuç doğuracak çıkarmayı baştan engeller', async () => {
    await begin();
    // Sahnedeki en küçük bileşeni seçip çıkarma kazanını aç: kendisinden büyük
    // her şişe pasifleşmeli (A ≥ B kuralı).
    const smallest = Math.min(...values(el));
    clickValue(el, smallest);
    await el.updateComplete;
    opButton(el, '-').click();
    await el.updateComplete;

    for (const btn of vials(el)) {
      const v = vialValue(btn);
      if (btn.getAttribute('aria-pressed') === 'true') continue;
      expect(btn.disabled, `${smallest} − ${v}`).toBe(v > smallest);
    }
  });

  it('tam bölünmeyen bölmeyi baştan engeller', async () => {
    await begin();
    const largest = Math.max(...values(el));
    clickValue(el, largest);
    await el.updateComplete;
    opButton(el, '/').click();
    await el.updateComplete;

    for (const btn of vials(el)) {
      if (btn.getAttribute('aria-pressed') === 'true') continue;
      const v = vialValue(btn);
      expect(btn.disabled, `${largest} ÷ ${v}`).toBe(largest % v !== 0);
    }
  });

  it('karışım defterine her adımı yazar', async () => {
    await begin();
    const [a, b] = values(el);
    await play(el, { a, op: '*', b, result: a * b });

    const entries = [...el.shadowRoot!.querySelectorAll('.log li')];
    expect(entries).toHaveLength(1);
    expect(entries[0].textContent!.replace(/\s+/g, ' ').trim()).toBe(`${a} × ${b} = ${a * b}`);
  });

  it('üretilen çözüm arayüzde oynandığında tam isabetle biter', async () => {
    vi.useFakeTimers();
    try {
      for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
        const game = createGame();
        game.seed = seed;
        document.body.appendChild(game);
        await game.updateComplete;
        start(game);
        await game.updateComplete;

        const { target } = internals(game)._round;
        await playSolution(game);
        await vi.runAllTimersAsync();

        // Hedefe ulaşıldığı an tur kendiliğinden biter: sonuç paneli açılır.
        expect(game.shadowRoot!.querySelector('.result'), `seed ${seed}`).not.toBeNull();
        expect(values(game)).toContain(target);
        game.remove();
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it('her turda hedefe ulaşmanın bir yolu vardır', async () => {
    for (const seed of [10, 11, 12, 13, 14]) {
      for (const level of [1, 4, 8]) {
        const game = createGame();
        game.levelCount = 8;
        game.seed = seed;
        game.state = {
          version: 1,
          gameId: 'game-octanum',
          currentLevel: level,
          completedLevels: [],
          bestTimes: {},
          totalPlayMs: 0,
        };
        document.body.appendChild(game);
        await game.updateComplete;
        start(game);

        const { numbers, target } = internals(game)._round;
        expect(solve(numbers, target).exact, `seed ${seed} seviye ${level}`).toBe(true);
        game.remove();
      }
    }
  });

  it('aynı seed aynı turu üretir', async () => {
    const rounds: Round[] = [];
    for (const seed of [42, 42]) {
      const game = createGame();
      game.seed = seed;
      document.body.appendChild(game);
      await game.updateComplete;
      start(game);
      rounds.push(internals(game)._round);
      game.remove();
    }
    expect(rounds[0].numbers).toEqual(rounds[1].numbers);
    expect(rounds[0].target).toBe(rounds[1].target);
  });

  it('süre her seviyede aynı kalır (90 sn)', async () => {
    const limitAt = async (level: number) => {
      const game = createGame();
      game.levelCount = 8;
      game.state = {
        version: 1,
        gameId: 'game-octanum',
        currentLevel: level,
        completedLevels: [],
        bestTimes: {},
        totalPlayMs: 0,
      };
      document.body.appendChild(game);
      await game.updateComplete;
      start(game);
      const limit = internals(game)._round.timeLimitMs;
      game.remove();
      return limit;
    };

    // Süre artık bir zorluk kolu değil: ilk ve son seviye aynı baskıyı
    // taşır, zorluk formülün uzunluğuyla ölçülür (bkz. round.ts).
    expect(await limitAt(1)).toBe(90_000);
    expect(await limitAt(8)).toBe(90_000);
  });

  it('seviyeler modunda tur kolaydan zora doğru uzar', async () => {
    const stepsAt = async (level: number) => {
      const game = createGame();
      game.levelCount = 10;
      game.seed = 7;
      game.state = {
        version: 1,
        gameId: 'game-octanum',
        currentLevel: level,
        completedLevels: [],
        bestTimes: {},
        totalPlayMs: 0,
      };
      document.body.appendChild(game);
      await game.updateComplete;
      start(game);
      const { solution } = internals(game)._round;
      game.remove();
      return solution.length;
    };

    const curve = await Promise.all([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(stepsAt));
    // Azalmayan bir eğri: ilk seviye en kısa formül, son seviye en uzunu.
    expect(curve).toEqual([...curve].sort((a, b) => a - b));
    expect(curve[0]).toBe(2);
    expect(curve[curve.length - 1]).toBe(5);
  });

  it('serbest modda sabit orta zorlukla (90 sn) oynanır', async () => {
    const limits = new Set<number>();
    const stepCounts = new Set<number>();
    for (const seed of [1, 2, 3, 4, 5]) {
      const game = createGame();
      game.mode = 'random';
      game.seed = seed;
      document.body.appendChild(game);
      await game.updateComplete;
      start(game);
      const round = internals(game)._round;
      limits.add(round.timeLimitMs);
      stepCounts.add(round.solution.length);
      game.remove();
    }
    // Süre de zorluk da tur tur değişmez: orta bantta sabittir.
    expect([...limits]).toEqual([FREE_MODE_TIME_MS]);
    expect(FREE_MODE_TIME_MS).toBe(90_000);
    expect([...stepCounts]).toEqual([stepsFor(RANDOM_MODE_DIFFICULTY)]);
  });

  // ── Klavye ──
  it('rakam ve işlem tuşlarıyla karışım yapılabilir', async () => {
    await begin();
    const [a, b] = values(el);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '2', bubbles: true }));
    await el.updateComplete;

    expect(values(el)).toHaveLength(5);
    expect(values(el)[0]).toBe(a + b);
  });

  it('Backspace ile geri alır, Escape ile seçimi bırakır', async () => {
    await begin();
    const before = values(el);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));
    await el.updateComplete;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await el.updateComplete;
    expect(vials(el)[0].getAttribute('aria-pressed')).toBe('false');

    await play(el, { a: before[0], op: '+', b: before[1], result: before[0] + before[1] });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    await el.updateComplete;
    expect(values(el)).toEqual(before);
  });

  it('form alanına yazarken tuşları yutmaz', async () => {
    await begin();
    const input = document.createElement('input');
    document.body.appendChild(input);

    input.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));
    await el.updateComplete;

    expect(vials(el)[0].getAttribute('aria-pressed')).toBe('false');
    input.remove();
  });

  it('kurala aykırı birleşim klavyeden denendiğinde uyarı gösterir', async () => {
    await begin();
    const sorted = [...values(el)].sort((x, y) => x - y);
    if (sorted[0] === sorted[sorted.length - 1]) return; // tüm kartlar eşitse kural denenemez

    const smallIndex = values(el).indexOf(sorted[0]) + 1;
    const bigIndex = values(el).indexOf(sorted[sorted.length - 1]) + 1;

    window.dispatchEvent(new KeyboardEvent('keydown', { key: String(smallIndex), bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '-', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: String(bigIndex), bubbles: true }));
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector('.hint.warn')).not.toBeNull();
    expect(values(el)).toHaveLength(6); // karışım yapılmadı
  });
});

// ─── Kurallar ve puanlama ───────────────────────────────────────────────────

describe('combine', () => {
  it('dört işlemi uygular', () => {
    expect(combine(50, '+', 7)).toBe(57);
    expect(combine(50, '-', 7)).toBe(43);
    expect(combine(50, '*', 7)).toBe(350);
    expect(combine(50, '/', 10)).toBe(5);
  });

  it('eksi sonuca ve kesirli bölmeye izin vermez', () => {
    expect(combine(7, '-', 50)).toBeNull();
    expect(combine(50, '/', 7)).toBeNull();
    expect(combine(50, '/', 0)).toBeNull();
  });

  it('sıfır sonuçlu çıkarmaya izin verir (A ≥ B)', () => {
    expect(combine(7, '-', 7)).toBe(0);
  });
});

describe('scoreFor', () => {
  it('tam isabette 100 puan ve kalan saniye bonusu verir', () => {
    expect(scoreFor(true, 0, 42_000)).toBe(142);
    expect(scoreFor(true, 0, 0)).toBe(100);
  });

  it('kısmi isabette farkı on katıyla düşer', () => {
    expect(scoreFor(false, 1, 30_000)).toBe(90);
    expect(scoreFor(false, 7, 30_000)).toBe(30);
  });

  it('puanı sıfırın altına indirmez', () => {
    expect(scoreFor(false, 40, 0)).toBe(0);
  });
});

describe('difficultyFor', () => {
  it('ilk seviyede 0, son seviyede 1 döner', () => {
    expect(difficultyFor(1, 10)).toBe(0);
    expect(difficultyFor(10, 10)).toBe(1);
    expect(difficultyFor(1, 1)).toBe(0);
  });
});
