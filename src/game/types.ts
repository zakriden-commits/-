/* ------------------------------------------------------------------
   Типы игрового движка AURUM
------------------------------------------------------------------ */

export type SymbolId = string;

export interface SymbolDef {
  /** Уникальный идентификатор символа внутри игры */
  id: SymbolId;
  /** Человеческое название (для пейтейбла) */
  label: string;
  /** Относительный вес выпадения на барабане */
  weight: number;
  /**
   * Множители выплат по линии.
   * Индекс = количество символов подряд (1..cols), значение = множитель ставки на линию.
   * 0 или отсутствие = нет выплаты.
   */
  pay: number[];
  /** wild подставляет любой обычный символ, scatter платит по всей ставке */
  kind?: 'regular' | 'wild' | 'scatter';
  /** Ключ иконки в библиотеке SymbolIcon */
  art: string;
  /** Цвет свечения вокруг символа */
  glow?: string;
}

export interface Payline {
  /** Для каждой колонки — индекс ряда сверху вниз */
  rows: number[];
}

export interface FreeSpinsConfig {
  /** Сколько scatter нужно для запуска */
  minScatters: number;
  /** Сколько фриспинов даёт 3 / 4 / 5 scatter */
  spinsByCount: number[];
  /** Множитель выигрыша во фриспинах */
  multiplier: number;
}

export type Theme = {
  /** Фон кабинета */
  bg: string;
  bgAlt: string;
  /** Акцентный (золотой/неоновый) цвет */
  accent: string;
  accentSoft: string;
  /** Фон ячейки барабана */
  cell: string;
  cellAlt: string;
  /** Цвет рамки */
  frame: string;
  /** Декор арта карточки в лобби */
  artFrom: string;
  artTo: string;
};

export interface SlotGame {
  id: string;
  title: string;
  subtitle: string;
  provider: string;
  /** 3x3 classic или 5x3 video */
  layout: 'classic' | 'video';
  cols: number;
  rows: number;
  symbols: SymbolDef[];
  paylines: Payline[];
  wildId?: SymbolId;
  scatterId?: SymbolId;
  /** Множители scatter от общей ставки, индекс = количество */
  scatterPay?: number[];
  freeSpins?: FreeSpinsConfig;
  betLevels: number[];
  /** Заявленный (и посчитанный симуляцией) RTP */
  rtp: number;
  volatility: 'низкая' | 'средняя' | 'высокая' | 'очень высокая';
  features: string[];
  theme: Theme;
  blurb: string;
}

export interface Position {
  col: number;
  row: number;
}

export interface LineWin {
  line: number;
  symbolId: SymbolId;
  count: number;
  amount: number;
  positions: Position[];
}

export interface SpinResult {
  grid: SymbolId[][];
  lineWins: LineWin[];
  scatterCount: number;
  scatterWin: number;
  multiplier: number;
  totalWin: number;
  freeSpinsWon: number;
  /** true, если спин был частью фриспинов */
  isFreeSpin: boolean;
}
