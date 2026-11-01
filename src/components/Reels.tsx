import { useCallback, useEffect, useRef, useState } from 'react';
import type { SlotGame, SymbolId } from '../game/types';
import { sound } from '../game/sound';
import { SymbolIcon } from './SymbolIcon';

const FILLER = 14;

interface ReelsProps {
  game: SlotGame;
  grid: SymbolId[][];
  spinId: number;
  spinning: boolean;
  winPositions: Set<string>;
  scatterPositions: Set<string>;
  turbo: boolean;
  onComplete: () => void;
}

function randomSymbol(game: SlotGame): SymbolId {
  const total = game.symbols.reduce((acc, s) => acc + Math.max(0, s.weight), 0);
  let target = Math.random() * total;
  for (const symbol of game.symbols) {
    target -= Math.max(0, symbol.weight);
    if (target <= 0) return symbol.id;
  }
  return game.symbols[0].id;
}

interface Strip {
  symbols: SymbolId[];
  duration: number;
}

export function Reels({
  game,
  grid,
  spinId,
  spinning,
  winPositions,
  scatterPositions,
  turbo,
  onComplete,
}: ReelsProps) {
  const [strips, setStrips] = useState<Strip[]>(() =>
    grid.map((column) => ({ symbols: column.slice(), duration: 0 })),
  );
  const [animating, setAnimating] = useState(false);
  const stopped = useRef<Set<number>>(new Set());
  const finished = useRef<number>(-1);
  const timers = useRef<number[]>([]);

  const finalize = useCallback(() => {
    if (finished.current === spinId) return;
    finished.current = spinId;
    onComplete();
  }, [onComplete, spinId]);

  useEffect(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    if (!spinning) {
      setAnimating(false);
      return;
    }

    stopped.current = new Set();
    const base = turbo ? 420 : 820;
    const step = turbo ? 90 : 165;
    const nextStrips: Strip[] = grid.map((column, index) => ({
      symbols: [
        ...Array.from({ length: FILLER }, () => randomSymbol(game)),
        ...column,
      ],
      duration: base + index * step,
    }));
    setStrips(nextStrips);
    setAnimating(true);

    const longest = base + (game.cols - 1) * step;
    timers.current.push(window.setTimeout(finalize, longest + 900));
    return () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinId]);

  const handleStop = (col: number) => {
    if (stopped.current.has(col)) return;
    stopped.current.add(col);
    sound.reelStop(col);
    if (stopped.current.size >= game.cols) {
      timers.current.push(window.setTimeout(finalize, 90));
    }
  };

  return (
    <div
      className={`reels ${spinning ? 'reels--spinning' : ''} ${animating ? 'reels--animating' : ''}`}
      style={{ ['--cols' as string]: game.cols, ['--rows' as string]: game.rows }}
    >
      {strips.map((strip, col) => {
        const total = strip.symbols.length;
        const rest = total > game.rows ? -((total - game.rows) / total) * 100 : 0;
        const firstFinalIndex = total - game.rows;
        return (
          <div className="reel" key={col}>
            <div
              className="reel__strip"
              key={`${spinId}-${col}-${strip.symbols.length}`}
              style={
                animating && strip.duration > 0
                  ? ({
                      ['--rest' as string]: `${rest}%`,
                      animation: `reel-roll ${strip.duration}ms cubic-bezier(0.16, 0.68, 0.15, 1) both`,
                    } as React.CSSProperties)
                  : undefined
              }
              onAnimationEnd={() => handleStop(col)}
            >
              {strip.symbols.map((symbolId, index) => {
                const isFinal = index >= firstFinalIndex;
                const row = index - firstFinalIndex;
                const def = game.symbols.find((s) => s.id === symbolId);
                const key = `${col}:${row}`;
                const isWin = isFinal && winPositions.has(key);
                const isScatter = isFinal && scatterPositions.has(key);
                return (
                  <div className="reel__cell" key={index}>
                    <div
                      className={`reel__tile ${isWin ? 'is-win' : ''} ${isScatter ? 'is-scatter' : ''}`}
                      data-symbol={symbolId}
                    >
                      <SymbolIcon art={def?.art ?? 'card'} label={def?.label} glow={def?.glow} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
