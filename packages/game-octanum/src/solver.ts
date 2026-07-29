/**
 * Octanum çözücüsü — verilen bileşenlerle dört işlemi kullanarak hedefe
 * ulaşılıp ulaşılamayacağını kesin olarak söyleyen özyinelemeli arama.
 *
 * Oyunun kök README §5 maddesi prosedürel üretimde çözülebilirliği zorunlu
 * kılar. Burada "geriye doğru üretim" yerine gerçek bir çözücü kullanılır:
 * üretim aşaması hedefi çözücüye doğrulatır (bkz. `round.ts`), oyun da elindeki
 * hazır çözümü tur sonunda oyuncuya gösterebilir.
 *
 * Arama şu ağacı dolaşır: elden iki sayı seçilir, aralarında bir işlem yapılır,
 * ikisi listeden çıkıp sonuçları listeye girer ve kalan liste ile aynı adım
 * tekrarlanır. 6 sayı için ham ağaç milyonlarca düğümdür; aşağıdaki budamalar
 * onu tarayıcıda göz kırpmadan bitecek boyuta indirir:
 *
 *   1. Liste daima büyükten küçüğe sıralı tutulur, böylece seçilen çiftte
 *      `a >= b` garanti edilir: `a+b` ile `b+a` (ve `a*b` ile `b*a`) aynı dalı
 *      iki kez açmaz.
 *   2. Aynı düğümde eşit değerli sayılar bir kez denenir (sıralı listede
 *      komşu tekrarlar atlanır).
 *   3. `a-b` yalnızca `a > b` iken (0 üretmek boşuna), `a*b` ve `a/b` yalnızca
 *      `b !== 1` iken denenir — 1 ile çarpmak/bölmek eli değiştirmez.
 *   4. Tam isabet bulununca arama anında durur.
 *
 * Tam isabet yoksa ağaç sonuna kadar taranır ve hedefe **en yakın üretilebilen**
 * değer döner. Bu değer de gerçekten üretilmiş bir sayıdır (uydurulmaz), yani
 * üretim aşaması onu güvenle hedef olarak kullanabilir.
 */

export type Op = '+' | '-' | '*' | '/';

export const ALL_OPS: readonly Op[] = ['+', '-', '*', '/'];

/**
 * İki bileşenin karışımı — oyunun tek doğruluk kaynağı. Kurallara aykırı bir
 * birleşim `null` döner: çıkarmada eksi sayı (A ≥ B şartı), bölmede kalanlı
 * bölme. Ara adımlarda ondalık ya da negatif değer oluşamaz.
 */
export function applyOp(a: number, op: Op, b: number): number | null {
  switch (op) {
    case '+': return a + b;
    case '-': return a >= b ? a - b : null;
    case '*': return a * b;
    case '/': return b !== 0 && a % b === 0 ? a / b : null;
  }
}

export interface SolutionStep {
  a: number;
  op: Op;
  b: number;
  result: number;
}

export interface SolveResult {
  /** Hedefe birebir ulaşıldı mı? */
  exact: boolean;
  /** Ulaşılan (tam isabet yoksa hedefe en yakın) değer. Daima üretilebilirdir. */
  value: number;
  /** `value` değerine götüren işlem zinciri; katkısı olmayan adımlar ayıklanır. */
  steps: SolutionStep[];
  /** Denenen işlem sayısı — bütçe ayarı ve testler için. */
  nodes: number;
  /** Ağaç sonuna kadar tarandı mı, yoksa bütçe mi doldu? */
  exhausted: boolean;
}

/**
 * Düğüm bütçesi. 6 sayılık ham ağaç budamalarla ~1 milyon düğüme iner; sınır
 * bunun üstünde tutulur ki normal turlarda hiç devreye girmesin, ama patolojik
 * bir el arayüzü kilitlemesin. Bütçe dolduğunda o ana kadarki en iyi değer
 * döner — bu değer de üretilebilir olduğu için sonuç yine kullanılabilir.
 */
export const DEFAULT_BUDGET = 2_000_000;

/**
 * Bulunan zincirden hedefe katkısı olmayan adımları ayıklar. Arama, yol
 * üzerindeki *bütün* işlemleri kaydeder; oysa `2+3=5` gibi kenarda kalmış bir
 * adım nihai sonuca girmiyorsa oyuncuya gösterilen formülü gereksiz uzatır.
 *
 * Sondan başa yürünür: son adımın sonucu daima aranan değerdir, ondan geriye
 * doğru her adımın operandları "aranan" listesine eklenir. Aynı değer birden
 * çok yerde üretilmişse fazladan bir adım korunabilir — sonuç yine geçerli bir
 * formüldür, yalnızca en kısası olmayabilir.
 */
export function trimSolution(steps: readonly SolutionStep[], value: number): SolutionStep[] {
  const needed = [value];
  const kept: SolutionStep[] = [];
  for (let i = steps.length - 1; i >= 0; i--) {
    const step = steps[i];
    const idx = needed.indexOf(step.result);
    if (idx === -1) continue;
    needed.splice(idx, 1);
    needed.push(step.a, step.b);
    kept.unshift(step);
  }
  return kept;
}

