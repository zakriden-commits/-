import type { Payline, SlotGame, SymbolDef } from './types';

/* ------------------------------------------------------------------
   Линии выплат
------------------------------------------------------------------ */

const line = (rows: number[]): Payline => ({ rows });

/** 5 барабанов × 3 ряда — классический набор из 20 линий */
const LINES_20: Payline[] = [
  line([1, 1, 1, 1, 1]),
  line([0, 0, 0, 0, 0]),
  line([2, 2, 2, 2, 2]),
  line([0, 1, 2, 1, 0]),
  line([2, 1, 0, 1, 2]),
  line([1, 0, 0, 0, 1]),
  line([1, 2, 2, 2, 1]),
  line([0, 0, 1, 2, 2]),
  line([2, 2, 1, 0, 0]),
  line([1, 2, 1, 0, 1]),
  line([1, 0, 1, 2, 1]),
  line([0, 1, 1, 1, 0]),
  line([2, 1, 1, 1, 2]),
  line([1, 1, 0, 1, 1]),
  line([1, 1, 2, 1, 1]),
  line([0, 0, 2, 0, 0]),
  line([2, 2, 0, 2, 2]),
  line([0, 2, 1, 2, 0]),
  line([2, 0, 1, 0, 2]),
  line([1, 0, 2, 0, 1]),
];

/** 5×3 — 25 линий */
const LINES_25: Payline[] = [
  ...LINES_20,
  line([0, 1, 0, 1, 0]),
  line([2, 1, 2, 1, 2]),
  line([0, 2, 2, 2, 0]),
  line([2, 0, 0, 0, 2]),
  line([1, 2, 1, 2, 1]),
];

/** 5×4 — 40 линий: 20 по верхним трём рядам + те же 20 со сдвигом на ряд вниз */
const LINES_40: Payline[] = [
  ...LINES_20,
  ...LINES_20.map((l) => line(l.rows.map((r) => r + 1))),
];

/** 3×3 — 5 линий */
const LINES_5: Payline[] = [
  line([1, 1, 1]),
  line([0, 0, 0]),
  line([2, 2, 2]),
  line([0, 1, 2]),
  line([2, 1, 0]),
];

/* ------------------------------------------------------------------
   Хелперы символов
------------------------------------------------------------------ */

const card = (id: string, label: string, weight: number, pay: number[], art: string, glow: string): SymbolDef => ({
  id,
  label,
  weight,
  pay,
  kind: 'regular',
  art,
  glow,
});

const cardSet = (weights: [number, number, number, number, number], pays: number[][], glow: string): SymbolDef[] => {
  const ranks = [
    ['ten', '10'],
    ['jack', 'J'],
    ['queen', 'Q'],
    ['king', 'K'],
    ['ace', 'A'],
  ];
  return ranks.map(([id, label], i) => card(id, label, weights[i], pays[i], 'card', glow));
};

const THEMES = {
  pharaoh: {
    bg: '#2a1206',
    bgAlt: '#150802',
    accent: '#f6c860',
    accentSoft: 'rgba(246, 200, 96, 0.18)',
    cell: '#1d0e05',
    cellAlt: '#331809',
    frame: '#a97a2c',
    artFrom: '#4a2408',
    artTo: '#120803',
  },
  arctic: {
    bg: '#071a2b',
    bgAlt: '#03101c',
    accent: '#7fe9ff',
    accentSoft: 'rgba(127, 233, 255, 0.16)',
    cell: '#081c2e',
    cellAlt: '#0e2c45',
    frame: '#3a8ba8',
    artFrom: '#0a3248',
    artTo: '#04121f',
  },
  dragon: {
    bg: '#2a0710',
    bgAlt: '#140208',
    accent: '#ffb547',
    accentSoft: 'rgba(255, 181, 71, 0.18)',
    cell: '#210610',
    cellAlt: '#3a0b1a',
    frame: '#b83b3b',
    artFrom: '#51101c',
    artTo: '#160209',
  },
  fruits: {
    bg: '#0a1626',
    bgAlt: '#050b14',
    accent: '#ff5fd2',
    accentSoft: 'rgba(255, 95, 210, 0.16)',
    cell: '#0a1a2c',
    cellAlt: '#122a44',
    frame: '#7d4bd1',
    artFrom: '#221449',
    artTo: '#070a16',
  },
} as const;

