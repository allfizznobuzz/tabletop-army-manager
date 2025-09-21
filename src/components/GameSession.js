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
  const [draggedUnit, setDraggedUnit] = useState(null);
  const [draggedOverIndex, setDraggedOverIndex] = useState(null);
  const [unitOrder, setUnitOrder] = useState([]);

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
      console.error('Error advancing turn:', error);
    }
  };

  const handleDragStart = (e, unit) => {
    setDraggedUnit(unit);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', unit.id);
  };

  const handleDragEnd = (e) => {
    setDraggedUnit(null);
    setDraggedOverIndex(null);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDraggedOverIndex(index);
  };

  const handleDragLeave = (e) => {
    // Only clear if we're leaving the unit card entirely
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDraggedOverIndex(null);
    }
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    
    if (draggedUnit && dropIndex !== undefined) {
      const draggedIndex = orderedUnits.findIndex(unit => unit.id === draggedUnit.id);
      
      if (draggedIndex !== dropIndex) {
        const newOrder = [...orderedUnits];
        const [draggedItem] = newOrder.splice(draggedIndex, 1);
        newOrder.splice(dropIndex, 0, draggedItem);
        
        // Update the unit order state
        setUnitOrder(newOrder.map(unit => unit.id));
        console.log(`Reordered: moved ${draggedUnit.name} to position ${dropIndex + 1}`);
      }
    }
    
    setDraggedUnit(null);
    setDraggedOverIndex(null);
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

  // Initialize unit order if not set
  if (unitOrder.length === 0 && allUnits.length > 0) {
    setUnitOrder(allUnits.map(unit => unit.id));
  }

  // Create ordered units array based on unitOrder state
  const orderedUnits = unitOrder.length > 0 
    ? unitOrder.map(id => allUnits.find(unit => unit.id === id)).filter(Boolean)
    : allUnits;

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
                <div className="selected-unit-info">
                  <div className="unit-header">
                    <h4>{selectedUnit.name}</h4>
                    <div className="unit-basic-stats">
                      <span><strong>Player:</strong> {selectedUnit.playerName}</span>
                      <span><strong>Type:</strong> {selectedUnit.type || 'INFANTRY'}</span>
                      <span><strong>Points:</strong> {selectedUnit.points || 0}</span>
                    </div>
                  </div>

                  {/* Unit Profile Stats */}
                  <div className="unit-profile">
                    <h5>Unit Profile:</h5>
                    <div className="profile-stats">
                      <div className="stat-row">
                        <div className="stat-item">
                          <span className="stat-label">Models</span>
                          <span className="stat-value">{selectedUnit.models || 1}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">Wounds</span>
                          <span className="stat-value">{selectedUnit.currentWounds}/{selectedUnit.totalWounds || selectedUnit.wounds || 1}</span>
                        </div>
                        {selectedUnit.weapon_skill && (
                          <div className="stat-item">
                            <span className="stat-label">WS</span>
                            <span className="stat-value">{selectedUnit.weapon_skill}+</span>
                          </div>
                        )}
                        {selectedUnit.ballistic_skill && (
                          <div className="stat-item">
                            <span className="stat-label">BS</span>
                            <span className="stat-value">{selectedUnit.ballistic_skill}+</span>
                          </div>
                        )}
                        {selectedUnit.toughness && (
                          <div className="stat-item">
                            <span className="stat-label">T</span>
                            <span className="stat-value">{selectedUnit.toughness}</span>
                          </div>
                        )}
                        {selectedUnit.armor_save && (
                          <div className="stat-item">
                            <span className="stat-label">Sv</span>
                            <span className="stat-value">{selectedUnit.armor_save}+</span>
                          </div>
                        )}
                        {selectedUnit.invulnerable_save && (
                          <div className="stat-item">
                            <span className="stat-label">Inv</span>
                            <span className="stat-value">{selectedUnit.invulnerable_save}++</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Debug logging for selected unit */}
                  {console.log('Selected unit data:', {
                    name: selectedUnit.name,
                    abilities: selectedUnit.abilities,
                    rules: selectedUnit.rules,
                    keywords: selectedUnit.keywords
                  })}

                  {/* Unit Abilities (with full descriptions) */}
                  {selectedUnit.abilities && selectedUnit.abilities.length > 0 && (
                    <div className="unit-abilities">
                      <h5>Abilities:</h5>
                      <div className="abilities-list">
                        {selectedUnit.abilities.map((ability, index) => (
                          <div key={index} className="ability-item">
                            <strong>{ability.name}:</strong>
                            <p>{ability.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Unit Rules (names only) */}
                  {selectedUnit.rules && selectedUnit.rules.length > 0 && (
                    <div className="unit-rules">
                      <h5>Rules:</h5>
                      <div className="rules-list">
                        {selectedUnit.rules.map((rule, index) => (
                          <span key={index} className="rule-tag">{rule}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Keywords (names only) */}
                  {selectedUnit.keywords && selectedUnit.keywords.length > 0 && (
                    <div className="unit-keywords">
                      <h5>Keywords:</h5>
                      <div className="keywords-list">
                        {selectedUnit.keywords.map((keyword, index) => (
                          <span key={index} className="keyword-tag">{keyword}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="model-groups-section">
                    <h5>Model Groups:</h5>
                    {selectedUnit.weapons && selectedUnit.weapons.length > 0 ? (
                      (() => {
                        // Debug logging
                        console.log('=== GAME SESSION DEBUG ===');
                        console.log('Selected Unit:', selectedUnit.name);
                        console.log('Total Models:', selectedUnit.models);
                        console.log('Weapons Array:', selectedUnit.weapons);
                        console.log('Model Groups:', selectedUnit.modelGroups);
                        console.log('Has Model Groups:', selectedUnit.modelGroups && selectedUnit.modelGroups.length > 0);
                        if (selectedUnit.modelGroups) {
                          selectedUnit.modelGroups.forEach((group, i) => {
                            console.log(`Group ${i + 1}: ${group.count}x ${group.name}`);
                            console.log('  Weapons:', group.weapons);
                          });
                        }
                        console.log('=== END DEBUG ===');
                        
                        const totalModels = selectedUnit.models || 1;
                        const modelGroupCards = [];
                        
                        // Check if unit has model groups (sergeant + standard marines)
                        console.log('Checking modelGroups condition:', {
                          hasModelGroups: !!selectedUnit.modelGroups,
                          modelGroupsLength: selectedUnit.modelGroups ? selectedUnit.modelGroups.length : 0,
                          modelGroups: selectedUnit.modelGroups
                        });
                        
                        if (selectedUnit.modelGroups && selectedUnit.modelGroups.length > 0) {
                          console.log('✅ Using model groups from parser');
                          // Use the model groups from the parser
                          selectedUnit.modelGroups.forEach((modelGroup, index) => {
                            console.log(`Creating model group ${index + 1}:`, modelGroup);
                            const weaponsWithCount = modelGroup.weapons.map(weapon => ({
                              ...weapon,
                              modelCount: weapon.count || 1
                            }));
                            
                            modelGroupCards.push({
                              count: modelGroup.count,
                              weapons: weaponsWithCount,
                              name: modelGroup.name // Use the exact name from the parser
                            });
                          });
                        } else {
                          console.log('❌ Falling back to old logic');
                          // Fallback for single model units or units without model groups
                          if (totalModels === 1 || totalModels === 0) {
                            modelGroupCards.push({
                              count: 1,
                              weapons: selectedUnit.weapons,
                              name: selectedUnit.name.replace(/ with.*$/, '')
                            });
                          } else {
                            // For multi-model units, use pre-grouped weapons from parser
                            const weaponsWithCount = selectedUnit.weapons.map(weapon => ({
                              ...weapon,
                              modelCount: weapon.count || 1
                            }));
                            
                            modelGroupCards.push({
                              count: totalModels,
                              weapons: weaponsWithCount,
                              name: selectedUnit.name.replace(/s$/, '').replace(/ with.*$/, '')
                            });
                          }
                        }
                        
                        console.log('Model Group Cards:', modelGroupCards);
                        
                        return modelGroupCards.map((group, index) => (
                          <div key={index} className="model-group-card">
                            <h6>{group.count}x {group.name}{group.count > 1 ? 's' : ''}</h6>
                            {group.weapons.map((weapon, weaponIndex) => (
                              <div key={weaponIndex} className="weapon-entry">
                                <div className="weapon-name">
                                  • {weapon.name || 'Unknown Weapon'}
                                  {weapon.modelCount && weapon.modelCount > 1 && (
                                    <span className="weapon-count"> (x{weapon.modelCount})</span>
                                  )}
                                </div>
                                <div className="weapon-stats">
                                  {weapon.range && <span>Range: {weapon.range}</span>}
                                  {weapon.attacks && <span>A: {weapon.attacks}</span>}
                                  {weapon.skill && <span>WS/BS: {weapon.skill}</span>}
                                  {weapon.strength && <span>S: {weapon.strength}</span>}
                                  {weapon.ap && <span>AP: {weapon.ap}</span>}
                                  {weapon.damage && <span>D: {weapon.damage}</span>}
                                </div>
                                {weapon.abilities && weapon.abilities.length > 0 && (
                                  <div className="weapon-abilities">
                                    <em>{weapon.abilities.join(', ')}</em>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ));
                      })()
                    ) : (
                      <div className="model-group-card">
                        <h6>{selectedUnit.models || 1}x {selectedUnit.name}</h6>
                        <p>No weapons found for this unit.</p>
                      </div>
                    )}
                  </div>
                </div>
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
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          height: fit-content;
          max-height: 80vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .units-sidebar h3 {
          margin: 0;
          color: #2c3e50;
          background: white;
          padding: 1.5rem 1.5rem 1rem 1.5rem;
          flex-shrink: 0;
          border-bottom: 1px solid #eee;
        }

        .units-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          padding: 1rem 1.5rem 1.5rem 1.5rem;
          overflow-y: auto;
          flex: 1;
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
          background: white;
          z-index: 1;
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

        .selected-unit-info {
          background: #f8f9fa;
          border: 1px solid #dee2e6;
          border-radius: 6px;
          padding: 1rem;
          margin-top: 1rem;
        }

        .unit-header h4 {
          margin: 0 0 0.5rem 0;
          color: #333;
        }

        .unit-stats {
          display: flex;
          gap: 1rem;
          margin-bottom: 1rem;
          font-size: 0.9rem;
          color: #666;
        }

        .model-groups-section h5 {
          margin: 0 0 0.75rem 0;
          color: #495057;
          font-size: 1rem;
        }

        .model-group-card {
          border: 2px solid #ddd;
          padding: 0.75rem;
          border-radius: 6px;
          margin-bottom: 1rem;
          background: white;
          transition: all 0.3s;
        }

        .model-group-card h6 {
          margin: 0 0 0.5rem 0;
          color: #2c3e50;
          font-size: 1rem;
          font-weight: 600;
        }

        .weapon-entry {
          margin-bottom: 0.75rem;
        }

        .weapon-name {
          font-weight: 500;
          color: #333;
          display: block;
          margin-bottom: 0.25rem;
          font-size: 0.9rem;
        }

        .weapon-stats {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          font-size: 0.8rem;
          color: #666;
          margin-bottom: 0.25rem;
        }

        .weapon-abilities {
          font-size: 0.8rem;
          color: #666;
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
