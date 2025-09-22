import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getGame, updateGame, subscribeToGame, subscribeToGameUpdates, assignDamage } from '../firebase/database';
// AuthContext will be implemented later
import UnitDatasheet from './UnitDatasheet';

// Sortable unit card powered by dnd-kit
const SortableUnitBase = ({ unit, isSelected, onClick, statusClass, shouldGlowAsLeader }) => {
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} = useSortable({ id: unit.id });
  const style = {
    transform: isDragging ? undefined : CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
    zIndex: isDragging ? 20 : 'auto',
    opacity: isDragging ? 0 : 1,
    willChange: isDragging ? 'auto' : 'transform',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`unit-card ${isSelected ? 'selected' : ''} ${statusClass} ${shouldGlowAsLeader ? 'leader-glow' : ''}`}
      onClick={() => onClick(unit)}
      {...attributes}
      {...listeners}
    >
      <div className="drag-handle" title="Drag to reorder">⋮⋮</div>
      <h4>{unit.name}</h4>
    </div>
  );
};
SortableUnitBase.displayName = 'SortableUnit';
const SortableUnit = React.memo(SortableUnitBase);

const GameSession = ({ gameId, user }) => {
  const [gameData, setGameData] = useState(null);
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [damageAmount, setDamageAmount] = useState(1);
  const [vpAmount, setVpAmount] = useState(1);
  const [vpReason, setVpReason] = useState('');
  const [draggedUnit, setDraggedUnit] = useState(null);
  const [unitOrder, setUnitOrder] = useState([]);
  const listRef = useRef(null);

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

  // Create ordered units array based on unitOrder state
  const orderedUnits = useMemo(() => {
    if (!gameData) return [];
    
    // Extract all units from all players
    const allUnits = [];
    if (gameData.playerArmies) {
      Object.entries(gameData.playerArmies).forEach(([playerId, playerData]) => {
        if (playerData.armyData && playerData.armyData.units) {
          playerData.armyData.units.forEach((unit, index) => {
            allUnits.push({
              id: `${playerId}_unit_${index}`,
              name: unit.name || 'Unknown Unit',
              playerId,
              playerName: playerData.playerName || 'Unknown Player',
              currentWounds: unit.currentWounds !== undefined ? unit.currentWounds : (unit.wounds || 1),
              totalWounds: unit.wounds || 1,
              totalDamage: unit.totalDamage || 0,
              victoryPoints: unit.victoryPoints || 0,
              points: unit.points || 0,
              models: unit.models || unit.size || 1,
              // Preserve all unit data
              movement: unit.movement,
              weapon_skill: unit.weapon_skill,
              ballistic_skill: unit.ballistic_skill,
              strength: unit.strength,
              toughness: unit.toughness,
              wounds: unit.wounds,
              attacks: unit.attacks,
              leadership: unit.leadership,
              armor_save: unit.armor_save,
              invulnerable_save: unit.invulnerable_save,
              objective_control: unit.objective_control,
              weapons: unit.weapons || [],
              modelGroups: unit.modelGroups || [],
              abilities: unit.abilities || [],
              rules: unit.rules || [],
              keywords: unit.keywords || []
            });
          });
        }
      });
    }

    return unitOrder.length > 0
      ? unitOrder.map(id => allUnits.find(unit => unit.id === id)).filter(Boolean)
      : allUnits;
  }, [gameData, unitOrder]);

  // Placeholder approach needs no visual order effect

  // Initialize unit order if not set
  useEffect(() => {
    if (unitOrder.length === 0 && orderedUnits.length > 0) {
      setUnitOrder(orderedUnits.map(unit => unit.id));
    }
  }, [unitOrder.length, orderedUnits]);


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
  // dnd-kit sensors and handlers
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 1 } }));

  const itemIds = useMemo(() => orderedUnits.map(u => u.id), [orderedUnits]);

  const handleDndStart = (event) => {
    const activeId = event.active?.id;
    const unit = orderedUnits.find(u => u.id === activeId) || null;
    setDraggedUnit(unit);
  };

  const handleDndEnd = (event) => {
    const { active, over } = event;
    setDraggedUnit(null);
    if (!over || active.id === over.id) return;
    const oldIndex = itemIds.indexOf(active.id);
    const newIndex = itemIds.indexOf(over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const newOrderIds = arrayMove(itemIds, oldIndex, newIndex);
    setUnitOrder(newOrderIds);
  };

  // Helper functions for new unit status system
  const getUnitStatusClass = (unit) => {
    if (unit.currentWounds === 0) return 'dead';
    if (unit.hasActed) return 'done'; // Assuming we'll add this field
    return 'ready';
  };

  const getUnitStatusText = (unit) => {
    if (unit.currentWounds === 0) return 'Dead';
    if (unit.hasActed) return 'Done';
    return 'Ready';
  };

  // Leader detection - check if leader can attach to specific unit
  const canLeaderAttachToUnit = (leader, draggedUnit) => {
    if (!leader.abilities || !draggedUnit) return false;
    
    // Check if leader has attachment ability that mentions the dragged unit
    return leader.abilities.some(ability => {
      const abilityText = (ability.description || ability.text || '').toLowerCase();
      const draggedUnitName = draggedUnit.name.toLowerCase();
      
      // Must have attachment phrase AND mention the specific unit name (or key parts of it)
      if (!abilityText.includes('this model can be attached to')) {
        return false;
      }
      
      // Check for exact name match or key unit type matches
      return abilityText.includes(draggedUnitName) ||
             // Handle common unit type variations
             (draggedUnitName.includes('assault intercessor') && abilityText.includes('assault intercessor')) ||
             (draggedUnitName.includes('vanguard veteran') && abilityText.includes('vanguard veteran')) ||
             (draggedUnitName.includes('jump pack') && abilityText.includes('jump pack'));
    });
  };


  if (loading) {
    return <div>Loading...</div>;
  }

  if (!gameData) {
    return <div className="error">Game not found</div>;
  }



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
          
          {/* Status Legend */}
          <div className="status-legend">
            <div className="legend-item">
              <div className="legend-color ready"></div>
              <span>Ready</span>
            </div>
            <div className="legend-item">
              <div className="legend-color done"></div>
              <span>Done</span>
            </div>
            <div className="legend-item">
              <div className="legend-color dead"></div>
              <span>Dead</span>
            </div>
          </div>
          
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragStart={handleDndStart}
            onDragEnd={handleDndEnd}
            onDragCancel={() => setDraggedUnit(null)}
          >
            <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
              <div className="units-list" ref={listRef}>
                {orderedUnits.map((unit) => {
                  const shouldGlowAsLeader = draggedUnit && canLeaderAttachToUnit(unit, draggedUnit) && draggedUnit.id !== unit.id;
                  return (
                    <SortableUnit
                      key={unit.id}
                      unit={unit}
                      isSelected={selectedUnit?.id === unit.id}
                      onClick={setSelectedUnit}
                      statusClass={getUnitStatusClass(unit)}
                      shouldGlowAsLeader={!!shouldGlowAsLeader}
                    />
                  );
                })}
              </div>
            </SortableContext>
            <DragOverlay adjustScale={false} dropAnimation={null}>
              {draggedUnit ? (
                <div className={`unit-card dragging ${getUnitStatusClass(draggedUnit)} ${selectedUnit?.id === draggedUnit.id ? 'selected' : ''}`} style={{ pointerEvents: 'none', cursor: 'grabbing', boxShadow: '0 10px 20px rgba(0,0,0,0.25)', border: '2px solid var(--action-primary)' }}>
                  <div className="drag-handle" title="Drag to reorder">⋮⋮</div>
                  <h4>{draggedUnit.name}</h4>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
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
