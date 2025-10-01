import React, { useState, useEffect, useCallback } from "react";
import {
  getUserGames,
  createGame,
  joinGame,
  deleteGame,
} from "../firebase/database";
import ConfirmDialog from "components/ConfirmDialog";
import "components/GameDashboard.css";

export default function GameDashboardPage({ user, onJoinGame }) {
  const [recentGames, setRecentGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateGame, setShowCreateGame] = useState(false);
  const [gameId, setGameId] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [gameName, setGameName] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState({
    isOpen: false,
    gameId: null,
    gameName: "",
  });

  const loadUserGames = useCallback(async () => {
    try {
      const userGames = await getUserGames(user.uid);
      const toMillis = (v) =>
        v && typeof v.toMillis === "function"
          ? v.toMillis()
          : v && typeof v.seconds === "number"
            ? v.seconds * 1000
            : Number(new Date(v)) || 0;
      const sortedGames = userGames.sort(
        (a, b) => toMillis(b.createdAt) - toMillis(a.createdAt),
      );
      setRecentGames(sortedGames);
    } catch (error) {
      console.error("Failed to load games:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    loadUserGames();
  }, [user?.uid, loadUserGames]);

  const handleCreateGame = async () => {
    try {
      const id = await createGame({
        name: (gameName || "").trim() || "Untitled Game",
        createdBy: user.uid,
        players: [user.uid],
        playerA: {
          displayName: user.displayName || user.email || "Player A",
          armyRef: null,
          armyData: null,
        },
        playerB: { displayName: "", armyRef: null, armyData: null },
        gameState: {
          columns: {
            A: { attachments: {}, unitOrder: [] },
            B: { attachments: {}, unitOrder: [] },
          },
          leadershipOverrides: {},
          damageHistory: {},
          totalVP: {},
          victoryPoints: {},
        },
      });

      setGameName("");
      setShowCreateGame(false);
      setUploadError("");
      loadUserGames();
      onJoinGame(id);
    } catch (error) {
      console.error("Failed to create game:", error);
      setUploadError(
        `Failed to create game: ${error?.message || String(error)}`,
      );
    }
  };

  const handleJoinGame = async () => {
    if (!gameId.trim()) {
      setUploadError("Please enter a game ID");
      return;
    }
    try {
      await joinGame(gameId.trim(), user.uid, user.displayName || user.email);
      onJoinGame(gameId.trim());
      setGameId("");
      setUploadError("");
    } catch (error) {
      console.error("Failed to join game:", error);
      setUploadError("Failed to join game. Please check the game ID.");
    }
  };

  const handleViewGame = (gameId) => {
    onJoinGame(gameId);
  };

  const handleDeleteGame = (gameId, gameName) => {
    setDeleteConfirm({ isOpen: true, gameId, gameName });
  };

  const confirmDeleteGame = async () => {
    try {
      await deleteGame(deleteConfirm.gameId);
      setDeleteConfirm({ isOpen: false, gameId: null, gameName: "" });
      loadUserGames();
    } catch (error) {
      console.error("Failed to delete game:", error);
      setUploadError("Failed to delete game. Please try again.");
    }
  };

  const cancelDeleteGame = () => {
    setDeleteConfirm({ isOpen: false, gameId: null, gameName: "" });
  };

  const formatDate = (value) => {
    const d =
      value && typeof value.toDate === "function"
        ? value.toDate()
        : new Date(value);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getGameStatus = (game) => {
    if (game.status === "completed") return "✅ Completed";
    if (game.status === "active") return "🎮 Active";
    return "⏸️ Paused";
  };

  if (loading) {
    return <div className="loading">Loading games...</div>;
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1 className="dashboard-title">Game Dashboard</h1>
        <button
          onClick={() => setShowCreateGame(!showCreateGame)}
          className="new-game-btn"
        >
          {showCreateGame ? "Cancel" : "New Game"}
        </button>
      </div>

      {showCreateGame && (
        <div className="create-game-form">
          <h2 className="form-title">Create New Game</h2>

          <div className="form-group">
            <label className="form-label">Game Name</label>
            <input
              type="text"
              value={gameName}
              onChange={(e) => setGameName(e.target.value)}
              placeholder="Enter game name"
              className="form-input"
            />
          </div>

          {uploadError && <div className="error-message">{uploadError}</div>}

          <div className="form-actions">
            <button
              onClick={() => setShowCreateGame(false)}
              className="cancel-btn"
            >
              Cancel
            </button>
            <button onClick={handleCreateGame} className="create-btn">
              Create Game
            </button>
          </div>
        </div>
      )}

      <div className="recent-games-section">
        <h2 className="section-title">Recent Games</h2>

        {recentGames.length === 0 ? (
          <div className="no-games">
            <p>No games found. Create your first game to get started!</p>
          </div>
        ) : (
          <div className="games-grid">
            {recentGames.map((game) => (
              <div key={game.id} className="game-card">
                <div className="game-card-header">
                  <h3 className="game-name">{game.name}</h3>
                  <span className="game-status">{getGameStatus(game)}</span>
                </div>

                <div className="game-info">
                  Created: {formatDate(game.createdAt)}
                </div>
                <div className="game-info">
                  Armies:{" "}
                  {(game.playerA?.armyData ? 1 : 0) +
                    (game.playerB?.armyData ? 1 : 0)}
                </div>
                <div className="game-info">Round: {game.round || 1}</div>

                <div className="game-armies">
                  {game.playerA && (
                    <div className="army-info">
                      • A: {game.playerA.displayName || "Player A"}{" "}
                      {game.playerA.armyData?.name
                        ? `— ${game.playerA.armyData.name}`
                        : "(no army)"}
                    </div>
                  )}
                  {game.playerB && (
                    <div className="army-info">
                      • B: {game.playerB.displayName || "Player B"}{" "}
                      {game.playerB.armyData?.name
                        ? `— ${game.playerB.armyData.name}`
                        : "(no army)"}
                    </div>
                  )}
                </div>

                <div className="game-actions">
                  <button
                    onClick={() => handleViewGame(game.id)}
                    className="action-btn view-btn"
                  >
                    View Game
                  </button>
                  {game.createdBy === user.uid && (
                    <button
                      onClick={() => handleDeleteGame(game.id, game.name)}
                      className="action-btn delete-btn"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="join-game-form">
        <h3 className="join-game-title">Join Existing Game</h3>
        <input
          type="text"
          value={gameId}
          onChange={(e) => setGameId(e.target.value)}
          placeholder="Enter Game ID"
          className="game-id-input"
        />
        <button onClick={handleJoinGame} className="join-btn">
          Join Game
        </button>
      </div>

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Delete Game"
        message={`Are you sure you want to delete "${deleteConfirm.gameName}"? This action cannot be undone.`}
        onConfirm={confirmDeleteGame}
        onCancel={cancelDeleteGame}
        isDestructive={true}
      />
    </div>
  );
}
