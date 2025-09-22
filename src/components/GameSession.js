import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragOverlay, useDraggable } from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getGame, updateGame, subscribeToGame, subscribeToGameUpdates, assignDamage } from '../firebase/database';
// AuthContext will be implemented later
import UnitDatasheet from './UnitDatasheet';

// Sortable unit card powered by dnd-kit
const SortableUnitBase = ({ unit, isSelected, onClick, statusClass, shouldGlowAsLeader, freezeTransform, dropIntent }) => {
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} = useSortable({ id: unit.id });
  const style = {
    transform: isDragging ? undefined : (freezeTransform ? undefined : CSS.Transform.toString(transform)),
    transition: isDragging ? undefined : transition,
    zIndex: isDragging ? 20 : 'auto',
    opacity: isDragging ? 0 : 1,
    willChange: isDragging || freezeTransform ? 'auto' : 'transform',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`unit-card ${isSelected ? 'selected' : ''} ${statusClass} ${shouldGlowAsLeader ? 'leader-glow' : ''} ${dropIntent ? 'leader-drop-intent' : ''}`}
      data-unit-id={unit.id}
      onClick={() => onClick(unit)}
      {...attributes}
      {...listeners}
    >
      {/* Smaller attach hitbox (visual only) inside the card */}
      <div className="attach-zone" />
      <div className="drag-handle" title="Drag to reorder">⋮⋮</div>
      <h4>{unit.name}</h4>
    </div>
  );
};
SortableUnitBase.displayName = 'SortableUnit';
const SortableUnit = React.memo(SortableUnitBase);

// Draggable for attached units (to detach/move them)
const AttachedUnitDraggable = ({ unit, isSelected, onClick, statusClass }) => {
  const {attributes, listeners, setNodeRef, transform, isDragging} = useDraggable({ id: unit.id });
  const style = {
    opacity: isDragging ? 0 : 1,
    transform: undefined, // keep in-flow; overlay shows the moving ghost
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`attached-unit unit-card ${isSelected ? 'selected' : ''} ${statusClass}`}
      onClick={() => onClick(unit)}
      {...attributes}
      {...listeners}
    >
      <div className="drag-handle" title="Drag to detach">↳</div>
      <h4>{unit.name}</h4>
    </div>
  );
};

