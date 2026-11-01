import { useEffect, useState } from 'react';
import { GAMES, getGame } from './game/games';
import { useWallet } from './game/wallet';
import { Lobby } from './components/Lobby';
import { SlotScreen } from './components/SlotScreen';

function parseHash(): string | null {
  const hash = window.location.hash.replace(/^#\/?/, '');
  const [section, id] = hash.split('/');
  if (section === 'game' && id && getGame(id)) return id;
  return null;
}

export default function App() {
  const wallet = useWallet();
  const [gameId, setGameId] = useState<string | null>(parseHash);

  useEffect(() => {
    const onHashChange = () => setGameId(parseHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [gameId]);

  const openGame = (id: string) => {
    window.location.hash = `#/game/${id}`;
    setGameId(id);
  };

  const closeGame = () => {
    window.location.hash = '#/';
    setGameId(null);
  };

  const game = gameId ? getGame(gameId) : undefined;

  if (!game) {
    return <Lobby wallet={wallet} onPlay={openGame} />;
  }

  return (
    <SlotScreen
      key={game.id}
      game={game}
      wallet={wallet}
      onBack={closeGame}
      onPlayGame={openGame}
      allGames={GAMES}
    />
  );
}
