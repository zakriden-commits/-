import { Icon } from './Icon';
import { useEffect, useState } from 'react';
import type { SlotGame } from '../game/types';
import { formatMoney } from '../game/wallet';
import { SymbolIcon } from './SymbolIcon';

interface PaytableModalProps {
  game: SlotGame;
  bet: number;
  onClose: () => void;
}

type Tab = 'pays' | 'lines' | 'rules';

export function PaytableModal({ game, bet, onClose }: PaytableModalProps) {
  const [tab, setTab] = useState<Tab>('pays');
  const lineBet = bet / game.paylines.length;
  const counts = game.cols === 3 ? [3] : [3, 4, 5];

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const sorted = [...game.symbols].sort((a, b) => {
    const va = a.pay[game.cols] ?? 0;
    const vb = b.pay[game.cols] ?? 0;
    return vb - va;
  });

  return (
    <div className="modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal__panel" onClick={(event) => event.stopPropagation()}>
        <div className="modal__head">
          <div>
            <p className="modal__eyebrow">{game.title}</p>
            <h2 className="modal__title">Информация об игре</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Закрыть">
            <Icon name="close" size={16} />
          </button>
        </div>

        <div className="tabs">
          <button className={`tab ${tab === 'pays' ? 'is-active' : ''}`} onClick={() => setTab('pays')}>
            Выплаты
          </button>
          <button className={`tab ${tab === 'lines' ? 'is-active' : ''}`} onClick={() => setTab('lines')}>
            Линии · {game.paylines.length}
          </button>
          <button className={`tab ${tab === 'rules' ? 'is-active' : ''}`} onClick={() => setTab('rules')}>
            Правила
          </button>
        </div>

        <div className="modal__body">
          {tab === 'pays' && (
            <>
              <p className="paytable__note">
                Выплаты указаны в ставках на линию · сейчас <strong>{formatMoney(lineBet)}</strong>
              </p>
              <div className="paytable">
                <div className="paytable__head">
                  <span>Символ</span>
                  {counts.map((c) => (
                    <span key={c}>×{c}</span>
                  ))}
                </div>
                {sorted.map((symbol) => {
                  const isScatter = symbol.id === game.scatterId;
                  const isWild = symbol.id === game.wildId;
                  return (
                    <div className={`paytable__row ${isWild ? 'is-wild' : ''} ${isScatter ? 'is-scatter' : ''}`} key={symbol.id}>
                      <div className="paytable__sym">
                        <span className="paytable__icon">
                          <SymbolIcon art={symbol.art} label={symbol.label} glow={symbol.glow} />
                        </span>
                        <span>
                          <strong>{symbol.label}</strong>
                          {isWild && <em>заменяет любые символы</em>}
                          {isScatter && <em>платит по общей ставке</em>}
                        </span>
                      </div>
                      {counts.map((count) => {
                        const value = isScatter ? game.scatterPay?.[count] ?? 0 : symbol.pay[count] ?? 0;
                        return (
                          <span className="paytable__pay" key={count}>
                            {value > 0 ? `${value}×` : '—'}
                          </span>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
              <div className="paytable__meta">
                <span>RTP <strong>{game.rtp.toFixed(1)}%</strong></span>
                <span>Волатильность <strong>{game.volatility}</strong></span>
                <span>{game.paylines.length} линий</span>
                <span>Макс. ставка <strong>{formatMoney(game.betLevels[game.betLevels.length - 1])}</strong></span>
              </div>
            </>
          )}

          {tab === 'lines' && (
            <div className="lines-grid">
              {game.paylines.map((line, index) => (
                <div className="line-preview" key={index}>
                  <div
                    className="line-preview__grid"
                    style={{ ['--cols' as string]: game.cols, ['--rows' as string]: game.rows }}
                  >
                    {Array.from({ length: game.cols * game.rows }).map((_, cellIndex) => {
                      const col = cellIndex % game.cols;
                      const row = Math.floor(cellIndex / game.cols);
                      const active = line.rows[col] === row;
                      return <span key={cellIndex} className={active ? 'is-on' : ''} />;
                    })}
                  </div>
                  <span className="line-preview__num">{index + 1}</span>
                </div>
              ))}
            </div>
          )}

          {tab === 'rules' && (
            <div className="rules">
              <p>{game.blurb}</p>
              <h3>Wild</h3>
              <p>
                Символ <strong>Wild</strong> заменяет любой обычный символ и помогает собрать выигрышную
                комбинацию с самой левой колонки. Линия из одних Wild оплачивается по максимальной таблице.
              </p>
              {game.scatterId && (
                <>
                  <h3>Scatter и фриспины</h3>
                  <p>
                    <strong>{game.symbols.find((s) => s.id === game.scatterId)?.label}</strong> появляется в любом
                    месте барабанов. {game.freeSpins ? `${game.freeSpins.minScatters} и более скаттеров запускают фриспины — до ${Math.max(...game.freeSpins.spinsByCount)} вращений с множителем ×${game.freeSpins.multiplier}.` : ''} Скаттеры платят по общей ставке.
                  </p>
                </>
              )}
              <h3>Выплаты по линиям</h3>
              <p>
                Комбинация считается слева направо, начиная с первого барабана. Выплачиваются все линии
                одновременно, поэтому один спин может принести несколько выигрышей.
              </p>
              <h3>Математика</h3>
              <p>
                Барабаны используют взвешенный генератор случайных чисел на базе <code>crypto.getRandomValues</code>.
                Теоретический возврат игроку (RTP) — <strong>{game.rtp.toFixed(1)}%</strong>, рассчитан аналитически
                по таблице выплат и вероятностям символов.
              </p>
              <p className="rules__disclaimer">
                Это демонстрационная игра на виртуальные кредиты. Реальные деньги не участвуют, вывод средств
                невозможен.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
