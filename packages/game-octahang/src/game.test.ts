import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import './index';
import type { OctahangGame } from './game';
import { trUpper, USED_WORD_MEMORY } from './game';
import { ALPHABET, WORDS } from './words';

// jsdom matchMedia'yı uygulamıyor; game.ts prefers-reduced-motion'a saygı
// göstermek için çağırdığından her testte bir stub gerekiyor.
beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
});

function createGame(): OctahangGame {
  return document.createElement('og-octahang') as OctahangGame;
}

/** Testlerin oyunu sürmek için uzandığı iç yapı. */
interface Internals {
  _entry: { word: string; hint: string; tier: 1 | 2 | 3 | 4 };
  _guessed: string[];
  _wrong: number;
  _currentLevel: number;
}

function internals(el: OctahangGame): Internals {
  return el as unknown as Internals;
}

function start(el: OctahangGame) {
  (el.shadowRoot!.querySelector('button.btn-primary') as HTMLButtonElement).click();
}

function keyButtons(el: OctahangGame): HTMLButtonElement[] {
  return [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('button.key')];
}

function press(el: OctahangGame, letter: string) {
  const btn = keyButtons(el).find((b) => b.textContent?.trim() === letter);
  if (!btn) throw new Error(`Klavyede ${letter} tuşu yok`);
  btn.click();
}

/** Kelimede geçmeyen, henüz basılmamış harfler. */
function wrongLetters(word: string, count: number): string[] {
  return ALPHABET.split('').filter((c) => !word.includes(c)).slice(0, count);
}

