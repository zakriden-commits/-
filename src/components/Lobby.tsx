import { useMemo, useState } from 'react';
import type { SlotGame } from '../game/types';
import { GAMES } from '../game/games';
import type { Wallet } from '../game/wallet';
import { formatMoney, formatCompact } from '../game/wallet';
import { SymbolIcon } from './SymbolIcon';
import { Coin } from './Coin';
import { InfoModal, type InfoKind } from './InfoModal';
import { Icon } from './Icon';

interface LobbyProps {
  wallet: Wallet;
  onPlay: (id: string) => void;
}

type Filter = 'all' | 'video' | 'classic' | 'bonus';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Все игры' },
  { id: 'video', label: '5 барабанов' },
  { id: 'classic', label: 'Классика 3×3' },
  { id: 'bonus', label: 'С фриспинами' },
];

function cardSymbols(game: SlotGame): { art: string; label: string }[] {
  const sorted = [...game.symbols].sort((a, b) => (b.pay[game.cols] ?? 0) - (a.pay[game.cols] ?? 0));
  const wild = sorted.find((s) => s.id === game.wildId);
  const picks = sorted.filter((s) => s.id !== game.wildId && s.id !== game.scatterId).slice(0, 2);
  return [picks[0], wild, picks[1]]
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
    .map((s) => ({ art: s.art, label: s.label }));
}

function GameCard({ game, onPlay }: { game: SlotGame; onPlay: (id: string) => void }) {
  const symbols = cardSymbols(game);
  return (
    <button
      className="game-card"
      onClick={() => onPlay(game.id)}
      style={{
        ['--art-from' as string]: game.theme.artFrom,
        ['--art-to' as string]: game.theme.artTo,
        ['--card-accent' as string]: game.theme.accent,
        ['--card-frame' as string]: game.theme.frame,
      }}
    >
      <span className="game-card__art">
        <span className="game-card__shine" />
        <span className="game-card__symbols">
          {symbols.map((symbol, index) => (
            <span className={`game-card__symbol game-card__symbol--${index}`} key={symbol.label}>
              <SymbolIcon art={symbol.art} label={symbol.label} />
            </span>
          ))}
        </span>
        <span className="game-card__badge">
          {game.freeSpins ? `×${game.freeSpins.multiplier} фриспины` : 'Классика'}
        </span>
      </span>
      <span className="game-card__body">
        <span className="game-card__provider">{game.provider}</span>
        <strong className="game-card__title">{game.title}</strong>
        <span className="game-card__subtitle">{game.subtitle}</span>
        <span className="game-card__meta">
          <span>{game.paylines.length} линий</span>
          <span>RTP {game.rtp.toFixed(1)}%</span>
          <span>{game.volatility}</span>
        </span>
        <span className="game-card__play">Играть демо →</span>
      </span>
    </button>
  );
}

