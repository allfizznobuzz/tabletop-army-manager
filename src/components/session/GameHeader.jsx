import React from "react";

export default function GameHeader({
  name,
  round,
  isMyTurn,
  gameId,
  isNarrow,
  hasSelectedUnit,
  onOpenOverlay,
}) {
  return (
    <div className="game-header">
      <h2>{name || "Game"}</h2>
      <div className="game-info">
        <span>Round: {round || 1}</span>
        <span>Current Turn: {isMyTurn ? "Your Turn" : "Waiting..."}</span>
        <span>Game ID: {gameId}</span>
      </div>
      {isNarrow && hasSelectedUnit ? (
        <div style={{ marginTop: "0.5rem" }}>
          <button
            type="button"
            className="action-btn"
            aria-label="Open Datasheet overlay"
            onClick={onOpenOverlay}
          >
            Open Datasheet
          </button>
        </div>
      ) : null}
    </div>
  );
}
