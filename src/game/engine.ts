import type { LineWin, Position, SlotGame, SpinResult, SymbolId } from './types';

/* ------------------------------------------------------------------
   RNG
   Используем crypto.getRandomValues, если доступен, иначе Math.random.
   Никакой предсказуемости "по времени" — как в реальных слотах.
------------------------------------------------------------------ */

const cryptoObj: Crypto | undefined =
  typeof globalThis !== 'undefined' ? (globalThis.crypto as Crypto | undefined) : undefined;

const rngBuffer = new Uint32Array(256);
let rngCursor = rngBuffer.length;

function nextRandom(): number {
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    if (rngCursor >= rngBuffer.length) {
      cryptoObj.getRandomValues(rngBuffer);
      rngCursor = 0;
    }
    return rngBuffer[rngCursor++] / 4294967296;
  }
  return Math.random();
}

/* ------------------------------------------------------------------
   Барабаны
------------------------------------------------------------------ */

export interface ReelStrip {
  ids: SymbolId[];
  cumulative: number[];
  total: number;
}

/** Собирает взвешенную ленту для быстрого выбора символа */
export function buildReel(game: SlotGame): ReelStrip {
  const ids: SymbolId[] = [];
  const cumulative: number[] = [];
  let total = 0;
  for (const symbol of game.symbols) {
    total += Math.max(0, symbol.weight);
    ids.push(symbol.id);
    cumulative.push(total);
  }
  return { ids, cumulative, total };
}

function pickWeighted(reel: ReelStrip): SymbolId {
  const target = nextRandom() * reel.total;
  // бинарный поиск по накопленным весам
  let lo = 0;
  let hi = reel.cumulative.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (target < reel.cumulative[mid]) hi = mid;
    else lo = mid + 1;
  }
  return reel.ids[lo];
}

export function generateGrid(game: SlotGame, reel: ReelStrip): SymbolId[][] {
  const grid: SymbolId[][] = [];
  for (let col = 0; col < game.cols; col++) {
    const column: SymbolId[] = [];
    for (let row = 0; row < game.rows; row++) {
      column.push(pickWeighted(reel));
    }
    grid.push(column);
  }
  return grid;
}

/* ------------------------------------------------------------------
   Оценка выигрышей
------------------------------------------------------------------ */

function payFor(symbolId: SymbolId, count: number, game: SlotGame): number {
  const symbol = game.symbols.find((s) => s.id === symbolId);
  if (!symbol) return 0;
  return symbol.pay[count] ?? 0;
}

export function evaluateGrid(
  game: SlotGame,
  grid: SymbolId[][],
  totalBet: number,
  options: { freeSpin?: boolean } = {},
): SpinResult {
  const lineBet = totalBet / game.paylines.length;
  const multiplier = options.freeSpin ? game.freeSpins?.multiplier ?? 1 : 1;
  const wild = game.wildId ?? null;
  const scatter = game.scatterId ?? null;
  const lineWins: LineWin[] = [];

  game.paylines.forEach((line, lineIndex) => {
    const positions: Position[] = line.rows.map((row, col) => ({ col, row }));
    const symbols = positions.map((p) => grid[p.col]?.[p.row] ?? '');

    // Ищем базовый символ: первый не-wild и не-scatter
    let base: SymbolId | null = null;
    for (const symbol of symbols) {
      if (symbol !== wild && symbol !== scatter) {
        base = symbol;
        break;
      }
    }
    // Линия целиком из wild — платим как wild
    if (base === null) {
      const allWild = symbols.every((s) => s === wild);
      if (!allWild || !wild) return;
      base = wild;
    }

    const lineSymbol: SymbolId = base;
    let count = 0;
    for (const symbol of symbols) {
      if (symbol === lineSymbol || symbol === wild) count++;
      else break;
    }

    if (count < 3) return;
    const pay = payFor(lineSymbol, count, game);
    if (pay <= 0) return;

    lineWins.push({
      line: lineIndex + 1,
      symbolId: lineSymbol,
      count,
      amount: roundMoney(pay * lineBet * multiplier),
      positions: positions.slice(0, count),
    });
  });

  const scatterCount = scatter
    ? grid.reduce((acc, column) => acc + column.filter((s) => s === scatter).length, 0)
    : 0;
  const scatterPay = game.scatterPay?.[scatterCount] ?? 0;
  const scatterWin = roundMoney(scatterPay * totalBet * multiplier);

  let freeSpinsWon = 0;
  if (scatter && game.freeSpins && scatterCount >= game.freeSpins.minScatters) {
    const table = game.freeSpins.spinsByCount;
    freeSpinsWon = table[Math.min(scatterCount, table.length - 1)] ?? 0;
  }

  const lineTotal = lineWins.reduce((acc, win) => acc + win.amount, 0);

  return {
    grid,
    lineWins,
    scatterCount,
    scatterWin,
    multiplier,
    totalWin: roundMoney(lineTotal + scatterWin),
    freeSpinsWon,
    isFreeSpin: Boolean(options.freeSpin),
  };
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Один спин (без фриспинов) */
export function spinOnce(
  game: SlotGame,
  totalBet: number,
  options: { freeSpin?: boolean } = {},
): SpinResult {
  const reel = buildReel(game);
  const grid = generateGrid(game, reel);
  return evaluateGrid(game, grid, totalBet, options);
}

/** Сумма всех выплат по линии (для отладки / статистики) */
export function sumLineWins(result: SpinResult): number {
  return roundMoney(result.lineWins.reduce((acc, win) => acc + win.amount, 0));
}

/** Утилита для симулятора: полный жизненный цикл с фриспинами */
export function simulateSession(
  game: SlotGame,
  totalBet: number,
  spins: number,
): { rtp: number; hitRate: number; maxWin: number; freeSpinSessions: number } {
  const reel = buildReel(game);
  let wagered = 0;
  let won = 0;
  let hits = 0;
  let maxWin = 0;
  let freeSpinSessions = 0;
  let i = 0;

  while (i < spins) {
    wagered += totalBet;
    i++;
    const base = evaluateGrid(game, generateGrid(game, reel), totalBet);
    let win = base.totalWin;
    let free = base.freeSpinsWon;
    if (free > 0) {
      freeSpinSessions++;
      let guard = 0;
      while (free > 0 && guard < 500) {
        free--;
        guard++;
        const fs = evaluateGrid(game, generateGrid(game, reel), totalBet, { freeSpin: true });
        win += fs.totalWin;
        free += fs.freeSpinsWon;
      }
    }
    if (win > 0) hits++;
    maxWin = Math.max(maxWin, win);
    won += win;
  }

  return {
    rtp: (won / wagered) * 100,
    hitRate: (hits / spins) * 100,
    maxWin,
    freeSpinSessions,
  };
}