export function Lobby({ wallet, onPlay }: LobbyProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const [info, setInfo] = useState<InfoKind | null>(null);

  const games = useMemo(() => {
    if (filter === 'video') return GAMES.filter((g) => g.layout === 'video');
    if (filter === 'classic') return GAMES.filter((g) => g.layout === 'classic');
    if (filter === 'bonus') return GAMES.filter((g) => Boolean(g.freeSpins));
    return GAMES;
  }, [filter]);

  const featured = GAMES[0];
  const featuredSymbols = cardSymbols(featured);

  return (
    <div className="lobby">
      <div className="lobby__aurora" aria-hidden />
      <div className="lobby__grain" aria-hidden />

      <header className="topbar">
        <button className="brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <span className="brand__mark">✦</span>
          <span className="brand__text">
            AURUM<em>demo casino</em>
          </span>
        </button>

        <nav className="topnav">
          <a href="#games">Игры</a>
          <button onClick={() => setInfo('how')}>Как играть</button>
          <button onClick={() => setInfo('responsible')}>18+</button>
        </nav>

        <div className="topbar__right">
          <button className="wallet-chip" onClick={wallet.topUp} title="Добавить 5 000 демо-кредитов">
            <Coin size={18} />
            <span>{formatMoney(wallet.state.balance)}</span>
            <span className="wallet-chip__plus">+</span>
          </button>
          <button className="icon-btn" onClick={wallet.toggleSound} aria-label={wallet.state.soundOn ? 'Выключить звук' : 'Включить звук'}>
            <Icon name={wallet.state.soundOn ? 'sound-on' : 'sound-off'} />
          </button>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="hero__copy">
            <span className="pill pill--gold">
              <span className="pill__dot" /> Демо-режим · виртуальные кредиты
            </span>
            <h1 className="hero__title">
              Крутите барабаны.
              <br />
              <span className="text-gold">Без риска.</span>
            </h1>
            <p className="hero__text">
              Четыре слота с настоящей математикой: взвешенные барабаны, Wild, Scatter, фриспины и RTP ≈96%.
              Играйте на бесплатные кредиты — никаких ставок реальными деньгами.
            </p>
            <div className="hero__actions">
              <button className="gold-btn gold-btn--lg" onClick={() => onPlay(featured.id)}>
                Играть в {featured.title}
              </button>
              <button className="outline-btn" onClick={() => setInfo('how')}>
                Как это работает
              </button>
            </div>
            <div className="hero__trust">
              <span><Icon name="shield" size={14} /> Честный ГСЧ</span>
              <span><Icon name="chart" size={14} /> RTP ≈96%</span>
              <span><Icon name="bolt" size={14} /> Без регистрации</span>
            </div>
          </div>

          <button className="hero__art" onClick={() => onPlay(featured.id)}>
            <span className="hero__machine">
              <span className="hero__machine-glow" />
              <span className="hero__machine-title">{featured.title}</span>
              <span className="hero__machine-sub">{featured.subtitle}</span>
              <span className="hero__reels">
                {featuredSymbols.map((symbol, index) => (
                  <span className={`hero__reel hero__reel--${index}`} key={symbol.label}>
                    <span className="hero__reel-label">{index + 1}</span>
                    {[0, 1, 2].map((offset) => {
                      const item = featuredSymbols[(index + offset) % featuredSymbols.length];
                      return (
                        <span className="hero__reel-cell" key={offset}>
                          <SymbolIcon art={item.art} label={item.label} />
                        </span>
                      );
                    })}
                  </span>
                ))}
              </span>
              <span className="hero__machine-foot">
                <span>20 линий</span>
                <span>Фриспины ×2</span>
                <span className="hero__play">Играть</span>
              </span>
            </span>
            <span className="hero__spark hero__spark--1">✦</span>
            <span className="hero__spark hero__spark--2">✦</span>
            <span className="hero__spark hero__spark--3">✦</span>
          </button>
        </section>

        <section className="statbar">
          <div className="statbar__item">
            <span className="statbar__value">{GAMES.length}</span>
            <span className="statbar__label">автомата</span>
          </div>
          <div className="statbar__item">
            <span className="statbar__value">{formatCompact(wallet.state.spins)}</span>
            <span className="statbar__label">спинов сделано</span>
          </div>
          <div className="statbar__item">
            <span className="statbar__value">
              {wallet.state.biggestWinX > 0 ? `${wallet.state.biggestWinX.toFixed(1)}×` : '—'}
            </span>
            <span className="statbar__label">лучший множитель</span>
          </div>
          <div className="statbar__item">
            <span className="statbar__value text-gold">{formatMoney(wallet.state.balance)}</span>
            <span className="statbar__label">демо-баланс</span>
          </div>
        </section>

        <section className="games" id="games">
          <div className="section-head">
            <div>
              <span className="section-eyebrow">Коллекция</span>
              <h2 className="section-title">Автоматы</h2>
            </div>
            <div className="filters">
              {FILTERS.map((item) => (
                <button
                  key={item.id}
                  className={`filter ${filter === item.id ? 'is-active' : ''}`}
                  onClick={() => setFilter(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="game-grid">
            {games.map((game) => (
              <GameCard key={game.id} game={game} onPlay={onPlay} />
            ))}
          </div>

          {wallet.state.recent.length > 0 && (
            <div className="recent">
              <span className="recent__label">Недавно играли</span>
              <div className="recent__row">
                {wallet.state.recent.map((id) => {
                  const game = GAMES.find((g) => g.id === id);
                  if (!game) return null;
                  return (
                    <button key={id} className="recent-chip" onClick={() => onPlay(id)}>
                      {game.title}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        <section className="trust">
          <div className="trust__item">
            <span className="trust__icon"><Icon name="dice" size={22} /></span>
            <h3>Настоящий ГСЧ</h3>
            <p>
              Каждый символ выбирается взвешенным генератором на криптографическом источнике случайности —
              никаких «подкрученных» серий.
            </p>
          </div>
          <div className="trust__item">
            <span className="trust__icon"><Icon name="calc" size={22} /></span>
            <h3>Проверенная математика</h3>
            <p>
              RTP каждой игры — от 95,7% до 96,0%. Таблицы выплат подобраны аналитически и подтверждены
              симуляцией на миллионе спинов.
            </p>
          </div>
          <div className="trust__item">
            <span className="trust__icon"><Icon name="target" size={22} /></span>
            <h3>Только демо</h3>
            <p>
              Нет депозитов, регистрации и вывода средств. Пополняйте виртуальный баланс бесплатно сколько
              угодно.
            </p>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="footer__top">
          <div className="footer__brand">
            <span className="brand__mark">✦</span> AURUM
            <p>Демонстрационное казино со слотами. Создано ради механики, а не ради ставок.</p>
          </div>
          <div className="footer__cols">
            <div>
              <h4>Игра</h4>
              {GAMES.map((game) => (
                <button key={game.id} onClick={() => onPlay(game.id)}>
                  {game.title}
                </button>
              ))}
            </div>
            <div>
              <h4>Информация</h4>
              <button onClick={() => setInfo('how')}>Как играть</button>
              <button onClick={() => setInfo('about')}>О математике</button>
              <button onClick={() => setInfo('responsible')}>Ответственная игра</button>
            </div>
          </div>
        </div>
        <div className="footer__bottom">
          <span className="age-badge">18+</span>
          <p>
            AURUM — демо-проект. Виртуальные кредиты не имеют денежной стоимости, ставки и выплаты реальными
            деньгами невозможны. Азартные игры могут вызывать зависимость — играйте ответственно.
          </p>
        </div>
      </footer>

      {info && <InfoModal kind={info} onClose={() => setInfo(null)} />}
    </div>
  );
}
