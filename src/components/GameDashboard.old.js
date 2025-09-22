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
      
      // Parse the army file (handles both BattleScribe and simple formats)
      const parsedArmy = parseArmyFile(jsonData);
      
      // Debug: Log parsed army to check weapons
      console.log('Parsed army data:', JSON.stringify(parsedArmy, null, 2));
      
      // Create game with army snapshot
      const gameData = {
        name: gameName,
        players: [user.uid],
        playerArmies: {
          [user.uid]: {
            armyData: parsedArmy, // Snapshot the army data in the game
            playerId: user.uid,
            playerName: user.displayName
          }
        },
        gameState: {
          units: {},
          damageHistory: {},
          victoryPoints: {},
          totalVP: { [user.uid]: 0 },
          currentTurn: 0,
          round: 1
        },
        status: 'active',
        createdAt: new Date().toISOString()
      };

      const newGameId = await createGame(gameData);
      
      // Reset form
      setGameName('');
      setArmyFile(null);
      setShowCreateGame(false);
      document.getElementById('army-file-input').value = '';
      
      // Join the new game
      onJoinGame(newGameId);
    } catch (error) {
      console.error('Failed to create game:', error);
      setUploadError(error.message || 'Failed to create game. Please check the army file format.');
    }
  };

  const handleJoinGame = async () => {
    if (!gameId.trim()) return;
    
    try {
      // For joining existing games, we'll need army data too
      // For now, just join without army validation
      await joinGame(gameId, user.uid, null);
      onJoinGame(gameId);
    } catch (error) {
      console.error('Failed to join game:', error);
      setUploadError('Failed to join game. Please check the Game ID.');
    }
  };

  const handleDeleteGame = (game) => {
    setDeleteConfirm({
      isOpen: true,
      gameId: game.id,
      gameName: game.name
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
    return <div>Loading games...</div>;
  }

  return (
    <div className="game-dashboard">
      <div className="dashboard-header">
        <h2>Game Dashboard</h2>
        <div className="dashboard-actions">
          <button 
            onClick={() => setShowCreateGame(!showCreateGame)} 
            className="create-game-btn"
          >
            {showCreateGame ? 'Cancel' : 'New Game'}
          </button>
        </div>
      </div>

      {uploadError && (
        <div className="error-message">
          <p>{uploadError}</p>
        </div>
      )}

      {showCreateGame && (
        <div className="create-game-form">
          <h3>Create New Game</h3>
          <div className="form-group">
            <label htmlFor="game-name">Game Name</label>
            <input
              type="text"
              id="game-name"
              value={gameName}
              onChange={(e) => setGameName(e.target.value)}
              placeholder="Enter game name (e.g., 'Tournament Round 1')"
              className="game-name-input"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="army-file-input">Upload Your Army</label>
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="file-input"
              id="army-file-input"
            />
            <label htmlFor="army-file-input" className="upload-army-btn">
              {armyFile ? `Selected: ${armyFile.name}` : 'Choose Army JSON File'}
            </label>
          </div>

          <div className="form-actions">
            <button onClick={handleCreateGame} className="submit-btn">
              Create Game
            </button>
          </div>
        </div>
      )}

      <div className="recent-games-section">
        <h3>Recent Games</h3>
        {recentGames.length === 0 ? (
          <div className="no-games">
            <p>No games yet. Create your first game to get started!</p>
            <p>Upload an army file and start tracking your tabletop battles.</p>
          </div>
        ) : (
          <div className="games-grid">
            {recentGames.map((game) => (
              <div key={game.id} className="game-card">
                <div className="game-header">
                  <h4>{game.name}</h4>
                  <span className="game-status">{getGameStatus(game)}</span>
                </div>
                
                <div className="game-info">
                  <p><strong>Created:</strong> {formatDate(game.createdAt)}</p>
                  <p><strong>Players:</strong> {game.players?.length || 0}</p>
                  <p><strong>Round:</strong> {game.gameState?.round || 1}</p>
                </div>

                <div className="game-armies">
                  <strong>Armies:</strong>
                  {Object.entries(game.playerArmies || {}).map(([playerId, armyInfo]) => (
                    <div key={playerId} className="army-info">
                      <span>{armyInfo.armyData?.name || 'Unknown Army'}</span>
                      <span className="faction">({armyInfo.armyData?.faction || 'Unknown'})</span>
                    </div>
                  ))}
                </div>

                <div className="game-actions">
                  <button 
                    onClick={() => onJoinGame(game.id)}
                    className="join-game-btn"
                  >
                    {game.status === 'active' ? 'Continue Game' : 'View Game'}
                  </button>
                  <button 
                    onClick={() => handleDeleteGame(game)}
                    className="delete-game-btn"
                    title="Delete Game"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="join-existing-section">
        <h3>Join Existing Game</h3>
        <div className="join-game-form">
          <input
            type="text"
            placeholder="Enter Game ID"
            value={gameId}
            onChange={(e) => setGameId(e.target.value)}
            className="game-id-input"
          />
          <button onClick={handleJoinGame} className="join-existing-btn">
            Join Game
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Delete Game"
        message={`Are you sure you want to delete "${deleteConfirm.gameName}"? This action cannot be undone and will permanently remove all game data, including damage history and victory points.`}
        onConfirm={confirmDeleteGame}
        onCancel={cancelDeleteGame}
        confirmText="Delete Game"
        cancelText="Cancel"
        isDestructive={true}
      />

      <style jsx>{`
        .game-dashboard {
          max-width: 1200px;
          margin: 0 auto;
        }

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }

        .dashboard-header h2 {
          margin: 0;
          color: #2c3e50;
        }

        .create-game-btn {
          background: #27ae60;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 5px;
          cursor: pointer;
          font-size: 16px;
          font-weight: bold;
        }

        .create-game-btn:hover {
          background: #219a52;
        }

        .create-game-form {
          background: white;
          padding: 2rem;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          margin-bottom: 2rem;
          border: 2px solid #27ae60;
        }

        .create-game-form h3 {
          margin: 0 0 1.5rem 0;
          color: #2c3e50;
        }

        .form-group {
          margin-bottom: 1.5rem;
        }

        .form-group label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: bold;
          color: #34495e;
        }

        .game-name-input {
          width: 100%;
          padding: 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 16px;
        }

        .file-input {
          display: none;
        }

        .upload-army-btn {
          background: #3498db;
          color: white;
          border: none;
          padding: 12px 20px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          text-decoration: none;
          display: inline-block;
          min-width: 200px;
          text-align: center;
        }

        .upload-army-btn:hover {
          background: #2980b9;
        }

        .form-actions {
          display: flex;
          gap: 1rem;
          justify-content: flex-end;
        }

        .submit-btn {
          background: #27ae60;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 16px;
          font-weight: bold;
        }

        .submit-btn:hover {
          background: #219a52;
        }

        .error-message {
          background: #f8d7da;
          color: #721c24;
          padding: 1rem;
          border-radius: 5px;
          margin-bottom: 2rem;
          border: 1px solid #f5c6cb;
        }

        .error-message p {
          margin: 0;
        }

        .recent-games-section {
          margin-bottom: 3rem;
        }

        .recent-games-section h3 {
          margin: 0 0 1.5rem 0;
          color: #2c3e50;
        }

        .no-games {
          text-align: center;
          padding: 3rem;
          background: white;
          border-radius: 8px;
          color: #666;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .games-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 1.5rem;
        }

        .game-card {
          background: white;
          padding: 1.5rem;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          border: 1px solid #ddd;
        }

        .game-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .game-header h4 {
          margin: 0;
          color: #2c3e50;
        }

        .game-status {
          font-size: 12px;
          padding: 4px 8px;
          border-radius: 12px;
          background: #ecf0f1;
          color: #2c3e50;
        }

        .game-info {
          margin-bottom: 1rem;
        }

        .game-info p {
          margin: 0.25rem 0;
          color: #666;
          font-size: 14px;
        }

        .game-armies {
          margin-bottom: 1rem;
          font-size: 14px;
          color: #666;
        }

        .army-info {
          margin: 0.25rem 0;
          padding-left: 1rem;
        }

        .faction {
          color: #95a5a6;
          font-style: italic;
        }

        .game-actions {
          display: flex;
          gap: 0.5rem;
        }

        .join-game-btn {
          background: #3498db;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          flex: 1;
        }

        .join-game-btn:hover {
          background: #2980b9;
        }

        .delete-game-btn {
          background: #e74c3c;
          color: white;
          border: none;
          padding: 8px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 40px;
        }

        .delete-game-btn:hover {
          background: #c0392b;
        }

        .join-existing-section {
          background: white;
          padding: 2rem;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .join-existing-section h3 {
          margin: 0 0 1rem 0;
          color: #2c3e50;
        }

        .join-game-form {
          display: flex;
          gap: 1rem;
          align-items: center;
        }

        .game-id-input {
          flex: 1;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 16px;
        }

        .join-existing-btn {
          background: #e67e22;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 16px;
        }

        .join-existing-btn:hover {
          background: #d35400;
        }

        @media (max-width: 768px) {
          .dashboard-header {
            flex-direction: column;
            gap: 1rem;
            text-align: center;
          }

          .games-grid {
            grid-template-columns: 1fr;
          }

          .join-game-form {
            flex-direction: column;
          }

          .game-id-input {
            width: 100%;
          }

          .form-actions {
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
};

export default GameDashboard;
