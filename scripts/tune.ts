import { GAMES } from '../src/game/games';
import { rtpModel, rtpFromModel } from '../src/game/math';
import type { SlotGame } from '../src/game/types';

const TARGET = 0.96;

function nice(v: number): number {
  if (v <= 0) return 0;
  if (v < 10) return Math.max(1, Math.round(v));
  if (v < 100) return Math.round(v / 5) * 5;
  if (v < 1000) return Math.round(v / 10) * 10;
  return Math.round(v / 50) * 50;
}

function scaledPay(game: SlotGame, k: number, useNice: boolean): SlotGame {
  const conv = (p: number) => (p === 0 ? 0 : useNice ? nice(p * k) : p * k);
  return {
    ...game,
    symbols: game.symbols.map((s) => ({ ...s, pay: s.pay.map(conv) })),
    scatterPay: game.scatterPay?.map(conv),
  };
}

function getPay(game: SlotGame, key: string): number {
  const [symbolId, count] = key.split(':');
  if (symbolId === 'scatter') return game.scatterPay?.[Number(count)] ?? 0;
  return game.symbols.find((s) => s.id === symbolId)?.pay[Number(count)] ?? 0;
}

function setPay(game: SlotGame, key: string, value: number): SlotGame {
  const [symbolId, count] = key.split(':');
  if (symbolId === 'scatter') {
    return { ...game, scatterPay: game.scatterPay?.map((p, i) => (i === Number(count) ? value : p)) };
  }
  return {
    ...game,
    symbols: game.symbols.map((s) =>
      s.id === symbolId ? { ...s, pay: s.pay.map((p, i) => (i === Number(count) ? value : p)) } : s,
    ),
  };
}

const report: string[] = [];

for (const original of GAMES) {
  const model = rtpModel(original);
  const rtp1 = rtpFromModel(original, model) / 100;
  let k = TARGET / rtp1;

  let game = scaledPay(original, k, true);
  // жадная целочисленная подгонка: меняем выплаты на ±1 там, где это даёт лучший результат
  for (let attempt = 0; attempt < 400; attempt++) {
    const rtp = rtpFromModel(game, model) / 100;
    const delta = TARGET - rtp;
    if (Math.abs(delta) < 0.0004) break;
    let best: { key: string; next: number; score: number } | null = null;
    for (const entry of model.coefficients) {
      const current = getPay(game, entry.key);
      const step = entry.coefficient * model.factor;
      const options = [current + 1, current - 1];
      for (const next of options) {
        if (next < 0) continue;
        if (!entry.isScatter && next === 0) continue;
        const resulting = rtp + step * (next - current);
        const score = Math.abs(TARGET - resulting);
        if (!best || score < best.score) best = { key: entry.key, next, score };
      }
    }
    if (!best) break;
    game = setPay(game, best.key, best.next);
  }

  const rtp = rtpFromModel(game, model);
  const rounds = (value: number) => Math.round(value * 100) / 100;
  console.log(`\n### ${original.title}  RTP=${rtp.toFixed(2)}%  (k=${k.toFixed(3)})`);
  for (const s of game.symbols) {
    if (s.pay.every((p) => p === 0)) continue;
    console.log(`  ${s.label.padEnd(10)} w=${s.weight}  pay3=${s.pay[3]} pay4=${s.pay[4] ?? 0} pay5=${s.pay[5] ?? 0}`);
  }
  if (game.scatterPay) console.log(`  scatter: ${game.scatterPay.slice(3).join(' / ')}`);
  report.push(`${original.id}: ${rtp.toFixed(1)}%`);
}

console.log('\n' + report.join('\n'));
