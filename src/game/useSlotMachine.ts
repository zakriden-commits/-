import { useCallback, useEffect, useRef, useState } from 'react';
import { buildReel, evaluateGrid, generateGrid } from './engine';
import { sound } from './sound';
import type { SlotGame, SpinResult } from './types';
import type { Wallet } from './wallet';

export interface FreeSpinsState {
  remaining: number;
  total: number;
  won: number;
  multiplier: number;
}

const EMPTY_FS: FreeSpinsState = { remaining: 0, total: 0, won: 0, multiplier: 0 };

interface PendingSpin {
  result: SpinResult;
  bet: number;
  isFree: boolean;
}

export interface FsIntro {
  spins: number;
  multiplier: number;
}

export interface BigWin {
  amount: number;
  multiplier: number;
}

export function useSlotMachine(game: SlotGame, wallet: Wallet) {
  const [grid, setGrid] = useState(() => generateGrid(game, buildReel(game)));
  const [betIndex, setBetIndex] = useState(() => {
    const raw = localStorage.getItem(`aurum-bet-${game.id}`);
    const saved = raw === null ? Number.NaN : Number(raw);
    if (Number.isFinite(saved) && game.betLevels[saved] !== undefined) return saved;
    return Math.min(3, game.betLevels.length - 1);
  });
  const [spinning, setSpinning] = useState(false);
  const [spinId, setSpinId] = useState(0);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [freeSpins, setFreeSpins] = useState<FreeSpinsState>(EMPTY_FS);
  const [fsIntro, setFsIntro] = useState<FsIntro | null>(null);
  const [fsSummary, setFsSummary] = useState<{ won: number } | null>(null);
  const [autoplay, setAutoplay] = useState(0);
  const [turbo, setTurbo] = useState(false);
  const [bigWin, setBigWin] = useState<BigWin | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const fsRef = useRef<FreeSpinsState>(EMPTY_FS);
  const pendingRef = useRef<PendingSpin | null>(null);
  const fsBetRef = useRef(game.betLevels[betIndex] ?? 1);
  const spinLock = useRef(false);

  const bet = game.betLevels[betIndex] ?? game.betLevels[0];
  const lineCount = game.paylines.length;
  const inFreeSpins = freeSpins.total > 0 || freeSpins.remaining > 0;

  const updateFs = useCallback((next: FreeSpinsState) => {
    fsRef.current = next;
    setFreeSpins(next);
  }, []);

  useEffect(() => {
    localStorage.setItem(`aurum-bet-${game.id}`, String(betIndex));
  }, [betIndex, game.id]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 3200);
    return () => clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    if (!bigWin) return;
    const timer = setTimeout(() => setBigWin(null), 4200);
    return () => clearTimeout(timer);
  }, [bigWin]);

  const launchSpin = useCallback(
    (isFree: boolean) => {
      if (spinLock.current || fsIntro || fsSummary || bigWin) return false;
      const stake = isFree ? fsBetRef.current : bet;

      if (!isFree) {
        if (fsRef.current.remaining > 0) return false;
        if (wallet.state.balance < stake) {
          sound.error();
          setMessage('Недостаточно демо-кредитов — пополните баланс');
          setAutoplay(0);
          return false;
        }
        if (!wallet.spend(stake)) return false;
      } else if (fsRef.current.remaining <= 0) {
        return false;
      }

      spinLock.current = true;
      const spin = evaluateGrid(game, generateGrid(game, buildReel(game)), stake, { freeSpin: isFree });
      pendingRef.current = { result: spin, bet: stake, isFree };

      if (isFree) {
        updateFs({ ...fsRef.current, remaining: fsRef.current.remaining - 1 });
      }

      setResult(null);
      setBigWin(null);
      setGrid(spin.grid);
      setSpinId((id) => id + 1);
      setSpinning(true);
      sound.spin();
      return true;
    },
    [bet, fsIntro, fsSummary, bigWin, game, updateFs, wallet],
  );

  const revealComplete = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    spinLock.current = false;

    const { result: spin, bet: stake, isFree } = pending;
    setSpinning(false);
    setResult(spin);

    if (spin.totalWin > 0) wallet.credit(spin.totalWin);
    wallet.registerSpin(game.id, stake, spin.totalWin);

    const fs = fsRef.current;
    if (isFree) {
      const won = fs.won + spin.totalWin;
      const remaining = fs.remaining + spin.freeSpinsWon;
      updateFs({ ...fs, won, remaining, total: fs.total + spin.freeSpinsWon });
      if (remaining === 0) setFsSummary({ won });
    } else if (spin.freeSpinsWon > 0 && game.freeSpins) {
      setFsIntro({ spins: spin.freeSpinsWon, multiplier: game.freeSpins.multiplier });
    }

    if (spin.scatterCount >= 3 && game.scatterId) sound.scatter();
    else if (spin.totalWin > 0) sound.win(spin.totalWin < stake * 2);

    if (stake > 0 && spin.totalWin >= stake * 20) {
      setBigWin({ amount: spin.totalWin, multiplier: spin.totalWin / stake });
      if (spin.totalWin >= stake * 50) sound.bigWin();
    }
  }, [game, updateFs, wallet]);

  /** Автоматические фриспины */
  useEffect(() => {
    if (spinning || fsIntro || fsSummary || bigWin) return;
    if (fsRef.current.remaining <= 0) return;
    const delay = turbo ? 260 : 600;
    const timer = setTimeout(() => launchSpin(true), delay);
    return () => clearTimeout(timer);
  }, [spinning, freeSpins.remaining, fsIntro, fsSummary, turbo, launchSpin, bigWin]);

  /** Автоигра */
  useEffect(() => {
    if (spinning || fsIntro || fsSummary || bigWin) return;
    if (autoplay <= 0) return;
    if (fsRef.current.remaining > 0) return;
    if (wallet.state.balance < bet) {
      setAutoplay(0);
      setMessage('Недостаточно демо-кредитов — автоигра остановлена');
      return;
    }
    const delay = turbo ? 240 : 600;
    const timer = setTimeout(() => {
      if (launchSpin(false)) setAutoplay((n) => Math.max(0, n - 1));
    }, delay);
    return () => clearTimeout(timer);
  }, [spinning, autoplay, bet, fsIntro, fsSummary, freeSpins.remaining, launchSpin, turbo, wallet.state.balance, bigWin]);

  const spin = useCallback(() => {
    if (inFreeSpins) return false;
    if (autoplay > 0) setAutoplay(0);
    return launchSpin(false);
  }, [autoplay, inFreeSpins, launchSpin]);

  const changeBet = useCallback(
    (direction: 1 | -1) => {
      if (spinning || inFreeSpins) return;
      setBetIndex((index) => {
        const next = Math.min(game.betLevels.length - 1, Math.max(0, index + direction));
        return next;
      });
      sound.bet();
    },
    [game.betLevels.length, inFreeSpins, spinning],
  );

  const setBetLevel = useCallback(
    (index: number) => {
      if (spinning || inFreeSpins) return;
      setBetIndex(Math.min(game.betLevels.length - 1, Math.max(0, index)));
      sound.bet();
    },
    [game.betLevels.length, inFreeSpins, spinning],
  );

  const startFreeSpins = useCallback(() => {
    if (!fsIntro) return;
    fsBetRef.current = bet;
    updateFs({ remaining: fsIntro.spins, total: fsIntro.spins, won: 0, multiplier: fsIntro.multiplier });
    setFsIntro(null);
    sound.freeSpin();
  }, [bet, fsIntro, updateFs]);

  const closeFsSummary = useCallback(() => {
    setFsSummary(null);
    updateFs(EMPTY_FS);
  }, [updateFs]);

  const toggleAutoplay = useCallback(() => {
    if (inFreeSpins) return;
    setAutoplay((n) => (n > 0 ? 0 : 25));
    sound.click();
  }, [inFreeSpins]);

  const dismissBigWin = useCallback(() => setBigWin(null), []);

  return {
    game,
    grid,
    bet,
    betIndex,
    lineCount,
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
    spin,
    changeBet,
    setBetLevel,
    setTurbo,
    toggleAutoplay,
    setAutoplay,
    startFreeSpins,
    closeFsSummary,
    dismissBigWin,
    revealComplete,
    setMessage,
  };
}

export type SlotMachine = ReturnType<typeof useSlotMachine>;
