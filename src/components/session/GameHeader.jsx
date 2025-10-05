import React from "react";

export default function GameHeader({
  name,
  round,
  isMyTurn,
  gameId,
  isNarrow,
  hasSelectedUnit,
  onOpenOverlay,
  compact = false,
}) {
  if (compact) {
    if (!(isNarrow && hasSelectedUnit)) return null;
    return (
      <div className="game-header compact">
        <button
          type="button"
          className="action-btn"
          aria-label="Open Datasheet overlay"
          onClick={onOpenOverlay}
        >
          Open Datasheet
        </button>
      </div>
    );
  }
  return (
    <div className="game-header">
      <h2>{name || "Game"}</h2>
      <div className="game-info">
        <span>Round: {round || 1}</span>
        <span>Current Turn: {isMyTurn ? "Your Turn" : "Waiting..."}</span>
        <span>Game ID: {gameId}</span>
      </div>
      <div className="header-actions" style={{ display: "flex", gap: 8 }}>
        {isNarrow && hasSelectedUnit ? (
          <button
            type="button"
            className="action-btn"
            aria-label="Open Datasheet overlay"
            onClick={onOpenOverlay}
          >
            Open Datasheet
          </button>
        ) : null}
      </div>
    </div>
  );
}