/** Sıralamayı (büyükten küçüğe) bozmadan yeni değeri yerleştirir. */
function insertDesc(list: readonly number[], value: number): number[] {
  const out = list.slice();
  let i = 0;
  while (i < out.length && out[i] > value) i++;
  out.splice(i, 0, value);
  return out;
}

/**
 * Hedefe ulaşmayı dener. Sayılar tüketilmek zorunda değildir: elde artan kart
 * kalabilir, önemli olan üretilen değerlerden birinin hedefe eşit olmasıdır.
 */
/**
 * Hedefe **en çok** `maxSteps` karışımla ulaşılabiliyor mu? Üretim aşaması bunu
 * turun fazla kolay kaçmadığını doğrulamak için kullanır: bir seviye üç adımlık
 * bir formül vaat ediyorsa, aynı hedefin bir-iki hamlede düşmediğinden emin
 * olmak gerekir.
 *
 * `solve` ile aynı ağacı dolaşır ama derinlik sınırlıdır; `maxSteps ≤ 2` için
 * birkaç bin düğümde biter, dolayısıyla her tur üretiminde çağrılabilir.
 */
export function reachableWithin(
  numbers: readonly number[],
  target: number,
  maxSteps: number,
): boolean {
  if (numbers.includes(target)) return true;
  if (maxSteps <= 0) return false;

  const search = (list: readonly number[], depth: number): boolean => {
    const n = list.length;
    for (let i = 0; i < n - 1; i++) {
      if (i > 0 && list[i] === list[i - 1]) continue;
      for (let j = i + 1; j < n; j++) {
        if (j > i + 1 && list[j] === list[j - 1]) continue;

        const a = list[i]; // liste azalan sıralı: a >= b
        const b = list[j];
        const rest: number[] = [];
        for (let k = 0; k < n; k++) if (k !== i && k !== j) rest.push(list[k]);

        for (const op of ALL_OPS) {
          const value = applyOp(a, op, b);
          if (value === null) continue;
          if (value === target) return true;
          if (depth + 1 < maxSteps && rest.length && search(insertDesc(rest, value), depth + 1)) {
            return true;
          }
        }
      }
    }
    return false;
  };

  return search([...numbers].sort((x, y) => y - x), 0);
}

export function solve(
  numbers: readonly number[],
  target: number,
  budget: number = DEFAULT_BUDGET,
): SolveResult {
  let nodes = 0;
  let found = false;
  let truncated = false;

  let bestValue = numbers.length ? numbers[0] : 0;
  let bestDiff = Infinity;
  let bestSteps: SolutionStep[] = [];

  /** Arama sırasında üzerinde bulunulan yolun işlemleri. */
  const path: SolutionStep[] = [];

  const consider = (value: number) => {
    const diff = Math.abs(value - target);
    // Eşit yakınlıkta kısa formül tercih edilir: oyuncuya gösterilen çözüm
    // gereksiz adım taşımasın.
    if (diff < bestDiff || (diff === bestDiff && path.length < bestSteps.length)) {
      bestDiff = diff;
      bestValue = value;
      bestSteps = path.slice();
    }
  };

  // Dağıtılan kartların kendisi de "sıfır işlemle ulaşılan" değerlerdir.
  for (const n of numbers) consider(n);
  if (bestDiff === 0) {
    return { exact: true, value: target, steps: [], nodes: 0, exhausted: true };
  }

  const search = (list: readonly number[]) => {
    const n = list.length;
    for (let i = 0; i < n - 1; i++) {
      if (i > 0 && list[i] === list[i - 1]) continue; // aynı değer, aynı düğüm
      for (let j = i + 1; j < n; j++) {
        if (j > i + 1 && list[j] === list[j - 1]) continue;

        const a = list[i]; // liste azalan sıralı olduğu için a >= b
        const b = list[j];

        const rest: number[] = [];
        for (let k = 0; k < n; k++) if (k !== i && k !== j) rest.push(list[k]);

        const tryOp = (op: Op, result: number): boolean => {
          if (++nodes > budget) {
            truncated = true;
            return true; // aramayı yukarı doğru sonlandır
          }
          path.push({ a, op, b, result });
          consider(result);
          if (bestDiff === 0) {
            found = true;
          } else if (rest.length) {
            search(insertDesc(rest, result));
          }
          path.pop();
          return found || truncated;
        };

        if (tryOp('+', a + b)) return;
        if (a > b && tryOp('-', a - b)) return;
        if (b !== 1 && tryOp('*', a * b)) return;
        if (b !== 1 && a % b === 0 && tryOp('/', a / b)) return;
      }
    }
  };

  search([...numbers].sort((x, y) => y - x));

  return {
    exact: bestDiff === 0,
    value: bestValue,
    steps: trimSolution(bestSteps, bestValue),
    nodes,
    exhausted: !truncated,
  };
}
