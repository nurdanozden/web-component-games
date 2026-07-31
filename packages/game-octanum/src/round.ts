/**
 * Tur üretimi — "çözülebilirliği garanti et" kuralının (kök README §5)
 * uygulandığı yer.
 *
 * Hedef, rastgele istenip çözücüye aratılmaz; **ileriye doğru kurulur**:
 *
 *   1. Altı bileşen çekilir: bir-iki "nadir öz" (büyük sayı) + kalanı "temel
 *      öz" (1–10 arası, her değerden en çok iki tane).
 *   2. El karıştırılır, baştan `adım + 1` tanesi alınır ve sırayla birbirine
 *      eklenerek bir formül örülür: `v = n₀`, sonra her adımda `v = v ⊕ nᵢ`.
 *      Ulaşılan son değer hedeftir.
 *   3. Hedefin zorluk aralığında kaldığı, sahnedeki bir kartın kopyası olmadığı
 *      ve **vaat edilen adım sayısından daha kısa yoldan düşmediği** doğrulanır.
 *
 * Bunun iki kazancı var. Birincisi, çözüm zaten elimizdedir: çözümsüz bölüm
 * üretmek yapısal olarak imkânsızdır. İkincisi — asıl mesele — **zorluk artık
 * ölçülebilir bir büyüklüktür**: bir turun kaç karışım gerektirdiği baştan
 * bilinir. Hedefi rastgele isteyip çözücüye bıraktığımızda "kolay" seviyeler de
 * beş-altı adımlık formüller doğurabiliyordu; oyunun genelinin fazla zor
 * kaçmasının sebebi buydu.
 */

import { applyOp, reachableWithin, ALL_OPS, type SolutionStep } from './solver';

export interface Round {
  /** Sahneye düşen altı bileşen. */
  numbers: number[];
  /** Hedef formülün sayısı. Daima `numbers` ile üretilebilir. */
  target: number;
  /** Üretim sırasında kurulan çözüm; tur sonunda oyuncuya gösterilir. */
  solution: SolutionStep[];
  /** Turun süre sınırı (ms). */
  timeLimitMs: number;
}

/** Nadir özler: seyrek çıkan, hedefe hızlı sıçratan büyük değerler. */
export const BIG_VALUES = [15, 20, 25, 50, 75, 100] as const;

/** Temel özler: 1–10 arası, havuzda her değerden iki tane bulunur. */
export const SMALL_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export const CARD_COUNT = 6;

/** Serbest modun sabit zorluğu: eğri yok, orta bant. */
export const RANDOM_MODE_DIFFICULTY = 0.5;

/** En kolay ve en zor turun gerektirdiği karışım sayısı. */
export const MIN_STEPS = 2;
export const MAX_STEPS = 5;

/**
 * "Fazla kolay" denetiminin bakacağı azami derinlik. `reachableWithin` maliyeti
 * derinlikle hızla büyüdüğü için üst seviyelerde de iki adımda kalır: asıl
 * engellenmek istenen, beş adımlık bir formülün tek-iki hamlede çökmesidir.
 */
const MAX_TRIVIAL_STEPS = 2;

/** Hedef ve bileşen çekimi için deneme sınırı. */
const MAX_ATTEMPTS = 12;

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function pick<T>(rand: () => number, list: readonly T[]): T {
  return list[(rand() * list.length) | 0];
}

