import { useEffect, useState } from "react";

// Subscribe to game document and return gameData
// subscribeToGameFn should be a function (gameId, cb) => unsubscribe
export default function useGameSubscription(gameId, subscribeToGameFn) {
  const [gameData, setGameData] = useState(null);

  useEffect(() => {
    if (!gameId || typeof subscribeToGameFn !== "function") return;
    const unsubscribe = subscribeToGameFn(gameId, (doc) => setGameData(doc));
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [gameId, subscribeToGameFn]);

  return gameData;
}
