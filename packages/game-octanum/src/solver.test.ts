import { describe, it, expect } from 'vitest';
import { solve, trimSolution, reachableWithin, type Op, type SolutionStep } from './solver';
import {
  generateRound,
  drawNumbers,
  targetRangeFor,
  timeLimitFor,
  stepsFor,
  bigPoolFor,
  CARD_COUNT,
  MIN_STEPS,
  MAX_STEPS,
} from './round';

/** Testlerin tekrar edilebilir olması için oyun ile aynı üreteç. */
function mulberry32(seed: number) {
  return function (): number {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function apply(a: number, op: Op, b: number): number {
  return op === '+' ? a + b : op === '-' ? a - b : op === '*' ? a * b : a / b;
}

/**
 * Bir çözümü, oyunun kendi kurallarıyla baştan oynar: her adımın operandları o
 * an elde bulunmalı, sonuç doğru hesaplanmalı ve ara adımlarda eksi/kesirli
 * sayı oluşmamalıdır.
 */
function replay(numbers: readonly number[], steps: readonly SolutionStep[]): number {
  const hand = [...numbers];
  let last = NaN;
  for (const step of steps) {
    const ia = hand.indexOf(step.a);
    expect(ia, `elde ${step.a} yok`).toBeGreaterThanOrEqual(0);
    hand.splice(ia, 1);
    const ib = hand.indexOf(step.b);
    expect(ib, `elde ${step.b} yok`).toBeGreaterThanOrEqual(0);
    hand.splice(ib, 1);

    expect(apply(step.a, step.op, step.b)).toBe(step.result);
    expect(step.result).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(step.result)).toBe(true);

    hand.push(step.result);
    last = step.result;
  }
  return last;
}

describe('solve', () => {
  it('tek işlemle ulaşılan hedefi bulur', () => {
    const res = solve([50, 7, 2, 3, 4, 5], 350);
    expect(res.exact).toBe(true);
    expect(replay([50, 7, 2, 3, 4, 5], res.steps)).toBe(350);
  });

  it('çok adımlı hedefi bulur', () => {
    const numbers = [2, 5, 7, 10, 25, 50];
    const res = solve(numbers, 342);
    expect(res.exact).toBe(true);
    expect(replay(numbers, res.steps)).toBe(342);
  });

  it('kart değerinin kendisi hedefse sıfır adımla döner', () => {
    const res = solve([2, 5, 7, 10, 25, 50], 25);
    expect(res.exact).toBe(true);
    expect(res.steps).toEqual([]);
  });

  it('ulaşılamayan hedefte en yakın üretilebilir değeri döner', () => {
    // 1 ve 2 ile üretilebilecek en büyük değer 3'tür; 900 imkânsızdır.
    const res = solve([1, 2], 900);
    expect(res.exact).toBe(false);
    expect(res.value).toBe(3);
    expect(res.exhausted).toBe(true);
    expect(replay([1, 2], res.steps)).toBe(3);
  });

  it('ara adımlarda eksi sayı ve kesir üretmez', () => {
    const numbers = [3, 6, 9, 4, 75, 100];
    const res = solve(numbers, 811);
    replay(numbers, res.steps); // replay her adımı ayrıca doğrular
  });

  it('6 sayılık en kötü durumda bile bütçeyi taşırmadan biter', () => {
    // Hedef, altı sayının çarpımından bile büyük olduğu için erken çıkış
    // yoktur ve ağacın tamamı taranır: budamaların gerçekten çalıştığını
    // gösteren asıl ölçüm budur.
    const res = solve([100, 75, 50, 25, 9, 8], 1_000_000_000);
    expect(res.exhausted).toBe(true);
    expect(res.exact).toBe(false);
    expect(res.nodes).toBeLessThan(2_000_000);
  });

  it('bütçe dolduğunda bile üretilebilir bir değer döner', () => {
    const numbers = [100, 75, 50, 25, 9, 8];
    const res = solve(numbers, 1_000_000, 500);
    expect(res.exhausted).toBe(false);
    expect(replay(numbers, res.steps)).toBe(res.value);
  });
});

describe('trimSolution', () => {
  it('sonuca katkısı olmayan adımları ayıklar', () => {
    const steps: SolutionStep[] = [
      { a: 3, op: '+', b: 2, result: 5 },   // kenarda kalan adım
      { a: 50, op: '*', b: 7, result: 350 },
    ];
    expect(trimSolution(steps, 350)).toEqual([{ a: 50, op: '*', b: 7, result: 350 }]);
  });

  it('zincirin tamamını korur', () => {
    const steps: SolutionStep[] = [
      { a: 50, op: '*', b: 7, result: 350 },
      { a: 350, op: '-', b: 8, result: 342 },
    ];
    expect(trimSolution(steps, 342)).toHaveLength(2);
  });
});

describe('generateRound', () => {
  it('altı bileşen dağıtır ve nadir öz sayısını sınırlar', () => {
    for (let seed = 0; seed < 40; seed++) {
      const numbers = drawNumbers(mulberry32(seed), seed / 40);
      expect(numbers).toHaveLength(CARD_COUNT);
      // Temel özlerden (1–10) her değer en çok iki kez çıkabilir.
      const counts = new Map<number, number>();
      for (const n of numbers) counts.set(n, (counts.get(n) ?? 0) + 1);
      for (const [value, count] of counts) {
        if (value <= 10) expect(count).toBeLessThanOrEqual(2);
        else expect(count).toBe(1); // nadir özler benzersizdir
      }
    }
  });

  it('ürettiği her turun çözümü vardır ve çözüm gerçekten hedefe götürür', () => {
    for (let seed = 0; seed < 60; seed++) {
      const round = generateRound(mulberry32(seed), (seed % 10) / 9);
      expect(round.numbers).toHaveLength(CARD_COUNT);
      expect(round.solution.length).toBeGreaterThan(0);
      expect(replay(round.numbers, round.solution)).toBe(round.target);
      // Çözücü de bağımsız olarak aynı hedefi bulabilmeli.
      expect(solve(round.numbers, round.target).exact).toBe(true);
    }
  });

  it('hedefi sahnedeki bir kartın kopyası yapmaz ve zorluk aralığında tutar', () => {
    for (let seed = 0; seed < 60; seed++) {
      const difficulty = (seed % 10) / 9;
      const round = generateRound(mulberry32(seed), difficulty);
      const [lo, hi] = targetRangeFor(difficulty);
      expect(round.numbers).not.toContain(round.target);
      expect(round.target).toBeGreaterThanOrEqual(lo);
      expect(round.target).toBeLessThanOrEqual(hi);
    }
  });

  it('turun uzunluğu zorluğun vaat ettiği adım sayısını aşmaz', () => {
    for (let seed = 0; seed < 60; seed++) {
      const difficulty = (seed % 10) / 9;
      const round = generateRound(mulberry32(seed), difficulty);
      expect(round.solution.length, `tohum ${seed}`).toBeLessThanOrEqual(stepsFor(difficulty));
    }
  });

  it('tur tek hamlede çökmez', () => {
    for (let seed = 0; seed < 60; seed++) {
      const difficulty = (seed % 10) / 9;
      const round = generateRound(mulberry32(seed), difficulty);
      expect(reachableWithin(round.numbers, round.target, 1), `tohum ${seed}`).toBe(false);
    }
  });

  it('kolay turlar zorlardan belirgin biçimde kısadır', () => {
    const lengths = (difficulty: number) =>
      Array.from({ length: 25 }, (_, seed) =>
        generateRound(mulberry32(seed), difficulty).solution.length);

    const easy = lengths(0);
    const hard = lengths(1);
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

    expect(Math.max(...easy)).toBeLessThanOrEqual(MIN_STEPS);
    expect(mean(easy)).toBeLessThan(mean(hard));
  });

  it('zorluk arttıkça gereken karışım sayısı da artar', () => {
    expect(stepsFor(0)).toBe(MIN_STEPS);
    expect(stepsFor(1)).toBe(MAX_STEPS);
    expect(stepsFor(0.5)).toBeGreaterThan(stepsFor(0));
    expect(stepsFor(0.5)).toBeLessThan(stepsFor(1));
  });

  it('nadir öz havuzu zorlukla birlikte açılır', () => {
    expect(bigPoolFor(0)).toEqual([15, 20, 25]);
    expect(bigPoolFor(1)).toContain(100);
    // Kolay turlarda elde 100 gibi bir ölü ağırlık bulunmaz.
    for (let seed = 0; seed < 40; seed++) {
      expect(Math.max(...drawNumbers(mulberry32(seed), 0))).toBeLessThanOrEqual(25);
    }
  });

  it('aynı tohum aynı turu üretir', () => {
    const a = generateRound(mulberry32(11), 0.5);
    const b = generateRound(mulberry32(11), 0.5);
    expect(b).toEqual(a);
  });

  it('zorluk arttıkça hedef büyür, süre kısalır', () => {
    const [easyLo, easyHi] = targetRangeFor(0);
    const [hardLo, hardHi] = targetRangeFor(1);
    expect(hardLo).toBeGreaterThan(easyLo);
    expect(hardHi).toBeGreaterThan(easyHi);
    // Sure artik bir zorluk kolu degil: her zorlukta 90 saniye.
    expect(timeLimitFor(0)).toBe(90_000);
    expect(timeLimitFor(1)).toBe(timeLimitFor(0));
  });
});
