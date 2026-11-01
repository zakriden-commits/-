import { Icon } from './Icon';
import { useEffect } from 'react';

export type InfoKind = 'how' | 'responsible' | 'about';

interface InfoModalProps {
  kind: InfoKind;
  onClose: () => void;
}

const CONTENT: Record<InfoKind, { eyebrow: string; title: string; body: React.ReactNode }> = {
  how: {
    eyebrow: 'Правила',
    title: 'Как играть',
    body: (
      <>
        <ol className="steps">
          <li>
            <strong>Выберите автомат.</strong> В лобби четыре игры с разной волатильностью — от спокойных
            классических «Neon Fruits» до высокорискового «Dragon's Fortune».
          </li>
          <li>
            <strong>Настройте ставку.</strong> Кнопки − и + меняют общую ставку. Она делится поровну между
            всеми линиями выплат.
          </li>
          <li>
            <strong>Крутите.</strong> Нажмите «Крутить» или пробел. Пять барабанов останавливаются по очереди,
            выигрышные символы подсвечиваются.
          </li>
          <li>
            <strong>Собирайте комбинации.</strong> Выигрыш считается слева направо с первого барабана. Wild
            заменяет любой символ, Scatter платит в любом месте и запускает фриспины.
          </li>
          <li>
            <strong>Используйте автоигру.</strong> Кнопка «Авто» запускает 25 спинов подряд, «Турбо» ускоряет
            анимацию, «50 автоспинов» — быстрый запуск серии.
          </li>
        </ol>
        <p className="info-note">
          Все выплаты указаны в ставках на линию и умножаются на вашу текущую ставку. Полная таблица выплат —
          по кнопке ⓘ внутри игры.
        </p>
      </>
    ),
  },
  responsible: {
    eyebrow: '18+',
    title: 'Ответственная игра',
    body: (
      <>
        <p>
          AURUM — демонстрационный проект. Здесь нельзя внести деньги, вывести выигрыш или купить что-либо.
          Баланс пополняется бесплатными виртуальными кредитами, и его нельзя обменять на реальные ценности.
        </p>
        <p>
          Если вы играете в азартные игры на реальные деньги, помните о рисках: игра должна оставаться
          развлечением. Установите лимит по времени и сумме, не пытайтесь «отыграться» и делайте паузы.
        </p>
        <ul className="info-list">
          <li>Играйте только на деньги, потерю которых можете позволить.</li>
          <li>Не играйте, чтобы решить финансовые проблемы.</li>
          <li>Если игра перестала приносить удовольствие — обратитесь за помощью.</li>
          <li>Азартные игры запрещены для лиц младше 18 лет.</li>
        </ul>
        <p className="info-note">
          В демо-режиме нет депозитов, бонусов и реальных выплат — это безопасная песочница, чтобы изучить
          механику слотов.
        </p>
      </>
    ),
  },
  about: {
    eyebrow: 'О проекте',
    title: 'Как устроен AURUM',
    body: (
      <>
        <p>
          Это демо-казино с четырьмя слотами, у каждого — взвешенные барабаны, таблица выплат, линии, Wild,
          Scatter и фриспины. Исход каждого спина определяется взвешенным ГСЧ на базе{' '}
          <code>crypto.getRandomValues</code> — так же, как в сертифицированных автоматах.
        </p>
        <p>
          Теоретический возврат игроку (RTP) — <strong>95,7–96,0%</strong> в зависимости от автомата. Он посчитан аналитически:
          перебором всех комбинаций линии и биномиальным распределением скаттеров, с учётом фриспинов и
          ретриггеров. Симуляция на миллионе спинов подтверждает расчёт.
        </p>
        <p>
          Технически: React + TypeScript, SVG-графика и звук, синтезированный через WebAudio. Никаких сторонних
          SDK казино и реальных денег.
        </p>
        <p className="info-note">Проект создан как демонстрация игровой механики, а не как азартная игра.</p>
      </>
    ),
  },
};

export function InfoModal({ kind, onClose }: InfoModalProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const content = CONTENT[kind];

  return (
    <div className="modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal__panel" onClick={(event) => event.stopPropagation()}>
        <div className="modal__head">
          <div>
            <p className="modal__eyebrow">{content.eyebrow}</p>
            <h2 className="modal__title">{content.title}</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Закрыть">
            <Icon name="close" size={16} />
          </button>
        </div>
        <div className="modal__body">{content.body}</div>
      </div>
    </div>
  );
}
