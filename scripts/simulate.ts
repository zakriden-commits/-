import { GAMES } from '../src/game/games';
import { simulateSession } from '../src/game/engine';

const spins = Number(process.argv[2] ?? 400000);
const bet = 1;

console.log(`Симуляция: ${spins.toLocaleString('ru-RU')} спинов на игру, ставка ${bet}\n`);

for (const game of GAMES) {
  const started = Date.now();
  const stats = simulateSession(game, bet, spins);
  const fsFrequency = spins / Math.max(1, stats.freeSpinSessions);
  console.log(
    `${game.title.padEnd(18)} RTP ${stats.rtp.toFixed(2)}%  hit ${stats.hitRate.toFixed(1)}%  ` +
      `макс. выигрыш ${stats.maxWin.toFixed(0)}×  фриспины 1/${fsFrequency.toFixed(0)}  ` +
      `(${((Date.now() - started) / 1000).toFixed(1)} c)`,
  );
}
