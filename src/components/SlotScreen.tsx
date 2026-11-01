import { useEffect, useMemo, useRef, useState } from 'react';
import type { SlotGame } from '../game/types';
import type { Wallet } from '../game/wallet';
import { formatMoney } from '../game/wallet';
import { useSlotMachine } from '../game/useSlotMachine';
import { sound } from '../game/sound';
import { Reels } from './Reels';
import { PaytableModal } from './PaytableModal';
import { SymbolIcon } from './SymbolIcon';
import { Icon } from './Icon';
import { Coin } from './Coin';

interface SlotScreenProps {
  game: SlotGame;
  wallet: Wallet;
  onBack: () => void;
  onPlayGame: (id: string) => void;
  allGames: SlotGame[];
}

function useCountUp(target: number, duration = 700) {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);

  useEffect(() => {
    const from = fromRef.current;
    if (Math.abs(from - target) < 0.001) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.max(0, Math.min(1, (now - start) / duration));
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (target - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}

const CONFETTI_COLORS = ['#ffd166', '#ff5fa2', '#7fe9ff', '#9dffcf', '#c4a4ff'];

export function SlotScreen({ game, wallet, onBack, onPlayGame, allGames }: SlotScreenProps) {
  const machine = useSlotMachine(game, wallet);
  const {
    grid,
    bet,
    spinning,
    spinId,
    result,
    freeSpins,
    fsIntro,
    fsSummary,
    autoplay,
    turbo,
    bigWin,
    message,
    inFreeSpins,
  } = machine;

  const [showPaytable, setShowPaytable] = useState(false);
  const [winDisplay, setWinDisplay] = useState(0);

  const balance = useCountUp(wallet.state.balance, 450);
  const winValue = useCountUp(winDisplay, 550);
  const fsWin = useCountUp(freeSpins.won, 500);

  const winPositions = useMemo(() => {
    const set = new Set<string>();
    result?.lineWins.forEach((win) => win.positions.forEach((p) => set.add(`${p.col}:${p.row}`)));
    return set;
  }, [result]);

  const scatterPositions = useMemo(() => {
    const set = new Set<string>();
    const minScatters = game.freeSpins?.minScatters ?? 3;
    if (!result || !game.scatterId || result.scatterCount < minScatters) return set;
    result.grid.forEach((column, col) =>
      column.forEach((symbol, row) => {
        if (symbol === game.scatterId) set.add(`${col}:${row}`);
      }),
    );
    return set;
  }, [result, game.scatterId, game.freeSpins]);

  useEffect(() => {
    if (spinning) {
      setWinDisplay(0);
      return;
    }
    if (result) setWinDisplay(result.totalWin);
  }, [result, spinning]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !showPaytable && !fsIntro && !fsSummary) {
        event.preventDefault();
        machine.spin();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [machine, showPaytable, fsIntro, fsSummary]);

  const themeStyle = {
    ['--bg' as string]: game.theme.bg,
    ['--bg-alt' as string]: game.theme.bgAlt,
    ['--accent' as string]: game.theme.accent,
    ['--accent-soft' as string]: game.theme.accentSoft,
    ['--cell' as string]: game.theme.cell,
    ['--cell-alt' as string]: game.theme.cellAlt,
    ['--frame' as string]: game.theme.frame,
  } as React.CSSProperties;

  const confetti = useMemo(
    () =>
      Array.from({ length: 28 }).map((_, i) => ({
        left: `${(i * 37) % 100}%`,
        delay: `${(i % 9) * 0.12}s`,
        duration: `${1.6 + ((i * 13) % 9) / 10}s`,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: 5 + (i % 4) * 2,
      })),
    [],
  );

  const canSpin = !spinning && !fsIntro && !inFreeSpins && !fsSummary;

  return (
    <div className={`slot slot--${game.layout}`} style={themeStyle} data-rows={game.rows}>
      <div className="slot__aurora" aria-hidden />
      <div className="slot__grain" aria-hidden />

      <header className="slot__header">
        <button className="ghost-btn" onClick={onBack} aria-label="Вернуться в лобби">
          <span className="ghost-btn__arrow">‹</span>
          <span className="ghost-btn__text">Лобби</span>
        </button>

        <div className="slot__titles">
          <span className="slot__provider">{game.provider}</span>
          <h1 className="slot__name">{game.title}</h1>
        </div>

        <div className="slot__wallet">
          <button className="wallet-chip" onClick={wallet.topUp} title="Добавить 5 000 демо-кредитов">
            <Coin size={18} />
            <span>{formatMoney(balance)}</span>
            <span className="wallet-chip__plus">+</span>
          </button>
          <button className="icon-btn" onClick={wallet.toggleSound} aria-label={wallet.state.soundOn ? 'Выключить звук' : 'Включить звук'}>
            <Icon name={wallet.state.soundOn ? 'sound-on' : 'sound-off'} />
          </button>
        </div>
      </header>

      <div className="stage">
        <div className="cabinet">
          <div className="cabinet__bar">
            <div className="cabinet__logo">
              <span className="cabinet__logo-mark">✦</span>
              {game.title}
            </div>
            <div className="cabinet__features">
              {game.features.map((feature) => (
                <span key={feature} className="feature-pill">
                  {feature}
                </span>
              ))}
            </div>
            <button className="icon-btn icon-btn--dark" onClick={() => setShowPaytable(true)} aria-label="Таблица выплат">
              <Icon name="info" size={16} />
            </button>
          </div>

          <div className="cabinet__screen">
            <div className="screen__glow" aria-hidden />
            <Reels
              game={game}
              grid={grid}
              spinId={spinId}
              spinning={spinning}
              winPositions={winPositions}
              scatterPositions={scatterPositions}
              turbo={turbo}
              onComplete={machine.revealComplete}
            />

            {inFreeSpins && (
              <div className="fs-hud">
                <span className="fs-hud__label">Фриспины</span>
                <strong>
                  {freeSpins.remaining} / {freeSpins.total}
                </strong>
                <span className="fs-hud__mult">×{freeSpins.multiplier}</span>
                <span className="fs-hud__win">+{formatMoney(fsWin)}</span>
              </div>
            )}

            {message && <div className="toast">{message}</div>}
          </div>

          <div className="cabinet__readout">
            <div className="readout__cell">
              <span>Ставка</span>
              <strong>{formatMoney(bet)}</strong>
            </div>
            <div className={`readout__cell readout__win ${winDisplay > 0 ? 'is-hot' : ''}`}>
              <span>{inFreeSpins ? 'Выигрыш за спин' : 'Выигрыш'}</span>
              <strong>{formatMoney(winValue)}</strong>
            </div>
            <div className="readout__cell">
              <span>Линий</span>
              <strong>{game.paylines.length}</strong>
            </div>
          </div>
        </div>

        <div className="controlbar">
          <div className="betbox">
            <button className="betbox__btn" onClick={() => machine.changeBet(-1)} disabled={spinning || inFreeSpins}>
              −
            </button>
            <div className="betbox__value">
              <span>Ставка</span>
              <strong>{formatMoney(bet)}</strong>
              <em>
                {game.paylines.length} линий · {formatMoney(bet / game.paylines.length)}/линия
              </em>
            </div>
            <button className="betbox__btn" onClick={() => machine.changeBet(1)} disabled={spinning || inFreeSpins}>
              +
            </button>
          </div>

          <button
            className={`spin-btn ${spinning ? 'is-spinning' : ''} ${inFreeSpins ? 'is-free' : ''}`}
            onClick={() => machine.spin()}
            disabled={!canSpin}
          >
            <span className="spin-btn__halo" aria-hidden />
            <span className="spin-btn__icon">{inFreeSpins ? '∞' : '↻'}</span>
            <span className="spin-btn__label">{spinning ? '…' : inFreeSpins ? 'ФРИСПИН' : 'КРУТИТЬ'}</span>
          </button>

          <div className="side-controls">
            <button
              className={`ctrl-btn ${autoplay > 0 ? 'is-active' : ''}`}
              onClick={machine.toggleAutoplay}
              disabled={inFreeSpins || spinning}
            >
              <span className="ctrl-btn__icon"><Icon name="play" size={13} /></span>
              <span className="ctrl-btn__label">Авто</span>
              <span className="ctrl-btn__badge">{autoplay > 0 ? autoplay : '∞'}</span>
            </button>
            <button
              className={`ctrl-btn ${turbo ? 'is-active' : ''}`}
              onClick={() => {
                machine.setTurbo(!turbo);
                sound.click();
              }}
            >
              <span className="ctrl-btn__icon"><Icon name="bolt" size={14} /></span>
              <span className="ctrl-btn__label">Турбо</span>
            </button>
            <button className="ctrl-btn" onClick={() => setShowPaytable(true)}>
              <span className="ctrl-btn__icon"><Icon name="info" size={15} /></span>
              <span className="ctrl-btn__label">Инфо</span>
            </button>
          </div>
        </div>

        <div className="quickbar">
          <button className="quick-btn" onClick={wallet.topUp}>
            <Coin size={15} /> +5 000
          </button>
          <button
            className="quick-btn"
            onClick={() => machine.setBetLevel(game.betLevels.length - 1)}
            disabled={spinning || inFreeSpins}
          >
            Макс. ставка
          </button>
          <button className="quick-btn" onClick={() => machine.setAutoplay(50)} disabled={inFreeSpins || spinning}>
            50 автоспинов
          </button>
          <button className="quick-btn quick-btn--muted" onClick={wallet.reset}>
            Сбросить демо-баланс
          </button>
        </div>

        <div className="slot__facts">
          <div>
            <span>RTP</span>
            <strong>{game.rtp.toFixed(1)}%</strong>
          </div>
          <div>
            <span>Волатильность</span>
            <strong>{game.volatility}</strong>
          </div>
          <div>
            <span>Ваши спины</span>
            <strong>{wallet.state.stats[game.id]?.spins ?? 0}</strong>
          </div>
          <div>
            <span>Лучший выигрыш</span>
            <strong>{formatMoney(wallet.state.stats[game.id]?.best ?? 0)}</strong>
          </div>
        </div>

        <div className="more-games">
          <p className="more-games__title">Другие автоматы</p>
          <div className="more-games__row">
            {allGames
              .filter((g) => g.id !== game.id)
              .map((g) => (
                <button key={g.id} className="mini-game" onClick={() => onPlayGame(g.id)}>
                  <span className="mini-game__art" style={{ background: `linear-gradient(135deg, ${g.theme.artFrom}, ${g.theme.artTo})` }}>
                    {g.symbols
                      .filter((s) => s.kind !== 'scatter')
                      .slice(-3)
                      .reverse()
                      .map((s) => (
                        <span key={s.id}>
                          <SymbolIcon art={s.art} label={s.label} />
                        </span>
                      ))}
                  </span>
                  <span className="mini-game__meta">
                    <strong>{g.title}</strong>
                    <em>{g.paylines.length} линий · RTP {g.rtp.toFixed(1)}%</em>
                  </span>
                </button>
              ))}
          </div>
        </div>

        <p className="demo-note">
          Демо-режим: только виртуальные кредиты. Реальные ставки и выигрыши невозможны. 18+
        </p>
      </div>

      {showPaytable && <PaytableModal game={game} bet={bet} onClose={() => setShowPaytable(false)} />}

      {fsIntro && (
        <div className="overlay">
          <div className="overlay__card overlay__card--fs">
            <div className="fs-orbits" aria-hidden>
              {Array.from({ length: 12 }).map((_, i) => (
                <span key={i} style={{ ['--i' as string]: i }} />
              ))}
            </div>
            <p className="overlay__eyebrow">Бонус активирован</p>
            <h2 className="overlay__title">{fsIntro.spins} фриспинов</h2>
            <p className="overlay__text">
              Все выигрыши во время бесплатных вращений умножаются на <strong>×{fsIntro.multiplier}</strong>
            </p>
            <button className="gold-btn" onClick={machine.startFreeSpins}>
              Начать
            </button>
          </div>
        </div>
      )}

      {fsSummary && (
        <div className="overlay">
          <div className="overlay__card">
            <p className="overlay__eyebrow">Фриспины завершены</p>
            <h2 className="overlay__title">{formatMoney(fsSummary.won)}</h2>
            <p className="overlay__text">Выигрыш за бесплатные вращения зачислен на баланс</p>
            <button className="gold-btn" onClick={machine.closeFsSummary}>
              Продолжить
            </button>
          </div>
        </div>
      )}

      {bigWin && (
        <div className="overlay overlay--win" onClick={machine.dismissBigWin}>
          <div className="confetti" aria-hidden>
            {confetti.map((piece, i) => (
              <span
                key={i}
                style={{
                  left: piece.left,
                  animationDelay: piece.delay,
                  animationDuration: piece.duration,
                  background: piece.color,
                  width: piece.size,
                  height: piece.size * 1.6,
                }}
              />
            ))}
          </div>
          <div className="win-card" onClick={(event) => event.stopPropagation()}>
            <p className="win-card__eyebrow">{bigWin.multiplier >= 50 ? 'Мега выигрыш' : 'Большой выигрыш'}</p>
            <h2 className="win-card__amount">{formatMoney(bigWin.amount)}</h2>
            <p className="win-card__mult">×{bigWin.multiplier.toFixed(1)} от ставки</p>
            <button className="gold-btn" onClick={machine.dismissBigWin}>
              Забрать
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