describe('og-octahang sözleşme event akışı', () => {
  let el: OctahangGame;

  afterEach(() => {
    el?.remove();
  });

  it('bağlanır bağlanmaz og-ready yayınlar', () => {
    el = createGame();
    const handler = vi.fn();
    el.addEventListener('og-ready', handler);
    document.body.appendChild(el);

    expect(handler).toHaveBeenCalledTimes(1);
    expect((handler.mock.calls[0][0] as CustomEvent).detail).toEqual({ gameId: 'game-octahang' });
  });

  it('oyun başlayınca og-level-start yayınlar', async () => {
    el = createGame();
    document.body.appendChild(el);
    await el.updateComplete;

    const handler = vi.fn();
    el.addEventListener('og-level-start', handler);
    start(el);

    expect(handler).toHaveBeenCalledTimes(1);
    const detail = (handler.mock.calls[0][0] as CustomEvent).detail as Record<string, unknown>;
    expect(detail.gameId).toBe('game-octahang');
    expect(detail.level).toBe(1);
    expect(typeof detail.startedAt).toBe('string');
  });

  it('kelime bulununca önce og-level-complete, sonra og-state-change yayınlar', async () => {
    vi.useFakeTimers();
    try {
      el = createGame();
      document.body.appendChild(el);
      await el.updateComplete;
      start(el);
      await el.updateComplete;

      const order: string[] = [];
      let complete: Record<string, unknown> = {};
      let saved: { bestScores?: Record<number, number>; extra?: Record<string, unknown> } = {};
      el.addEventListener('og-level-complete', (e) => {
        order.push(e.type);
        complete = (e as CustomEvent).detail;
      });
      el.addEventListener('og-state-change', (e) => {
        order.push(e.type);
        saved = (e as CustomEvent).detail.state;
      });

      const word = internals(el)._entry.word;
      for (const ch of new Set(word.split(''))) {
        press(el, ch);
        await el.updateComplete;
      }

      expect(order).toEqual([]); // animasyon sürerken sonuç henüz işlenmez

      await vi.runAllTimersAsync();

      expect(order).toEqual(['og-level-complete', 'og-state-change']);
      expect(complete.level).toBe(1);
      expect(complete.score).toBeGreaterThan(0);
      expect(typeof complete.durationMs).toBe('number');
      // Kelime oyunu puana dayalıdır: bestScores dolar ve kelime tekrar
      // gelmemek üzere extra'ya yazılır.
      expect(saved.bestScores).toBeDefined();
      expect((saved.extra?.usedWords as string[]).at(-1)).toBe(word);
    } finally {
      vi.useRealTimers();
    }
  });

  it('altı yanlış harfte og-level-fail yayınlar ve seviyeyi ilerletmez', async () => {
    vi.useFakeTimers();
    try {
      el = createGame();
      document.body.appendChild(el);
      await el.updateComplete;
      start(el);
      await el.updateComplete;

      const failed = vi.fn();
      const changed = vi.fn();
      el.addEventListener('og-level-fail', failed);
      el.addEventListener('og-state-change', changed);

      const word = internals(el)._entry.word;
      for (const ch of wrongLetters(word, 6)) {
        press(el, ch);
        await el.updateComplete;
      }
      await vi.runAllTimersAsync();

      expect(failed).toHaveBeenCalledTimes(1);
      expect((failed.mock.calls[0][0] as CustomEvent).detail).toEqual({
        gameId: 'game-octahang',
        level: 1,
        reason: 'out-of-lives',
      });
      // Kaybedilen tur currentLevel'ı ilerletmez.
      expect((changed.mock.calls[0][0] as CustomEvent).detail.state.currentLevel).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('verilen state ile kaldığı seviyeden devam eder', async () => {
    el = createGame();
    el.state = {
      version: 1,
      gameId: 'game-octahang',
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

describe('og-octahang oynanış', () => {
  let el: OctahangGame;

  afterEach(() => {
    el?.remove();
  });

  it('basılan harfi pasifleştirir, doğruyu yeşil yanlışı kırmızı işaretler', async () => {
    el = createGame();
    document.body.appendChild(el);
    await el.updateComplete;
    start(el);
    await el.updateComplete;

    const word = internals(el)._entry.word;
    const good = word[0];
    const bad = wrongLetters(word, 1)[0];

    press(el, good);
    press(el, bad);
    await el.updateComplete;

    const btn = (ch: string) => keyButtons(el).find((b) => b.textContent?.trim() === ch)!;
    expect(btn(good).disabled).toBe(true);
    expect(btn(good).classList.contains('hit')).toBe(true);
    expect(btn(bad).disabled).toBe(true);
    expect(btn(bad).classList.contains('miss')).toBe(true);
  });

  it('klavyeyi alfabetik sırayı bozmadan 10-10-9 üç satıra böler', async () => {
    el = createGame();
    document.body.appendChild(el);
    await el.updateComplete;
    start(el);
    await el.updateComplete;

    const rows = [...el.shadowRoot!.querySelectorAll('.kb-row')];
    expect(rows.map((r) => r.querySelectorAll('button.key').length)).toEqual([10, 10, 9]);
    // Satırlar birleştiğinde alfabenin tamamını, sırasıyla vermeli.
    const letters = rows
      .flatMap((r) => [...r.querySelectorAll('button.key')])
      .map((b) => b.textContent?.trim())
      .join('');
    expect(letters).toBe(ALPHABET);
  });

  it('başlangıç ekranında emoji yerine çizilmiş darağacı figürü gösterir', async () => {
    el = createGame();
    document.body.appendChild(el);
    await el.updateComplete;

    const figure = el.shadowRoot!.querySelector('svg.idle-figure');
    expect(figure).not.toBeNull();
    // sehpa 3 + ip 1 + çöp adam 6 = 10 çizgi
    expect(figure!.querySelectorAll('path')).toHaveLength(10);
  });

  it('yanlış tahmin başına adamın bir parçasını çizer', async () => {
    el = createGame();
    document.body.appendChild(el);
    await el.updateComplete;
    start(el);
    await el.updateComplete;

    const limbs = () => el.shadowRoot!.querySelectorAll('.limb').length;
    expect(limbs()).toBe(0);

    const word = internals(el)._entry.word;
    const [first, second] = wrongLetters(word, 2);

    press(el, first);
    await el.updateComplete;
    expect(limbs()).toBe(1);

    press(el, second);
    await el.updateComplete;
    expect(limbs()).toBe(2);
  });

  it('fiziksel klavyeden gelen harfleri Türkçe büyütüp kabul eder', async () => {
    el = createGame();
    document.body.appendChild(el);
    await el.updateComplete;
    start(el);
    await el.updateComplete;

    // Küçük 'i' Türkçede 'İ'ye dönüşmeli; kelimede 'İ' varsa doğru sayılır.
    const word = internals(el)._entry.word;
    const bad = wrongLetters(word, 1)[0];
    const lower = bad === 'I' ? 'ı' : bad.toLowerCase();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: lower, bubbles: true }));
    await el.updateComplete;

    expect(internals(el)._wrong).toBe(1);
    const btn = keyButtons(el).find((b) => b.textContent?.trim() === bad)!;
    expect(btn.disabled).toBe(true);
  });

  it('form alanına yazarken tuşları yutmaz', async () => {
    el = createGame();
    document.body.appendChild(el);
    await el.updateComplete;
    start(el);
    await el.updateComplete;

    const input = document.createElement('input');
    document.body.appendChild(input);
    const word = internals(el)._entry.word;
    const bad = wrongLetters(word, 1)[0];
    input.dispatchEvent(new KeyboardEvent('keydown', { key: bad.toLowerCase(), bubbles: true }));
    await el.updateComplete;

    expect(internals(el)._wrong).toBe(0);
    input.remove();
  });

  it('aynı seed aynı kelimeyi seçer', async () => {
    const words: string[] = [];
    for (const seed of [7, 7]) {
      const game = createGame();
      game.seed = seed;
      document.body.appendChild(game);
      await game.updateComplete;
      start(game);
      words.push(internals(game)._entry.word);
      game.remove();
    }
    expect(words[0]).toBe(words[1]);
  });

  it('seviyeler modu kolaydan zora ilerler', async () => {
    const tierAt = async (level: number) => {
      const game = createGame();
      game.levelCount = 9;
      game.state = {
        version: 1,
        gameId: 'game-octahang',
        currentLevel: level,
        completedLevels: [],
        bestTimes: {},
        totalPlayMs: 0,
      };
      document.body.appendChild(game);
      await game.updateComplete;
      start(game);
      const tier = internals(game)._entry.tier;
      game.remove();
      return tier;
    };

    expect(await tierAt(1)).toBe(1);
    expect(await tierAt(3)).toBe(2);
    expect(await tierAt(5)).toBe(3);
    expect(await tierAt(9)).toBe(4);
  });

  it('serbest mod orta-zor bantta kalır', async () => {
    for (let i = 0; i < 10; i++) {
      const game = createGame();
      game.mode = 'random';
      game.seed = i;
      document.body.appendChild(game);
      await game.updateComplete;
      start(game);
      const tier = internals(game)._entry.tier;
      expect(tier).toBeGreaterThanOrEqual(2);
      expect(tier).toBeLessThanOrEqual(3);
      game.remove();
    }
  });

  it('hiçbir tur açık harfle başlamaz', async () => {
    // Kelime ne kadar uzun olursa olsun tahta bomboş başlar; oyuncuya
    // baştan hediye harf verilmez.
    for (const seed of [0, 1, 2, 3, 4, 5, 6, 7]) {
      for (const level of [1, 3, 5, 9]) {
        const game = createGame();
        game.levelCount = 9;
        game.seed = seed;
        game.state = {
          version: 1,
          gameId: 'game-octahang',
          currentLevel: level,
          completedLevels: [],
          bestTimes: {},
          totalPlayMs: 0,
        };
        document.body.appendChild(game);
        await game.updateComplete;
        start(game);

        expect(internals(game)._guessed).toHaveLength(0);
        game.remove();
      }
    }
  });
});

describe('kelime havuzu', () => {
  it('yalnızca Türk alfabesindeki 29 harfi içerir ve her kelimenin ipucu vardır', () => {
    expect(ALPHABET).toHaveLength(29);
    for (const { word, hint, tier } of WORDS) {
      expect(word.length).toBeGreaterThanOrEqual(5);
      expect(hint.trim().length).toBeGreaterThan(0);
      expect(hint.toLocaleLowerCase('tr')).not.toContain(word.toLocaleLowerCase('tr'));
      expect([1, 2, 3, 4]).toContain(tier);
      for (const ch of word) expect(ALPHABET).toContain(ch);
    }
  });

  it('aynı kelimeyi iki kez içermez', () => {
    expect(new Set(WORDS.map((e) => e.word)).size).toBe(WORDS.length);
  });

  it('her katmanda tekrar önleme belleğinden fazla kelime bulundurur', () => {
    // Aksi hâlde bir katman tümüyle "kullanılmış" duruma düşer ve seçim
    // sürekli yedek dallara sapar. Sınır belleğin kendisine bağlıdır; bellek
    // büyütülürse havuzun da büyümesi gerektiği burada yakalanır.
    for (const tier of [1, 2, 3, 4]) {
      expect(WORDS.filter((e) => e.tier === tier).length).toBeGreaterThan(USED_WORD_MEMORY);
    }
  });
});

describe('trUpper', () => {
  it('Türkçe i/ı ayrımını korur', () => {
    expect(trUpper('i')).toBe('İ');
    expect(trUpper('ı')).toBe('I');
    expect(trUpper('istakoz')).toBe('İSTAKOZ');
    expect(trUpper('ışık')).toBe('IŞIK');
    expect(trUpper('ğüşçöi')).toBe('ĞÜŞÇÖİ');
  });
});