const GameSession = ({ gameId, user }) => {
  const [gameData, setGameData] = useState(null);
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [damageAmount, setDamageAmount] = useState(1);
  const [vpAmount, setVpAmount] = useState(1);
  const [vpReason, setVpReason] = useState('');
  const [draggedUnit, setDraggedUnit] = useState(null);
  const [overId, setOverId] = useState(null);
  const [unitOrder, setUnitOrder] = useState([]);
  const listRef = useRef(null);
  const [attachments, setAttachments] = useState({});
  const [attachIntentLeaderId, setAttachIntentLeaderId] = useState(null);

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

  // Build full units list (snapshot from gameData)
  const allUnits = useMemo(() => {
    if (!gameData) return [];
    const list = [];
    if (gameData.playerArmies) {
      Object.entries(gameData.playerArmies).forEach(([playerId, playerData]) => {
        if (playerData.armyData && playerData.armyData.units) {
          playerData.armyData.units.forEach((unit, index) => {
            list.push({
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
    return list;
  }, [gameData]);

  const allUnitsById = useMemo(() => {
    const map = {};
    allUnits.forEach(u => { map[u.id] = u; });
    return map;
  }, [allUnits]);

  // Top-level ordered units (exclude attached ones)
  const orderedUnits = useMemo(() => {
    const attachedSet = new Set(Object.values(attachments || {}).flat());
    const baseOrderIds = unitOrder.length > 0 ? unitOrder : allUnits.map(u => u.id);
    const topIds = baseOrderIds.filter(id => !attachedSet.has(id));
    return topIds.map(id => allUnitsById[id]).filter(Boolean);
  }, [allUnits, allUnitsById, unitOrder, attachments]);

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

  const unitIsAttachedTo = useMemo(() => {
    const look = {};
    Object.entries(attachments || {}).forEach(([lid, arr]) => {
      (arr || []).forEach(id => { look[id] = lid; });
    });
    return look;
  }, [attachments]);

  const handleDndStart = (event) => {
    const activeId = event.active?.id;
    const unit = allUnitsById[activeId] || null;
    setDraggedUnit(unit);
    setOverId(null);
    setAttachIntentLeaderId(null);
  };

  const handleDndOver = (event) => {
    const { active, over } = event;
    if (!draggedUnit) { setAttachIntentLeaderId(null); return; }

    // Compute cursor/drag center
    const activeRect = active.rect?.current?.translated || active.rect?.current;
    if (!activeRect) { setAttachIntentLeaderId(null); return; }
    const centerX = activeRect.left + activeRect.width / 2;
    const centerY = activeRect.top + activeRect.height / 2;

    // Prefer dnd-kit's over when it's a top-level unit id
    let candidateId = over?.id && itemIds.includes(String(over.id)) ? String(over.id) : null;

    // Fallback: find card under cursor among top-level items
    if (!candidateId) {
      const cards = Array.from(document.querySelectorAll('.units-list .unit-card[data-unit-id]'));
      const hit = cards.find(c => {
        const r = c.getBoundingClientRect();
        return centerX >= r.left && centerX <= r.right && centerY >= r.top && centerY <= r.bottom;
      });
      candidateId = hit?.dataset?.unitId || null;
    }

    if (!candidateId) { setAttachIntentLeaderId(null); return; }
    const candidate = allUnitsById[candidateId];
    if (!candidate || !canLeaderAttachToUnit(candidate, draggedUnit) || candidate.id === draggedUnit.id) {
      setAttachIntentLeaderId(null);
      return;
    }

    // Apply slightly larger inner hitbox for easier attach
    const rect = document.querySelector(`.unit-card[data-unit-id="${candidateId}"]`)?.getBoundingClientRect();
    if (!rect) { setAttachIntentLeaderId(null); return; }
    const innerLeft = rect.left + rect.width * 0.15;
    const innerRight = rect.left + rect.width * 0.85;
    const innerTop = rect.top + rect.height * 0.25;
    const innerBottom = rect.top + rect.height * 0.75;
    const inside = centerX >= innerLeft && centerX <= innerRight && centerY >= innerTop && centerY <= innerBottom;
    const nextIntent = inside ? candidateId : null;
    setAttachIntentLeaderId(nextIntent);
  };

  const handleDndEnd = (event) => {
    const { active, over } = event;
    const activeId = active?.id;
    const overId = over?.id;
    const leaderId = attachIntentLeaderId; // capture before clearing state
    setDraggedUnit(null);
    setOverId(null);
    setAttachIntentLeaderId(null);

    const activeUnit = allUnitsById[activeId];

    // 1) Attach if we had attach intent over a valid leader
    if (leaderId) {
      const leader = allUnitsById[leaderId];
      if (activeUnit && leader && canLeaderAttachToUnit(leader, activeUnit)) {
        setAttachments(prev => {
          const next = { ...prev };
          // Remove from any existing attachments
          Object.keys(next).forEach(lid => {
            next[lid] = (next[lid] || []).filter(id => id !== activeId);
            if (next[lid].length === 0) delete next[lid];
          });
        
          // Add under the leader
          next[leaderId] = Array.from(new Set([...(next[leaderId] || []), activeId]));
          return next;
        });
        // Ensure not in top-level order
        setUnitOrder(prev => prev.filter(id => id !== activeId));
        return;
      }
    }

    // 2) Detach case: dragged from an attachment and dropped over a top-level item
    const wasAttachedLeader = unitIsAttachedTo[activeId];
    if (wasAttachedLeader && overId && itemIds.includes(String(overId))) {
      // Remove from attachments
      setAttachments(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(lid => {
          next[lid] = (next[lid] || []).filter(id => id !== activeId);
          if (next[lid].length === 0) delete next[lid];
        });
        return next;
      });
      // Insert into top order at index of over
      const insertIndex = itemIds.indexOf(String(overId));
      const newTop = itemIds.filter(id => id !== activeId);
      newTop.splice(insertIndex, 0, activeId);
      setUnitOrder(newTop);
      return;
    }

    // 3) Reorder top-level
    if (!overId || activeId === overId) return;
    const oldIndex = itemIds.indexOf(activeId);
    const newIndex = itemIds.indexOf(overId);
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
    if (!leader || !draggedUnit) return false;
    const abilities = leader.abilities || [];
    const keywords = (leader.keywords || []).map(k => String(k).toLowerCase());
    if (keywords.includes('leader') || keywords.includes('character')) return true;
    return abilities.some(ability => {
      const name = (ability.name || '').toLowerCase();
      const text = (ability.description || ability.text || '').toLowerCase();
      if (name.includes('leader') || text.includes('can be attached to') || text.includes('this model can be attached to')) return true;
      return false;
    });
  };

  // Extra heuristic: treat common character names as leaders if no explicit keywords
  const isLikelyLeaderName = (unitName) => {
    const n = (unitName || '').toLowerCase();
    const patterns = [
      'captain','commander','lieutenant','priest','librarian','chaplain','ancient','champion','sergeant',
      'boss','warboss','nob','lord','overlord','autarch','patriarch','broodlord','archon','succubus','haemonculus',
      'daemon prince','prince','farseer','exarch','company master','sanguinary','dante','mephiston','astorath','corbulo'
    ];
    return patterns.some(p => n.includes(p));
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
            onDragOver={handleDndOver}
            onDragEnd={handleDndEnd}
            onDragCancel={() => setDraggedUnit(null)}
          >
            <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
              <div className="units-list" ref={listRef}>
                {orderedUnits.map((unit) => {
                  const shouldGlowAsLeader = draggedUnit && canLeaderAttachToUnit(unit, draggedUnit) && draggedUnit.id !== unit.id;
                  const freezeTransform = !!(attachIntentLeaderId === unit.id);
                  const dropIntent = !!(attachIntentLeaderId === unit.id);
                  return (
                    <React.Fragment key={unit.id}>
                      <SortableUnit
                        unit={unit}
                        isSelected={selectedUnit?.id === unit.id}
                        onClick={setSelectedUnit}
                        statusClass={getUnitStatusClass(unit)}
                        shouldGlowAsLeader={!!shouldGlowAsLeader}
                        freezeTransform={freezeTransform}
                        dropIntent={dropIntent}
                      />
                      {attachments[unit.id] && attachments[unit.id].length > 0 && (
                        <div className="attached-units">
                          {attachments[unit.id].map(attachedId => {
                            const au = allUnitsById[attachedId];
                            if (!au) return null;
                            return (
                              <AttachedUnitDraggable
                                key={attachedId}
                                unit={au}
                                isSelected={selectedUnit?.id === attachedId}
                                onClick={setSelectedUnit}
                                statusClass={getUnitStatusClass(au)}
                              />
                            );
                          })}
                        </div>
                      )}
                    </React.Fragment>
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
