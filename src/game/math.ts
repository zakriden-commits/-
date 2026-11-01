import type { SlotGame, SymbolId } from './types';

/* ------------------------------------------------------------------
   Аналитический расчёт RTP.

   Ключевое наблюдение: все линии имеют одинаковое распределение
   (в каждой ячейке независимый взвешенный выбор), поэтому ожидаемая
   выплата по линии = E_line, а вклад всех линий в RTP равен E_line
   (т.к. lineBet = bet / число линий).

   Скаттеры считаются через биномиальное распределение, фриспины —
   через геометрическую сумму с ретриггерами. Это даёт точный RTP,
   а не оценку по симуляции.
------------------------------------------------------------------ */

export function symbolProbabilities(game: SlotGame): Map<SymbolId, number> {
  const total = game.symbols.reduce((acc, s) => acc + Math.max(0, s.weight), 0);
  const probs = new Map<SymbolId, number>();
  for (const s of game.symbols) {
    probs.set(s.id, Math.max(0, s.weight) / total);
  }
  return probs;
}

function payoutForLine(game: SlotGame, sequence: SymbolId[]): number {
  const wild = game.wildId;
  const scatter = game.scatterId;

  let base: SymbolId | null = null;
  for (const s of sequence) {
    if (s !== wild && s !== scatter) {
      base = s;
      break;
    }
  }
  if (base === null) {
    if (!wild || !sequence.every((s) => s === wild)) return 0;
    base = wild;
  }

  let count = 0;
  for (const s of sequence) {
    if (s === base || s === wild) count++;
    else break;
  }
  if (count < 3) return 0;
  const symbol = game.symbols.find((s) => s.id === base);
  return symbol?.pay[count] ?? 0;
}

/** Ожидаемая выплата одной линии в единицах ставки на линию */
export function expectedLinePay(game: SlotGame): number {
  const probs = symbolProbabilities(game);
  const ids = game.symbols.map((s) => s.id);
  let total = 0;

  const walk = (col: number, probability: number, sequence: SymbolId[]) => {
    if (col === game.cols) {
      total += probability * payoutForLine(game, sequence);
      return;
    }
    for (const id of ids) {
      const p = probs.get(id) ?? 0;
      if (p === 0) continue;
      sequence.push(id);
      walk(col + 1, probability * p, sequence);
      sequence.pop();
    }
  };

  walk(0, 1, []);
  return total;
}

function binom(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let result = 1;
  for (let i = 1; i <= k; i++) result = (result * (n - k + i)) / i;
  return result;
}

/** Коэффициенты линейного влияния каждой выплаты на RTP */
export interface PayCoefficient {
  /** symbolId:count для линий, scatter:count для скаттера */
  key: string;
  symbolId: string;
  count: number;
  isScatter: boolean;
  /** Во сколько раз увеличивается вклад (фриспины с множителем) */
  coefficient: number;
}

export interface RtpModel {
  coefficients: PayCoefficient[];
  /** Общий множитель вклада выплат (учитывает фриспины) */
  factor: number;
}

/**
 * Возвращает точные коэффициенты: RTP = Σ pay * coefficient.
 * Используется для подбора «красивых» пейтейблов под нужный RTP.
 */
