import React, { useState, useEffect } from 'react';
import { getUserArmies, createArmy, createGame, joinGame } from '../firebase/database';

const ArmyManager = ({ user, onJoinGame }) => {
  const [armies, setArmies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateGame, setShowCreateGame] = useState(false);
  const [gameId, setGameId] = useState('');

  useEffect(() => {
    loadUserArmies();
  }, [user]);

  const loadUserArmies = async () => {
    try {
      const userArmies = await getUserArmies(user.uid);
      setArmies(userArmies);
    } catch (error) {
      console.error('Failed to load armies:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateArmy = async () => {
    // For now, create a sample army based on your existing data structure
    const sampleArmy = {
      name: "Sample Space Marines",
      faction: "Space Marines",
      units: [
        {
          id: "unit1",
          name: "Tactical Squad",
          type: "INFANTRY",
          models: 10,
          wounds: 1,
          currentWounds: 1,
          weapons: [
            {
              name: "Bolter",
              range: "24\"",
              type: "Rapid Fire 1",
              attacks: 1,
              skill: 3,
              strength: 4,
              ap: 0,
              damage: 1
            }
          ]
        }
      ]
    };

    try {
      await createArmy(user.uid, sampleArmy);
      loadUserArmies(); // Refresh the list
    } catch (error) {
      console.error('Failed to create army:', error);
    }
  };

  const handleCreateGame = async (selectedArmyId) => {
    try {
      const gameData = {
        name: `${user.displayName}'s Game`,
        players: [user.uid],
        playerArmies: {
          [user.uid]: selectedArmyId
        },
        gameState: {
          units: {},
          damageHistory: {},
          victoryPoints: {},
          totalVP: { [user.uid]: 0 }
        }
      };

      const newGameId = await createGame(gameData);
      onJoinGame(newGameId);
    } catch (error) {
      console.error('Failed to create game:', error);
    }
  };

  const handleJoinGame = async () => {
    if (!gameId.trim()) return;
    
    try {
      // For now, just join with the first army
      const armyId = armies.length > 0 ? armies[0].id : null;
      if (armyId) {
        await joinGame(gameId, user.uid, armyId);
        onJoinGame(gameId);
      } else {
        alert('You need at least one army to join a game');
      }
    } catch (error) {
      console.error('Failed to join game:', error);
    }
  };

  if (loading) {
    return <div>Loading armies...</div>;
  }

  return (
    <div className="army-manager">
      <div className="army-manager-header">
        <h2>My Armies</h2>
        <button onClick={handleCreateArmy} className="create-army-btn">
          Create Sample Army
        </button>
      </div>

      <div className="armies-grid">
        {armies.length === 0 ? (
          <div className="no-armies">
            <p>No armies yet. Create your first army to get started!</p>
          </div>
        ) : (
          armies.map((army) => (
            <div key={army.id} className="army-card">
              <h3>{army.name}</h3>
              <p><strong>Faction:</strong> {army.faction}</p>
              <p><strong>Units:</strong> {army.units?.length || 0}</p>
              <div className="army-actions">
                <button 
                  onClick={() => handleCreateGame(army.id)}
                  className="start-game-btn"
                >
                  Start Game
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="game-actions">
        <h3>Join Existing Game</h3>
        <div className="join-game-form">
          <input
            type="text"
            placeholder="Enter Game ID"
            value={gameId}
            onChange={(e) => setGameId(e.target.value)}
            className="game-id-input"
          />
          <button onClick={handleJoinGame} className="join-game-btn">
            Join Game
          </button>
        </div>
      </div>

      <style jsx>{`
        .army-manager {
          max-width: 1200px;
          margin: 0 auto;
        }

        .army-manager-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }

        .create-army-btn {
          background: #27ae60;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 5px;
          cursor: pointer;
          font-size: 16px;
        }

        .create-army-btn:hover {
          background: #219a52;
        }

        .armies-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.5rem;
          margin-bottom: 3rem;
        }

        .no-armies {
          grid-column: 1 / -1;
          text-align: center;
          padding: 3rem;
          background: white;
          border-radius: 8px;
          color: #666;
        }

        .army-card {
          background: white;
          padding: 1.5rem;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          border: 1px solid #ddd;
        }

        .army-card h3 {
          margin: 0 0 1rem 0;
          color: #2c3e50;
        }

        .army-card p {
          margin: 0.5rem 0;
          color: #666;
        }

        .army-actions {
          margin-top: 1rem;
        }

        .start-game-btn {
          background: #3498db;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }

        .start-game-btn:hover {
          background: #2980b9;
        }

        .game-actions {
          background: white;
          padding: 2rem;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .game-actions h3 {
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

        .join-game-btn {
          background: #e67e22;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 16px;
        }

        .join-game-btn:hover {
          background: #d35400;
        }

        @media (max-width: 768px) {
          .army-manager-header {
            flex-direction: column;
            gap: 1rem;
            text-align: center;
          }

          .join-game-form {
            flex-direction: column;
          }

          .game-id-input {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default ArmyManager;