const BETS = [0.2, 0.4, 0.6, 1, 2, 3, 4, 5, 8, 10, 15, 20, 30, 40, 50, 75, 100, 150, 200, 300, 500];

/* ------------------------------------------------------------------
   Игры
------------------------------------------------------------------ */

export const GAMES: SlotGame[] = [
  {
    id: 'golden-pharaoh',
    title: 'Golden Pharaoh',
    subtitle: 'Сокровища Древнего Египта',
    provider: 'Aurum Originals',
    layout: 'video',
    cols: 5,
    rows: 3,
    symbols: [
      ...cardSet(
        [24, 21, 18, 15, 13],
        [
          [0, 0, 0, 4, 25, 75],
          [0, 0, 0, 6, 30, 90],
          [0, 0, 0, 15, 40, 100],
          [0, 0, 0, 15, 45, 130],
          [0, 0, 0, 20, 50, 160],
        ],
        '#f6c860',
      ),
      card('eye', 'Око Хора', 10, [0, 0, 0, 25, 90, 320], 'eye', '#ffd76e'),
      card('ankh', 'Анх', 7, [0, 0, 0, 30, 130, 480], 'ankh', '#8ef0d0'),
      card('pharaoh', 'Фараон', 4, [0, 0, 0, 65, 320, 1600], 'pharaoh', '#ffb347'),
      card('wild', 'Wild', 4, [0, 0, 0, 95, 640, 3200], 'wild', '#ffe9a8'),
      card('scarab', 'Скарабей (Scatter)', 3.2, [0, 0, 0, 0, 0, 0], 'scarab', '#67e8a4'),
    ],
    paylines: LINES_20,
    wildId: 'wild',
    scatterId: 'scarab',
    scatterPay: [0, 0, 0, 15, 65, 320],
    freeSpins: { minScatters: 3, spinsByCount: [0, 0, 0, 10, 15, 20], multiplier: 2 },
    betLevels: BETS,
    rtp: 95.9,
    volatility: 'средняя',
    features: ['20 линий', 'Wild', 'Scatter', 'Фриспины ×2'],
    theme: THEMES.pharaoh,
    blurb:
      'Пять барабанов, 20 линий и щедрый множитель ×2 во фриспинах. Три скарабея открывают 10 бесплатных вращений.',
  },
  {
    id: 'arctic-gems',
    title: 'Arctic Gems',
    subtitle: 'Ледяные самоцветы',
    provider: 'Aurum Originals',
    layout: 'video',
    cols: 5,
    rows: 3,
    symbols: [
      ...cardSet(
        [23, 20, 18, 15, 12],
        [
          [0, 0, 0, 7, 20, 70],
          [0, 0, 0, 7, 30, 85],
          [0, 0, 0, 15, 35, 100],
          [0, 0, 0, 15, 45, 110],
          [0, 0, 0, 20, 50, 140],
        ],
        '#7fe9ff',
      ),
      card('diamond', 'Алмаз', 9, [0, 0, 0, 35, 110, 430], 'diamond', '#9fe8ff'),
      card('sapphire', 'Сапфир', 7, [0, 0, 0, 45, 140, 570], 'sapphire', '#7b9cff'),
      card('emerald', 'Изумруд', 5.5, [0, 0, 0, 55, 180, 720], 'emerald', '#63ffc2'),
      card('ruby', 'Рубин', 4, [0, 0, 0, 70, 290, 1050], 'ruby', '#ff6b8b'),
      card('wild', 'Wild', 4.5, [0, 0, 0, 85, 430, 2150], 'wild', '#d8f7ff'),
      card('snowflake', 'Снежинка (Scatter)', 3, [0, 0, 0, 0, 0, 0], 'snowflake', '#bff0ff'),
    ],
    paylines: LINES_25,
    wildId: 'wild',
    scatterId: 'snowflake',
    scatterPay: [0, 0, 0, 15, 70, 360],
    freeSpins: { minScatters: 3, spinsByCount: [0, 0, 0, 12, 16, 20], multiplier: 2 },
    betLevels: BETS,
    rtp: 95.9,
    volatility: 'средняя',
    features: ['25 линий', 'Wild', 'Scatter', 'Фриспины ×2'],
    theme: THEMES.arctic,
    blurb:
      'Кристально чистые барабаны с 25 линиями. Снежинки приносят до 20 фриспинов с двойным множителем.',
  },
  {
    id: 'dragons-fortune',
    title: "Dragon's Fortune",
    subtitle: 'Фортуна дракона',
    provider: 'Aurum Originals',
    layout: 'video',
    cols: 5,
    rows: 4,
    symbols: [
      ...cardSet(
        [22, 19, 16, 14, 11],
        [
          [0, 0, 0, 4, 15, 35],
          [0, 0, 0, 4, 15, 45],
          [0, 0, 0, 4, 20, 55],
          [0, 0, 0, 9, 20, 65],
          [0, 0, 0, 10, 25, 80],
        ],
        '#ffb547',
      ),
      card('coin', 'Монета', 8, [0, 0, 0, 20, 55, 180], 'coin', '#ffd166'),
      card('ingot', 'Слиток', 6, [0, 0, 0, 20, 70, 270], 'ingot', '#ffcf5c'),
      card('lantern', 'Фонарь', 4.5, [0, 0, 0, 30, 110, 400], 'lantern', '#ff8a5b'),
      card('dragon', 'Дракон', 3, [0, 0, 0, 45, 180, 890], 'dragon', '#ff5a4e'),
      card('wild', 'Wild', 4, [0, 0, 0, 65, 330, 1800], 'wild', '#ffdca8'),
      card('scatter', 'Печать (Scatter)', 3, [0, 0, 0, 0, 0, 0], 'scatter', '#ff7a45'),
    ],
    paylines: LINES_40,
    wildId: 'wild',
    scatterId: 'scatter',
    scatterPay: [0, 0, 0, 9, 35, 180],
    freeSpins: { minScatters: 3, spinsByCount: [0, 0, 0, 10, 15, 20], multiplier: 3 },
    betLevels: BETS,
    rtp: 96.0,
    volatility: 'высокая',
    features: ['40 линий', 'Wild', 'Scatter', 'Фриспины ×3'],
    theme: THEMES.dragon,
    blurb:
      'Четыре ряда и 40 линий — максимум возможностей. Фриспины с множителем ×3 способны разогнать выигрыш до небес.',
  },
  {
    id: 'neon-fruits',
    title: 'Neon Fruits',
    subtitle: 'Классика в неоне',
    provider: 'Aurum Originals',
    layout: 'classic',
    cols: 3,
    rows: 3,
    symbols: [
      card('cherry', 'Вишня', 24, [0, 0, 0, 11], 'cherry', '#ff4d6d'),
      card('lemon', 'Лимон', 22, [0, 0, 0, 15], 'lemon', '#ffe14d'),
      card('plum', 'Слива', 20, [0, 0, 0, 20], 'plum', '#c084fc'),
      card('melon', 'Арбуз', 16, [0, 0, 0, 25], 'melon', '#4ade80'),
      card('bell', 'Колокол', 12, [0, 0, 0, 36], 'bell', '#ffd166'),
      card('seven', 'Семёрка', 7, [0, 0, 0, 90], 'seven', '#ff5fd2'),
      card('wild', 'Wild', 3, [0, 0, 0, 300], 'wild', '#e0f2ff'),
    ],
    paylines: LINES_5,
    wildId: 'wild',
    betLevels: BETS,
    rtp: 96.0,
    volatility: 'низкая',
    features: ['3×3', '5 линий', 'Wild'],
    theme: THEMES.fruits,
    blurb:
      'Три барабана, пять линий и чистая ностальгия по классическим автоматам. Идеально для разогрева.',
  },
];

export const getGame = (id: string): SlotGame | undefined => GAMES.find((g) => g.id === id);

export const FEATURED_GAME = 'golden-pharaoh';