/** Fisher–Yates; verilen diziyi bozmaz. */
function shuffle<T>(rand: () => number, list: readonly T[]): T[] {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = (rand() * (i + 1)) | 0;
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Tur süresi: her zorlukta sabit 90 saniye.
 *
 * Eskiden süre de bir zorluk koluydu (ilk seviyede 150 sn, son seviyede 90 sn).
 * Artık değil: zorluk yalnızca formülün uzunluğu, hedefin büyüklüğü ve nadir öz
 * havuzu üzerinden ölçülür — süre baskısı her turda aynıdır. `difficulty`
 * parametresi imzada kalır, çünkü çağrı yerleri (`generateRound`, seviye kurma)
 * zorluğu zaten hesaplıyor ve süre ileride yeniden eğriye bağlanmak istenirse
 * imza değişmeden dönülebilsin.
 */
export function timeLimitFor(_difficulty: number): number {
  return 90_000;
}

/** Serbest modun süresi (ms) — süre artık her zorlukta aynı olduğu için 90 sn. */
export const FREE_MODE_TIME_MS = timeLimitFor(RANDOM_MODE_DIFFICULTY);

/**
 * Turun gerektirdiği karışım sayısı — zorluğun asıl kolu.
 *
 * Katsayı 2.5'tir, 3 değil: 10 seviyelik bir oyunda bu, adımların
 * `2,2,3,3,3,3,4,4,4,5` diye yayılmasını sağlar. Yani oyuncu iki adımlık
 * turlarla ısınır, uzun süre üç adımda kalır ve beş adımlık formülle yalnızca
 * son seviyede karşılaşır. Doğrudan 3 ile ölçekleseydik orta seviyeler dört
 * adıma sıçrar, eğri baştan dikleşirdi.
 */
export function stepsFor(difficulty: number): number {
  return MIN_STEPS + Math.round(clamp01(difficulty) * 2.5);
}

/**
 * Zorluğa göre hedef aralığı: kolayda iki basamak, zorda 900'e yaklaşan
 * sayılar. Küçük hedef tek başına turu kolaylaştırmaz ama büyük hedef her zaman
 * zorlaştırır — asıl zorluk `stepsFor` ile ayarlanır, bu aralık ona eşlik eder.
 */
export function targetRangeFor(difficulty: number): [number, number] {
  const d = clamp01(difficulty);
  return [Math.round(24 + d * 236), Math.round(99 + d * 800)];
}

/**
 * Zorluğa göre nadir öz havuzu. Kolay turlarda elde 100 gibi bir sayının
 * bulunması işe yaramaz — iki basamaklı bir hedefe onunla yaklaşılamaz, kart
 * ölü ağırlığa dönüşür. Havuz bu yüzden zorlukla birlikte açılır.
 */
export function bigPoolFor(difficulty: number): number[] {
  const d = clamp01(difficulty);
  if (d < 0.34) return [15, 20, 25];
  if (d < 0.67) return [15, 20, 25, 50];
  return [...BIG_VALUES];
}

/** Altı bileşeni çeker: 1–2 nadir öz + kalanı temel öz. */
export function drawNumbers(rand: () => number, difficulty: number): number[] {
  const bigPool = bigPoolFor(difficulty);
  const bigCount = 1 + ((rand() * 2) | 0);

  const numbers: number[] = [];
  for (let i = 0; i < bigCount; i++) {
    const idx = (rand() * bigPool.length) | 0;
    numbers.push(bigPool.splice(idx, 1)[0]);
  }
  // Temel özlerde her değerden en çok iki tane: üç tane 7 gelen bir el hem
  // görsel olarak tekdüze hem de çözüm uzayı bakımından fakir olur.
  const counts = new Map<number, number>();
  while (numbers.length < CARD_COUNT) {
    const v = pick(rand, SMALL_VALUES);
    const used = counts.get(v) ?? 0;
    if (used >= 2) continue;
    counts.set(v, used + 1);
    numbers.push(v);
  }
  return numbers;
}

/**
 * Elden `stepCount + 1` kart alıp zincirleme bir formül örer ve vardığı değeri
 * hedef olarak döndürür.
 *
 * Her adımda geçerli işlemler arasından, sonucu aralıkta kalan biri seçilir
 * (son adımda `[lo, hi]`, ara adımlarda yalnızca `≤ hi` — böylece `100 × 75`
 * gibi bir sıçrama zinciri raydan çıkarmaz). Aralığa oturan seçenek yoksa
 * geçerli olanlardan biri alınır; turun aralık dışında kalıp kalmadığına
 * `generateRound` karar verir.
 */
function buildFormula(
  rand: () => number,
  numbers: readonly number[],
  stepCount: number,
  lo: number,
  hi: number,
): { target: number; steps: SolutionStep[] } {
  const hand = shuffle(rand, numbers);
  const steps: SolutionStep[] = [];
  let acc = hand[0];

  for (let i = 1; i <= stepCount; i++) {
    const b = hand[i];
    const last = i === stepCount;

    const options: SolutionStep[] = [];
    for (const op of ALL_OPS) {
      const result = applyOp(acc, op, b);
      // 0 çıkmaz sokaktır; `acc`'i değiştirmeyen adım (×1, ÷1) ise formülü
      // uzatır ama zorlaştırmaz — ikisi de zincire alınmaz.
      if (result === null || result < 1 || result === acc) continue;
      options.push({ a: acc, op, b, result });
    }
    if (options.length === 0) break; // `+` daima geçerli olduğundan gerçekleşmez

    const fitting = options.filter((s) =>
      last ? s.result >= lo && s.result <= hi : s.result <= hi);
    const chosen = pick(rand, fitting.length ? fitting : options);

    steps.push(chosen);
    acc = chosen.result;
  }

  return { target: acc, steps };
}

/**
 * Çözülebilirliği garanti edilmiş bir tur üretir.
 *
 * `difficulty` 0 (en kolay) ile 1 (en zor) arasındadır; `levels` modunda
 * seviyeden hesaplanır, `random` modunda `RANDOM_MODE_DIFFICULTY` ile sabittir.
 */
export function generateRound(rand: () => number, difficulty: number, timeLimitMs?: number): Round {
  const d = clamp01(difficulty);
  const [lo, hi] = targetRangeFor(d);
  const stepCount = stepsFor(d);
  const trivialSteps = Math.min(stepCount - 1, MAX_TRIVIAL_STEPS);
  const limit = timeLimitMs ?? timeLimitFor(d);

  /** Hiçbir denemenin geçmediği durumda kullanılacak son çare (yine çözülebilir). */
  let anyRound: Round | null = null;
  /** Aralığa oturmuş ama "fazla kolay" denetimine takılmış tur — daha iyi bir çare. */
  let inRangeRound: Round | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const numbers = drawNumbers(rand, d);
    const { target, steps: solution } = buildFormula(rand, numbers, stepCount, lo, hi);
    const round: Round = { numbers, target, solution, timeLimitMs: limit };

    anyRound ??= round;
    if (target < lo || target > hi) continue;
    // Sahnedeki bir kartın kendisi hedef olamaz: tur sıfır hamlede biterdi.
    if (numbers.includes(target)) continue;
    inRangeRound ??= round;

    if (reachableWithin(numbers, target, trivialSteps)) continue;

    return round;
  }

  return inRangeRound ?? anyRound!;
}
