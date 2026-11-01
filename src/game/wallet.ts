import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sound } from './sound';

export const START_BALANCE = 10000;
const STORAGE_KEY = 'aurum-demo-wallet-v1';

export interface GameStat {
  spins: number;
  won: number;
  best: number;
}

export interface WalletState {
  balance: number;
  spins: number;
  wagered: number;
  won: number;
  biggestWin: number;
  biggestWinX: number;
  soundOn: boolean;
  stats: Record<string, GameStat>;
  recent: string[];
}

const initialState = (): WalletState => ({
  balance: START_BALANCE,
  spins: 0,
  wagered: 0,
  won: 0,
  biggestWin: 0,
  biggestWinX: 0,
  soundOn: true,
  stats: {},
  recent: [],
});

function load(): WalletState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState();
    const parsed = JSON.parse(raw) as Partial<WalletState>;
    return { ...initialState(), ...parsed, stats: parsed.stats ?? {}, recent: parsed.recent ?? [] };
  } catch {
    return initialState();
  }
}

export function formatMoney(value: number, withCurrency = true): string {
  const formatted = new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  return withCurrency ? `${formatted} €` : formatted;
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value);
}

export function useWallet() {
  const [state, setState] = useState<WalletState>(load);
  const balanceRef = useRef(state.balance);

  useEffect(() => {
    balanceRef.current = state.balance;
  }, [state.balance]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* приватный режим — просто не сохраняем */
    }
  }, [state]);

  useEffect(() => {
    sound.muted = !state.soundOn;
  }, [state.soundOn]);

  const spend = useCallback((amount: number) => {
    // списываем синхронно по ref, чтобы решение о спине было атомарным
    if (balanceRef.current + 1e-9 < amount) return false;
    balanceRef.current = Math.round((balanceRef.current - amount) * 100) / 100;
    setState((s) => ({
      ...s,
      balance: Math.round((s.balance - amount) * 100) / 100,
      wagered: s.wagered + amount,
    }));
    return true;
  }, []);

  const credit = useCallback((amount: number) => {
    if (amount <= 0) return;
    balanceRef.current = Math.round((balanceRef.current + amount) * 100) / 100;
    setState((s) => ({ ...s, balance: Math.round((s.balance + amount) * 100) / 100, won: s.won + amount }));
  }, []);

  const registerSpin = useCallback((gameId: string, bet: number, win: number) => {
    setState((s) => {
      const stat = s.stats[gameId] ?? { spins: 0, won: 0, best: 0 };
      const multiplier = bet > 0 ? win / bet : 0;
      return {
        ...s,
        spins: s.spins + 1,
        stats: {
          ...s.stats,
          [gameId]: { spins: stat.spins + 1, won: stat.won + win, best: Math.max(stat.best, win) },
        },
        biggestWin: Math.max(s.biggestWin, win),
        biggestWinX: Math.max(s.biggestWinX, multiplier),
        recent: [gameId, ...s.recent.filter((id) => id !== gameId)].slice(0, 4),
      };
    });
  }, []);

  const topUp = useCallback(() => {
    balanceRef.current += 5000;
    setState((s) => ({ ...s, balance: s.balance + 5000 }));
  }, []);

  const reset = useCallback(() => {
    balanceRef.current = START_BALANCE;
    setState((s) => ({ ...initialState(), soundOn: s.soundOn }));
  }, []);

  const toggleSound = useCallback(() => {
    setState((s) => ({ ...s, soundOn: !s.soundOn }));
  }, []);

  const api = useMemo(
    () => ({ spend, credit, registerSpin, topUp, reset, toggleSound }),
    [spend, credit, registerSpin, topUp, reset, toggleSound],
  );

  return { state, ...api };
}

export type Wallet = ReturnType<typeof useWallet>;
