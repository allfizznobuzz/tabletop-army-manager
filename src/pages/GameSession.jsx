import React from "react";
import GameSessionView from "components/game/GameSessionView";
import { subscribeToGame } from "../firebase/database";
import useGameSubscription from "hooks/useGameSubscription";

export default function GameSessionPage({ gameId, user }) {
  const gameData = useGameSubscription(gameId, subscribeToGame);
  return <GameSessionView gameId={gameId} user={user} gameData={gameData} />;
}
