import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getGame, updateGame, subscribeToGame, subscribeToGameUpdates, assignDamage } from '../firebase/database';
// AuthContext will be implemented later
import UnitDatasheet from './UnitDatasheet';

const GameSession = ({ gameId, user }) => {
  const [gameData, setGameData] = useState(null);
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [damageAmount, setDamageAmount] = useState(1);
  const [vpAmount, setVpAmount] = useState(1);
  const [vpReason, setVpReason] = useState('');
  const [draggedUnit, setDraggedUnit] = useState(null);
  const [draggedOverIndex, setDraggedOverIndex] = useState(null);
  const [unitOrder, setUnitOrder] = useState([]);

  useEffect(() => {
    if (!gameId) return;

    const unsubscribeGame = subscribeToGame(gameId, (gameDoc) => {
      setGameData(gameDoc);
      setLoading(false);
    });

    const unsubscribeUpdates = subscribeToGameUpdates(gameId, (updatesData) => {
      setUpdates(updatesData);
    });

    return () => {
      unsubscribeGame();
      unsubscribeUpdates();
    };
  }, [gameId]);

  const handleAssignDamage = async () => {
    if (!selectedUnit || !damageAmount) return;

    try {
      const damage = parseInt(damageAmount);
      const newWounds = Math.max(0, selectedUnit.currentWounds - damage);
      
      const damageData = {
        remainingWounds: newWounds,
        totalDamage: (selectedUnit.totalDamage || 0) + damage,
        damageDealt: damage
      };
      
      await assignDamage(gameId, selectedUnit.id, damageData, user.uid);
      setDamageAmount(1);
      setSelectedUnit(null);
    } catch (error) {
      console.error('Failed to assign damage:', error);
    }
  };

  const handleAssignVP = async () => {
    if (!vpAmount || !vpReason.trim()) return;
    
    try {
      // TODO: Implement assignVictoryPoints function
      console.log('Assigning VP:', vpAmount, vpReason);
      setVpAmount(1);
      setVpReason('');
    } catch (error) {
      console.error('Error assigning victory points:', error);
    }
  };

  const handleNextTurn = async () => {
    try {
      // TODO: Implement nextTurn function
      console.log('Advancing turn for game:', gameId);
    } catch (error) {
      console.error('Error advancing turn:', error);
    }
  };

  const handleDragStart = (e, unit) => {
    setDraggedUnit(unit);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', unit.id);
  };

  const handleDragEnd = () => {
    setDraggedUnit(null);
    setDraggedOverIndex(null);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDraggedOverIndex(index);
  };

  const handleDragLeave = () => {
    setDraggedOverIndex(null);
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();

    if (draggedUnit && dropIndex !== undefined) {
      const draggedIndex = orderedUnits.findIndex(unit => unit.id === draggedUnit.id);

      if (draggedIndex !== dropIndex) {
        const newOrder = [...orderedUnits];
        const [draggedItem] = newOrder.splice(draggedIndex, 1);
        newOrder.splice(dropIndex, 0, draggedItem);

        setUnitOrder(newOrder.map(unit => unit.id));
        console.log(`Reordered: moved ${draggedUnit.name} to position ${dropIndex + 1}`);
      }
    }

    setDraggedUnit(null);
    setDraggedOverIndex(null);
  };

  if (loading) {
    return <div className="loading">Loading game...</div>;
  }

  if (!gameData) {
    return <div className="error">Game not found</div>;
  }

  // Extract all units from all players
  const allUnits = [];
  if (gameData.playerArmies) {
    Object.entries(gameData.playerArmies).forEach(([playerId, playerArmy]) => {
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
            models: unit.models || unit.size || 1,
            weapons: unit.weapons || [],
            modelGroups: unit.modelGroups || [],
            abilities: unit.abilities || [],
            rules: unit.rules || [],
            keywords: unit.keywords || [],
            // Include all unit stats
            weapon_skill: unit.weapon_skill,
            ballistic_skill: unit.ballistic_skill,
            toughness: unit.toughness,
            armor_save: unit.armor_save,
            invulnerable_save: unit.invulnerable_save
          });
        });
      }
    });
  }

  // Initialize unit order if not set
  if (unitOrder.length === 0 && allUnits.length > 0) {
    setUnitOrder(allUnits.map(unit => unit.id));
  }

  // Create ordered units array based on unitOrder state
  const orderedUnits = unitOrder.length > 0
    ? unitOrder.map(id => allUnits.find(unit => unit.id === id)).filter(Boolean)
    : allUnits;

  // Determine whose turn it is
  const isMyTurn = gameData.currentTurn === user?.uid;

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
          <h3>{user?.displayName || user?.email || 'Player'}'s Army</h3>
          <div className="units-list">
            {orderedUnits.map((unit, index) => (
              <div 
                key={unit.id}
                className={`unit-card ${selectedUnit?.id === unit.id ? 'selected' : ''} ${draggedUnit?.id === unit.id ? 'dragging' : ''} ${draggedOverIndex === index ? 'drag-over' : ''}`}
                onClick={() => setSelectedUnit(unit)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
              >
                <div 
                  className="drag-handle"
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, unit)}
                  onDragEnd={handleDragEnd}
                  title="Drag to reorder"
                >
                  ⋮⋮
                </div>
                <h4>{unit.name}</h4>
                <div className="unit-status">
                  {unit.currentWounds === 0 ? '💀 Destroyed' : 
                   isMyTurn && unit.playerId === user.uid ? '⚡ Ready' : '⏸️ Waiting'}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="game-main">
          {selectedUnit ? (
            <UnitDatasheet
              unit={selectedUnit}
              isSelected={true}
              onClick={() => {}}
            />
          ) : (
            <div className="no-unit-selected">
              <h3>Select a unit from the sidebar to view details</h3>
              <p>Click on any unit in your army list to see its datasheet and available actions.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GameSession;
