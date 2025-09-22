import React, { useState, useEffect } from 'react';
import { getUserGames, createGame, joinGame, deleteGame } from '../firebase/database';
import { parseArmyFile } from '../utils/armyParser';
import ConfirmDialog from './ConfirmDialog';
import './GameDashboard.css';

const GameDashboard = ({ user, onJoinGame }) => {
  const [recentGames, setRecentGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateGame, setShowCreateGame] = useState(false);
  const [gameId, setGameId] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [armyFile, setArmyFile] = useState(null);
  const [gameName, setGameName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, gameId: null, gameName: '' });

  useEffect(() => {
    loadUserGames();
  }, [user]);

  const loadUserGames = async () => {
    try {
      const userGames = await getUserGames(user.uid);
      // Sort by most recent first
      const sortedGames = userGames.sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
      );
      setRecentGames(sortedGames);
    } catch (error) {
      console.error('Failed to load games:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploadError('');
    setArmyFile(file);
  };

  const handleCreateGame = async () => {
    if (!armyFile || !gameName.trim()) {
      setUploadError('Please provide a game name and upload an army file');
      return;
    }

    try {
      const text = await armyFile.text();
      const jsonData = JSON.parse(text);
      const armyData = parseArmyFile(jsonData);

      const gameData = await createGame({
        name: gameName.trim(),
        createdBy: user.uid,
        playerArmies: {
          [user.uid]: {
            playerName: user.displayName || user.email,
            armyData: armyData
          }
        }
      });

      // Reset form
      setGameName('');
      setArmyFile(null);
      setShowCreateGame(false);
      setUploadError('');
      
      // Refresh games list
      loadUserGames();
      
      // Join the newly created game
      onJoinGame(gameData.id);
    } catch (error) {
      console.error('Failed to create game:', error);
      setUploadError('Failed to create game. Please check your army file format.');
    }
  };

  const handleJoinGame = async () => {
    if (!gameId.trim()) {
      setUploadError('Please enter a game ID');
      return;
    }

    try {
      await joinGame(gameId.trim(), user.uid, user.displayName || user.email);
      onJoinGame(gameId.trim());
      setGameId('');
      setUploadError('');
    } catch (error) {
      console.error('Failed to join game:', error);
      setUploadError('Failed to join game. Please check the game ID.');
    }
  };

  const handleViewGame = (gameId) => {
    onJoinGame(gameId);
  };

  const handleDeleteGame = (gameId, gameName) => {
    setDeleteConfirm({
      isOpen: true,
      gameId: gameId,
      gameName: gameName
    });
  };

  const confirmDeleteGame = async () => {
    try {
      await deleteGame(deleteConfirm.gameId);
      setDeleteConfirm({ isOpen: false, gameId: null, gameName: '' });
      loadUserGames(); // Refresh the list
    } catch (error) {
      console.error('Failed to delete game:', error);
      setUploadError('Failed to delete game. Please try again.');
    }
  };

  const cancelDeleteGame = () => {
    setDeleteConfirm({ isOpen: false, gameId: null, gameName: '' });
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getGameStatus = (game) => {
    if (game.status === 'completed') return '✅ Completed';
    if (game.status === 'active') return '🎮 Active';
    return '⏸️ Paused';
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
          {showCreateGame ? 'Cancel' : 'New Game'}
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

          <div className="form-group">
            <label className="form-label">Army File</label>
            <div className="file-input" onClick={() => document.getElementById('army-file').click()}>
              <input
                id="army-file"
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
              {armyFile ? `Selected: ${armyFile.name}` : 'Click to upload army file (.json)'}
            </div>
          </div>

          {uploadError && (
            <div className="error-message">{uploadError}</div>
          )}

          <div className="form-actions">
            <button onClick={() => setShowCreateGame(false)} className="cancel-btn">
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
                  Players: {Object.keys(game.playerArmies || {}).length}
                </div>
                <div className="game-info">
                  Round: {game.round || 1}
                </div>

                <div className="game-armies">
                  {Object.entries(game.playerArmies || {}).map(([playerId, playerArmy]) => (
                    <div key={playerId} className="army-info">
                      • {playerArmy.playerName}: {playerArmy.armyData?.name || 'Unknown Army'}
                      {playerArmy.armyData?.faction && (
                        <span className="faction"> ({playerArmy.armyData.faction})</span>
                      )}
                    </div>
                  ))}
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
};

export default GameDashboard;
