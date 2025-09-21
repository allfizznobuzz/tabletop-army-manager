import React, { useState, useEffect } from 'react';
import { subscribeToGame, subscribeToGameUpdates, assignDamage, assignVictoryPoints, nextTurn } from '../firebase/database';

const GameSession = ({ gameId, user }) => {
  const [gameData, setGameData] = useState(null);
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [damageAmount, setDamageAmount] = useState(1);
  const [vpAmount, setVpAmount] = useState(1);
  const [vpReason, setVpReason] = useState('');

  useEffect(() => {
    // Subscribe to game data changes
    const unsubscribeGame = subscribeToGame(gameId, (data) => {
      setGameData(data);
      setLoading(false);
    });

    // Subscribe to real-time updates
    const unsubscribeUpdates = subscribeToGameUpdates(gameId, (updatesData) => {
      setUpdates(updatesData.slice(0, 10)); // Show last 10 updates
    });

    return () => {
      unsubscribeGame();
      unsubscribeUpdates();
    };
  }, [gameId]);

  const handleAssignDamage = async () => {
    if (!selectedUnit || !damageAmount) return;

    try {
      const damage = {
        damageDealt: parseInt(damageAmount),
        remainingWounds: Math.max(0, selectedUnit.currentWounds - parseInt(damageAmount)),
        totalDamage: (selectedUnit.totalDamage || 0) + parseInt(damageAmount)
      };

      await assignDamage(gameId, selectedUnit.id, damage, user.uid);
      setDamageAmount(1);
      setSelectedUnit(null);
    } catch (error) {
      console.error('Failed to assign damage:', error);
    }
  };

  const handleAssignVP = async () => {
    if (!vpAmount || !vpReason.trim()) return;

    try {
      await assignVictoryPoints(gameId, user.uid, parseInt(vpAmount), vpReason);
      setVpAmount(1);
      setVpReason('');
    } catch (error) {
      console.error('Failed to assign victory points:', error);
    }
  };

  const handleNextTurn = async () => {
    try {
      await nextTurn(gameId);
    } catch (error) {
      console.error('Failed to advance turn:', error);
    }
  };

  if (loading) {
    return <div>Loading game session...</div>;
  }

  if (!gameData) {
    return <div>Game not found</div>;
  }

  const currentPlayerIndex = gameData.currentTurn || 0;
  const currentPlayer = gameData.players[currentPlayerIndex];
  const isMyTurn = currentPlayer === user.uid;

  // Get all units from player armies using actual army data
  const allUnits = [];
  Object.entries(gameData.playerArmies || {}).forEach(([playerId, playerArmy]) => {
    if (playerArmy.armyData && playerArmy.armyData.units) {
      playerArmy.armyData.units.forEach((unit, index) => {
        allUnits.push({
          id: `${playerId}_unit_${index}`,
          name: unit.name || 'Unknown Unit',
          playerId,
          playerName: playerArmy.playerName || 'Unknown Player',
          currentWounds: unit.wounds || 1,
          totalWounds: unit.wounds || 1,
          totalDamage: 0,
          points: unit.points || 0,
          weapons: unit.weapons || []
        });
      });
    }
  });

  return (
    <div className="game-session">
      <div className="game-header">
        <h2>{gameData.name}</h2>
        <div className="game-info">
          <span>Round: {gameData.round || 1}</span>
          <span>Current Turn: {isMyTurn ? 'Your Turn' : 'Waiting...'}</span>
          <span>Game ID: {gameId}</span>
        </div>
      </div>

      <div className="game-content">
        <div className="units-sidebar">
          <h3>Units</h3>
          <div className="units-list">
            {allUnits.map((unit) => (
              <div 
                key={unit.id}
                className={`unit-card ${selectedUnit?.id === unit.id ? 'selected' : ''}`}
                onClick={() => setSelectedUnit(unit)}
              >
                <h4>{unit.name}</h4>
                <p className="unit-player">Player: {unit.playerName}</p>
                <p>Wounds: {unit.currentWounds}/{unit.totalWounds}</p>
                <p>Points: {unit.points}</p>
                <p>Damage Taken: {unit.totalDamage || 0}</p>
                {unit.weapons && unit.weapons.length > 0 && (
                  <p>Weapons: {unit.weapons.length}</p>
                )}
                <div className="unit-status">
                  {unit.currentWounds === 0 ? '💀 Destroyed' : '✅ Active'}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="game-main">
          <div className="actions-section">
            <h3>Actions</h3>
            
            <div className="action-group">
              <h4>Assign Damage</h4>
              <div className="action-controls">
                <input
                  type="number"
                  min="1"
                  value={damageAmount}
                  onChange={(e) => setDamageAmount(e.target.value)}
                  placeholder="Damage amount"
                />
                <button 
                  onClick={handleAssignDamage}
                  disabled={!selectedUnit || !isMyTurn}
                  className="action-btn damage-btn"
                >
                  Assign Damage
                </button>
              </div>
              {selectedUnit && (
                <p>Selected: {selectedUnit.name}</p>
              )}
            </div>

            <div className="action-group">
              <h4>Award Victory Points</h4>
              <div className="action-controls">
                <input
                  type="number"
                  min="1"
                  value={vpAmount}
                  onChange={(e) => setVpAmount(e.target.value)}
                  placeholder="VP amount"
                />
                <input
                  type="text"
                  value={vpReason}
                  onChange={(e) => setVpReason(e.target.value)}
                  placeholder="Reason (e.g., 'Destroyed enemy unit')"
                />
                <button 
                  onClick={handleAssignVP}
                  disabled={!isMyTurn || !vpReason.trim()}
                  className="action-btn vp-btn"
                >
                  Award VP
                </button>
              </div>
            </div>

            <div className="action-group">
              <button 
                onClick={handleNextTurn}
                disabled={!isMyTurn}
                className="action-btn next-turn-btn"
              >
                End Turn
              </button>
            </div>
          </div>
        </div>

        <div className="game-sidebar">
          <div className="victory-points">
            <h3>Victory Points</h3>
            {Object.entries(gameData.gameState?.totalVP || {}).map(([playerId, vp]) => (
              <div key={playerId} className="vp-entry">
                <span>Player {playerId.slice(0, 8)}...</span>
                <span>{vp} VP</span>
              </div>
            ))}
          </div>

          <div className="recent-updates">
            <h3>Recent Updates</h3>
            <div className="updates-list">
              {updates.map((update) => (
                <div key={update.id} className="update-item">
                  <div className="update-type">{update.type}</div>
                  <div className="update-details">
                    {update.type === 'damage' && `${update.damage} damage to unit`}
                    {update.type === 'victory_points' && `+${update.points} VP: ${update.reason}`}
                    {update.type === 'turn_change' && `Turn advanced to Round ${update.round}`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .game-session {
          max-width: 1400px;
          margin: 0 auto;
        }

        .game-header {
          background: white;
          padding: 1.5rem;
          border-radius: 8px;
          margin-bottom: 2rem;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .game-header h2 {
          margin: 0 0 1rem 0;
          color: #2c3e50;
        }

        .game-info {
          display: flex;
          gap: 2rem;
          color: #666;
        }

        .game-content {
          display: grid;
          grid-template-columns: 300px 1fr 300px;
          gap: 2rem;
        }

        .units-sidebar {
          background: white;
          padding: 1.5rem;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          height: fit-content;
          max-height: 80vh;
          overflow-y: auto;
        }

        .units-sidebar h3 {
          margin: 0 0 1rem 0;
          color: #2c3e50;
          position: sticky;
          top: 0;
          background: white;
          padding-bottom: 0.5rem;
        }

        .units-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .game-main {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .actions-section {
          background: white;
          padding: 1.5rem;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .actions-section h3 {
          margin: 0 0 1rem 0;
          color: #2c3e50;
        }

        .unit-card {
          border: 2px solid #ddd;
          padding: 0.75rem;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.3s;
          font-size: 0.9rem;
        }

        .unit-card h4 {
          margin: 0 0 0.5rem 0;
          font-size: 1rem;
          color: #2c3e50;
        }

        .unit-card p {
          margin: 0.25rem 0;
          font-size: 0.85rem;
        }

        .unit-card:hover {
          border-color: #3498db;
        }

        .unit-card.selected {
          border-color: #e74c3c;
          background: #fdf2f2;
        }

        .unit-card h4 {
          margin: 0 0 0.5rem 0;
          color: #2c3e50;
        }

        .unit-card p {
          margin: 0.25rem 0;
          color: #666;
          font-size: 14px;
        }

        .unit-status {
          margin-top: 0.5rem;
          font-weight: bold;
        }

        .action-group {
          margin-bottom: 2rem;
        }

        .action-group h4 {
          margin: 0 0 1rem 0;
          color: #34495e;
        }

        .action-controls {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
          flex-wrap: wrap;
        }

        .action-controls input {
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }

        .action-controls input[type="number"] {
          width: 100px;
        }

        .action-controls input[type="text"] {
          flex: 1;
          min-width: 200px;
        }

        .action-btn {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          font-weight: bold;
        }

        .action-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .damage-btn {
          background: #e74c3c;
          color: white;
        }

        .damage-btn:hover:not(:disabled) {
          background: #c0392b;
        }

        .vp-btn {
          background: #f39c12;
          color: white;
        }

        .vp-btn:hover:not(:disabled) {
          background: #e67e22;
        }

        .next-turn-btn {
          background: #27ae60;
          color: white;
          padding: 12px 24px;
          font-size: 16px;
        }

        .next-turn-btn:hover:not(:disabled) {
          background: #219a52;
        }

        .game-sidebar {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .victory-points, .recent-updates {
          background: white;
          padding: 1.5rem;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .victory-points h3, .recent-updates h3 {
          margin: 0 0 1rem 0;
          color: #2c3e50;
        }

        .vp-entry {
          display: flex;
          justify-content: space-between;
          padding: 0.5rem 0;
          border-bottom: 1px solid #eee;
        }

        .updates-list {
          max-height: 300px;
          overflow-y: auto;
        }

        .update-item {
          padding: 0.75rem 0;
          border-bottom: 1px solid #eee;
        }

        .update-type {
          font-weight: bold;
          color: #3498db;
          font-size: 12px;
          text-transform: uppercase;
        }

        .update-details {
          color: #666;
          font-size: 14px;
          margin-top: 0.25rem;
        }

        @media (max-width: 1024px) {
          .game-content {
            grid-template-columns: 1fr;
          }
          
          .game-sidebar {
            order: -1;
          }
        }

        @media (max-width: 768px) {
          .game-info {
            flex-direction: column;
            gap: 0.5rem;
          }
          
          .units-grid {
            grid-template-columns: 1fr;
          }
          
          .action-controls {
            flex-direction: column;
          }
          
          .action-controls input[type="text"] {
            min-width: auto;
          }
        }
      `}</style>
    </div>
  );
};

export default GameSession;