export function rtpModel(game: SlotGame): RtpModel {
  const probs = symbolProbabilities(game);
  const ids = game.symbols.map((s) => s.id);
  const wild = game.wildId;
  const scatterId = game.scatterId;
  const coefficients: PayCoefficient[] = [];
  const lineCoef = new Map<string, number>();

  const walk = (col: number, probability: number, sequence: SymbolId[]) => {
    if (col === game.cols) {
      let base: SymbolId | null = null;
      for (const s of sequence) {
        if (s !== wild && s !== scatterId) {
          base = s;
          break;
        }
      }
      if (base === null) {
        if (!wild || !sequence.every((s) => s === wild)) return;
        base = wild;
      }
      let count = 0;
      for (const s of sequence) {
        if (s === base || s === wild) count++;
        else break;
      }
      if (count < 3) return;
      const key = `${base}:${count}`;
      lineCoef.set(key, (lineCoef.get(key) ?? 0) + probability);
      return;
    }
    for (const id of ids) {
      const p = probs.get(id) ?? 0;
      if (p === 0) continue;
      sequence.push(id);
      walk(col + 1, probability * p, sequence);
      sequence.pop();
    }
  };
  walk(0, 1, []);

  for (const [key, coef] of lineCoef) {
    const [symbolId, countStr] = key.split(':');
    coefficients.push({ key, symbolId, count: Number(countStr), isScatter: false, coefficient: coef });
  }

  const cells = game.cols * game.rows;
  const scatterP = scatterId ? probs.get(scatterId) ?? 0 : 0;
  let triggerRate = 0;
  let expectedSpins = 0;
  const fs = game.freeSpins;
  for (let k = 3; k <= cells; k++) {
    const pk = binom(cells, k) * Math.pow(scatterP, k) * Math.pow(1 - scatterP, cells - k);
    if (scatterId && (game.scatterPay?.[k] ?? 0) >= 0) {
      coefficients.push({
        key: `scatter:${k}`,
        symbolId: scatterId,
        count: k,
        isScatter: true,
        coefficient: pk,
      });
    }
    if (fs && k >= fs.minScatters) {
      triggerRate += pk;
      expectedSpins += pk * (fs.spinsByCount[Math.min(k, fs.spinsByCount.length - 1)] ?? 0);
    }
  }

  const totalFreeSpins = expectedSpins > 0 && expectedSpins < 1 ? expectedSpins / (1 - expectedSpins) : 0;
  const factor = 1 + (fs ? fs.multiplier * totalFreeSpins : 0);

  return { coefficients, factor };
}

/** RTP по модели (в процентах) */
export function rtpFromModel(game: SlotGame, model: RtpModel): number {
  let total = 0;
  for (const entry of model.coefficients) {
    const pay = entry.isScatter
      ? game.scatterPay?.[entry.count] ?? 0
      : game.symbols.find((s) => s.id === entry.symbolId)?.pay[entry.count] ?? 0;
    total += pay * entry.coefficient;
  }
  return total * model.factor * 100;
}

export interface RtpBreakdown {
  lines: number;
  scatter: number;
  freeSpins: number;
  total: number;
  triggerRate: number;
  hitRate: number;
}

/** Точный расчёт RTP и его составляющих */
export function rtpBreakdown(game: SlotGame): RtpBreakdown {
  const probs = symbolProbabilities(game);
  const cells = game.cols * game.rows;
  const eLine = expectedLinePay(game);

  let scatter = 0;
  let triggerRate = 0;
  let expectedSpins = 0;
  const fs = game.freeSpins;
  const scatterP = game.scatterId ? probs.get(game.scatterId) ?? 0 : 0;

  if (game.scatterId) {
    for (let k = 3; k <= cells; k++) {
      const pk = binom(cells, k) * Math.pow(scatterP, k) * Math.pow(1 - scatterP, cells - k);
      scatter += pk * (game.scatterPay?.[k] ?? 0);
      if (fs && k >= fs.minScatters) {
        const spins = fs.spinsByCount[Math.min(k, fs.spinsByCount.length - 1)] ?? 0;
        triggerRate += pk;
        expectedSpins += pk * spins;
      }
    }
  }

  let freeSpins = 0;
  if (fs && expectedSpins > 0 && expectedSpins < 1) {
    // ожидаемое число бесплатных вращений с учётом ретриггеров
    const totalSpins = expectedSpins / (1 - expectedSpins);
    freeSpins = totalSpins * fs.multiplier * (eLine + scatter);
  }

  return {
    lines: eLine,
    scatter,
    freeSpins,
    total: (eLine + scatter + freeSpins) * 100,
    triggerRate,
    hitRate: 0,
  };
}

/** Быстрый расчёт RTP в процентах */
export function computeRtp(game: SlotGame): number {
  return rtpBreakdown(game).total;
}
