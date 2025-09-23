import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { restrictToVerticalAxis, restrictToFirstScrollableAncestor } from '@dnd-kit/modifiers';
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { updateGameState, subscribeToGame, subscribeToGameUpdates, assignDamage } from '../firebase/database';
// AuthContext will be implemented later
import UnitDatasheet from './UnitDatasheet';
import { hasActiveOverrides as ovHasActive, getOverrideSummary as ovSummary, canAttach } from '../utils/eligibility';

// Sortable unit card powered by dnd-kit
const SortableUnitBase = ({ unit, isSelected, onClick, statusClass, shouldGlowAsLeader, freezeTransform, dropIntent, titleText, insertEdge, pulse, overrideActive, overrideSummary }) => {
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
      className={`unit-card ${isSelected ? 'selected' : ''} ${statusClass} ${dropIntent ? 'leader-drop-intent' : (shouldGlowAsLeader ? 'leader-glow' : '')} ${insertEdge === 'top' ? 'drag-over-before' : ''} ${insertEdge === 'bottom' ? 'drag-over-after' : ''} ${pulse ? 'leader-pulse' : ''}`}
      data-unit-id={unit.id}
      title={titleText || undefined}
      onClick={() => onClick(unit)}
    >
      {/* Between-slot overlays for top-level insert targeting */}
      <div className="between-slot top" aria-hidden="true" data-target-id={unit.id} data-edge="top" data-scope="top"></div>
      <div className="between-slot bottom" aria-hidden="true" data-target-id={unit.id} data-edge="bottom" data-scope="top"></div>
      {/* Optional meta row: only when overrides exist, to avoid dead gap */}
      {overrideActive ? (
        <div className="card-meta">
          <span className="override-pill" tabIndex={0} aria-label={overrideSummary} title={overrideSummary}>Overridden</span>
        </div>
      ) : null}
      {/* Drag handle (absolute) with keyboard focus */}
      <div className="drag-handle" role="button" tabIndex={0} aria-label="Drag to reorder" title="Drag to reorder" {...attributes} {...listeners}>⋮⋮</div>
      {/* Smaller attach hitbox (visual only) inside the card */}
      <div className="attach-zone" />
      <h4>{unit.name}</h4>
    </div>
  );
};
SortableUnitBase.displayName = 'SortableUnit';
const SortableUnit = React.memo(SortableUnitBase);

// Sortable for attached units (to reorder within a leader or detach)
const AttachedUnitSortable = ({ unit, isSelected, onClick, statusClass, insertEdge, onDetach, leaderName, leaderId, overrideActive, overrideSummary }) => {
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} = useSortable({ id: unit.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : 'auto',
  };
  const handleKey = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onDetach?.();
    }
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`attached-unit unit-card ${isSelected ? 'selected' : ''} ${statusClass} ${insertEdge === 'top' ? 'drag-over-before' : ''} ${insertEdge === 'bottom' ? 'drag-over-after' : ''}`}
      onClick={() => onClick(unit)}
    >
      {/* Between-slot overlays for child insert targeting */}
      <div className="between-slot top" aria-hidden="true" data-target-id={unit.id} data-edge="top" data-scope="children" data-leader-id={leaderId}></div>
      <div className="between-slot bottom" aria-hidden="true" data-target-id={unit.id} data-edge="bottom" data-scope="children" data-leader-id={leaderId}></div>
      {/* Optional meta row: only when overrides exist */}
      {overrideActive ? (
        <div className="card-meta">
          <span className="override-pill" tabIndex={0} aria-label={overrideSummary} title={overrideSummary}>Overridden</span>
        </div>
      ) : null}
      {/* Drag handle (absolute) with keyboard focus */}
      <div className="drag-handle" role="button" tabIndex={0} aria-label="Drag to reorder" title="Drag to reorder" {...attributes} {...listeners}>⋮⋮</div>
      <button
        type="button"
        className="detach-btn"
        aria-label={`Detach from ${leaderName || 'leader'}`}
        title={`Detach from ${leaderName || 'leader'}`}
        onClick={(e) => { e.stopPropagation(); onDetach?.(); }}
        onKeyDown={handleKey}
      >
        ×
      </button>
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
  const [, setOverId] = useState(null);
  const [unitOrder, setUnitOrder] = useState([]);
  const [overlayInBounds, setOverlayInBounds] = useState(true);
  const listRef = useRef(null);
  const [attachments, setAttachments] = useState({});
  const [attachIntentLeaderId, setAttachIntentLeaderId] = useState(null);
  const [hoveredLeaderId, setHoveredLeaderId] = useState(null);
  const [insertGuide, setInsertGuide] = useState({ id: null, edge: null, scope: 'top', leaderId: null });
  const [pulseLeaderId, setPulseLeaderId] = useState(null);
  const [leadershipOverrides, setLeadershipOverrides] = useState({});
  const pointerRef = useRef({ x: 0, y: 0, has: false });
  const scrollRafRef = useRef(null);
  const draggingRef = useRef(false);
  const lastGuideRef = useRef({ id: null, edge: null, scope: 'top', leaderId: null, ts: 0 });
  const lastGuideRef = useRef({ id: null, edge: null, ts: 0 });

  // Cleanup drag-related UI and listeners
  const cleanupDragState = () => {
    setDraggedUnit(null);
    setOverId(null);
    setAttachIntentLeaderId(null);
    setHoveredLeaderId(null);
    setInsertGuide({ id: null, edge: null, scope: 'top', leaderId: null });
    draggingRef.current = false;
    if (pointerRef.current._onMove) {
      window.removeEventListener('pointermove', pointerRef.current._onMove);
      pointerRef.current._onMove = null;
    }
    if (scrollRafRef.current) {
      cancelAnimationFrame(scrollRafRef.current);
      scrollRafRef.current = null;
    }
  };

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

  // Reverse lookup: childId -> leaderId for quick checks
  const unitIsAttachedTo = useMemo(() => {
    const map = {};
    Object.entries(attachments || {}).forEach(([leaderId, childArr]) => {
      (childArr || []).forEach((cid) => { map[cid] = leaderId; });
    });
    return map;
  }, [attachments]);

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

  // Map child id -> leader id
  const unitIsAttachedTo = useMemo(() => {
    const map = {};
    Object.entries(attachments || {}).forEach(([lid, arr]) => {
      (arr || []).forEach((cid) => { map[cid] = lid; });
    });
    return map;
  }, [attachments]);

  // Map of unitId -> leaderId (if attached). Currently not needed here but can be re-enabled if required.

  const handleDndStart = (event) => {
    const activeId = event.active?.id;
    const unit = allUnitsById[activeId] || null;
    setDraggedUnit(unit);
    setOverId(null);
    setAttachIntentLeaderId(null);
    setHoveredLeaderId(null);
    setInsertGuide({ id: null, edge: null, scope: 'top', leaderId: null });
    setOverlayInBounds(true);

    // Begin pointer tracking & autoscroll
    draggingRef.current = true;
    pointerRef.current.has = true;
    const onMove = (e) => {
      pointerRef.current.x = e.clientX;
      pointerRef.current.y = e.clientY;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    // store handler for removal
    pointerRef.current._onMove = onMove;

    const autoScrollTick = () => {
      if (!draggingRef.current) return;
      const listEl = listRef.current;
      if (listEl && pointerRef.current.has) {
        const rect = listEl.getBoundingClientRect();
        const y = pointerRef.current.y;
        const zone = 48; // px from edges to start autoscroll
        let dy = 0;
        if (y < rect.top + zone) {
          const intensity = (zone - (y - rect.top)) / zone; // 0..1
          dy = -Math.ceil(12 * intensity);
        } else if (y > rect.bottom - zone) {
          const intensity = (zone - (rect.bottom - y)) / zone;
          dy = Math.ceil(12 * intensity);
        }
        if (dy !== 0) listEl.scrollTop += dy;
      }
      scrollRafRef.current = requestAnimationFrame(autoScrollTick);
    };
    scrollRafRef.current = requestAnimationFrame(autoScrollTick);
  };

  const handleDndOver = (event) => {
    const { active, over } = event;
    if (!draggedUnit) { setAttachIntentLeaderId(null); return; }

    // Pointer-driven detection first: between-slot hit
    const EDGE_PX = 14;
    const px = pointerRef.current.has ? pointerRef.current.x : (active.rect?.current?.translated?.left || 0) + (active.rect?.current?.translated?.width || 0)/2;
    const py = pointerRef.current.has ? pointerRef.current.y : (active.rect?.current?.translated?.top || 0) + (active.rect?.current?.translated?.height || 0)/2;

    // Containment: if pointer exits the list container, keep last intent and hide overlay
    const listEl = listRef.current;
    const containerEl = listEl ? (listEl.closest('.units-sidebar') || listEl) : null;
    if (containerEl) {
      const rect = containerEl.getBoundingClientRect();
      const inside = px >= rect.left && px <= rect.right && py >= rect.top && py <= rect.bottom;
      if (!inside) {
        setOverlayInBounds(false);
        return; // keep last valid state; do not recompute intent outside
      }
      if (!overlayInBounds) setOverlayInBounds(true);
    }
    const el = document.elementFromPoint(px, py);
    const gap = el?.closest('.between-slot');
    if (gap) {
      const targetId = gap.getAttribute('data-target-id');
      const edge = gap.getAttribute('data-edge'); // 'top' | 'bottom'
      const scope = gap.getAttribute('data-scope') || 'top';
      const leaderId = gap.getAttribute('data-leader-id');
      const newGuide = { id: targetId, edge, scope, leaderId: leaderId || null };
      // Hysteresis: avoid flicker when rapidly crossing midlines
      const prev = lastGuideRef.current;
      const now = Date.now();
      const sameAnchor = prev.id === newGuide.id && prev.scope === newGuide.scope && prev.leaderId === newGuide.leaderId;
      if (!sameAnchor || prev.edge !== newGuide.edge || (now - prev.ts) > 100) {
        setInsertGuide(newGuide);
        lastGuideRef.current = { ...newGuide, ts: now };
      }
      // Clear attach intent when hovering a gap
      setAttachIntentLeaderId(null);
      // Freeze leader while its edge is hovered
      const anchorUnit = allUnitsById[targetId];
      if (anchorUnit && isLeaderUnit(anchorUnit)) setHoveredLeaderId(targetId); else setHoveredLeaderId(null);
      return;
    }

    // Next: hover over a card body (center/edges)
    const card = el?.closest('.unit-card[data-unit-id]');
    const candidateId = card?.getAttribute('data-unit-id') || null;
    if (candidateId && candidateId !== String(active.id)) {
      const candidate = allUnitsById[candidateId];
      const r = card.getBoundingClientRect();
      const inTopEdge = py <= r.top + EDGE_PX;
      const inBottomEdge = py >= r.bottom - EDGE_PX;
      const inEdges = inTopEdge || inBottomEdge;
      if (isLeaderUnit(candidate)) {
        setHoveredLeaderId(candidateId);
        const eligible = !isLeaderUnit(draggedUnit) && canLeaderAttachToUnit(candidate, draggedUnit);
        setAttachIntentLeaderId(inEdges || !eligible ? null : candidateId);
        setInsertGuide(inEdges ? { id: candidateId, edge: inTopEdge ? 'top' : 'bottom', scope: 'top', leaderId: null } : { id: null, edge: null, scope: 'top', leaderId: null });
      } else {
        const parentLeaderId = unitIsAttachedTo[candidateId] || null;
        if (parentLeaderId) {
          // Reorder within same leader's children if applicable
          if (unitIsAttachedTo[active.id] === parentLeaderId) {
            const edge = inTopEdge ? 'top' : (inBottomEdge ? 'bottom' : (py < (r.top + r.bottom) / 2 ? 'top' : 'bottom'));
            const newGuide = { id: candidateId, edge, scope: 'children', leaderId: parentLeaderId };
            const prev = lastGuideRef.current;
            const now = Date.now();
            const sameAnchor = prev.id === newGuide.id && prev.scope === newGuide.scope && prev.leaderId === newGuide.leaderId;
            if (!sameAnchor || prev.edge !== newGuide.edge || (now - prev.ts) > 100) {
              setInsertGuide(newGuide);
              lastGuideRef.current = { ...newGuide, ts: now };
            }
            setHoveredLeaderId(parentLeaderId);
            setAttachIntentLeaderId(null);
          } else {
            // Different leader's child; allow only top-level gaps
            setHoveredLeaderId(null);
            setAttachIntentLeaderId(null);
            setInsertGuide({ id: null, edge: null, scope: 'top', leaderId: null });
          }
        } else {
          // Normal top-level card
          const edge = inTopEdge ? 'top' : (inBottomEdge ? 'bottom' : (py < (r.top + r.bottom) / 2 ? 'top' : 'bottom'));
          const newGuide = { id: candidateId, edge, scope: 'top', leaderId: null };
          const prev = lastGuideRef.current; const now = Date.now();
          const sameAnchor = prev.id === newGuide.id && prev.scope === newGuide.scope;
          if (!sameAnchor || prev.edge !== newGuide.edge || (now - prev.ts) > 100) {
            setInsertGuide(newGuide);
            lastGuideRef.current = { ...newGuide, ts: now };
          }
          setHoveredLeaderId(null);
          setAttachIntentLeaderId(null);
        }
      }
    } else {
      setHoveredLeaderId(null);
      setAttachIntentLeaderId(null);
      setInsertGuide({ id: null, edge: null, scope: 'top', leaderId: null });
    }
  };

  const handleDndEnd = (event) => {
    const { active, over } = event;
    const activeId = active?.id;
    const overItemId = over?.id;
    const leaderHoverId = attachIntentLeaderId; // capture before clearing – center attach intent only
    const guide = insertGuide; // capture insert guide before clearing
    // Clear hover state & stop tracking
    cleanupDragState();

    // If overlay/pointer was out of bounds, snap back (no move)
    if (!overlayInBounds) {
      return;
    }

    const activeUnit = allUnitsById[activeId];
    // If attach intent was active and valid, perform attach and persist
    if (leaderHoverId && activeUnit && !isLeaderUnit(activeUnit)) {
      const leader = allUnitsById[leaderHoverId];
      if (leader && canLeaderAttachToUnit(leader, activeUnit)) {
        const next = (() => {
          const next = { ...(attachments || {}) };
          // remove from all leaders first
          Object.keys(next).forEach(lid => {
            next[lid] = (next[lid] || []).filter(id => id !== activeId);
            if (next[lid].length === 0) delete next[lid];
          });
          // add to this leader if not already present
          const arr = next[leaderHoverId] || [];
          if (arr.includes(activeId)) {
            // reorder within children: move to end
            next[leaderHoverId] = arr.filter(id => id !== activeId).concat(activeId);
          } else {
            arr.push(activeId);
            next[leaderHoverId] = arr;
          }
          return next;
        })();
        // Compute new top-level order (remove attached child if present)
        const newTop = itemIds.filter(id => id !== activeId);
        setAttachments(next);
        setUnitOrder(newTop);
        // persist to Firebase
        updateGameState(gameId, { 'gameState.attachments': next, 'gameState.unitOrder': newTop }).catch(err => console.error('persist attach failed', err));
        setPulseLeaderId(leaderHoverId);
        setTimeout(() => setPulseLeaderId(null), 500);
        return;
      }
    }

    // Reorder using insert guide (respects before/after)
    if (guide.id) {
      if (guide.scope === 'top') {
        const wasAttached = !!unitIsAttachedTo[activeId];
        let next = attachments;
        if (wasAttached) {
          // detach from previous leader
          next = { ...(attachments || {}) };
          Object.keys(next).forEach(lid => {
            next[lid] = (next[lid] || []).filter(id => id !== activeId);
            if (next[lid].length === 0) delete next[lid];
          });
          setAttachments(next);
        }
        const newTop = itemIds.filter(id => id !== activeId);
        const anchorIndex = newTop.indexOf(guide.id);
        if (anchorIndex !== -1) {
          const insertAt = guide.edge === 'bottom' ? anchorIndex + 1 : anchorIndex;
          newTop.splice(insertAt, 0, activeId);
          setUnitOrder(newTop);
          // persist
          const update = { 'gameState.unitOrder': newTop };
          if (wasAttached) update['gameState.attachments'] = next;
          updateGameState(gameId, update).catch(err => console.error('persist reorder failed', err));
          return;
        }
      } else if (guide.scope === 'children' && guide.leaderId && unitIsAttachedTo[activeId] === guide.leaderId) {
        // reorder inside leader's children
        const arr = Array.from(attachments[guide.leaderId] || []);
        const fromIdx = arr.indexOf(activeId);
        const anchorIdx = arr.indexOf(guide.id);
        if (fromIdx !== -1 && anchorIdx !== -1) {
          const without = arr.filter(id => id !== activeId);
          const insertAt = guide.edge === 'bottom' ? (anchorIdx + (fromIdx < anchorIdx ? 0 : 1)) : (anchorIdx + (fromIdx < anchorIdx ? -1 : 0));
          const bounded = Math.max(0, Math.min(without.length, insertAt));
          without.splice(bounded, 0, activeId);
          const next = { ...(attachments || {}) };
          next[guide.leaderId] = without;
          setAttachments(next);
          updateGameState(gameId, { 'gameState.attachments': next }).catch(err => console.error('persist child-reorder failed', err));
          return;
        }
      }
    }

    // Fallback: reorder by over id
    if (!overItemId || activeId === overItemId) return;
    const oldIndex = itemIds.indexOf(activeId);
    const newIndex = itemIds.indexOf(overItemId);
    if (oldIndex === -1 || newIndex === -1) return;
    const newTopOrder = arrayMove(itemIds, oldIndex, newIndex);
    setUnitOrder(newTopOrder);
    updateGameState(gameId, { 'gameState.unitOrder': newTopOrder }).catch(err => console.error('persist reorder failed', err));
  };

  // Sync attachments from backend
  useEffect(() => {
    const backend = gameData?.gameState?.attachments || {};
    setAttachments(backend);
  }, [gameData?.gameState?.attachments]);

  // Sync unit order from backend
  useEffect(() => {
    const backendOrder = gameData?.gameState?.unitOrder;
    if (Array.isArray(backendOrder) && backendOrder.length) {
      setUnitOrder(backendOrder);
    }
  }, [gameData?.gameState?.unitOrder]);

  // Sync leadership overrides from backend
  useEffect(() => {
    const backend = gameData?.gameState?.leadershipOverrides || {};
    setLeadershipOverrides(backend);
  }, [gameData?.gameState?.leadershipOverrides]);

  // Detach helper for detach button
  const detachUnit = (leaderId, childId) => {
    setAttachments(prev => {
      const next = { ...(prev || {}) };
      if (next[leaderId]) {
        next[leaderId] = (next[leaderId] || []).filter(id => id !== childId);
        if (next[leaderId].length === 0) delete next[leaderId];
      }
      // Insert the child below the leader in the top-level order
      const top = itemIds.slice();
      const leaderIdx = top.indexOf(leaderId);
      const insertAt = leaderIdx >= 0 ? leaderIdx + 1 : top.length;
      // ensure child not present (it won't be in top yet)
      const newTop = top.filter(id => id !== childId);
      newTop.splice(insertAt, 0, childId);
      setUnitOrder(newTop);
      updateGameState(gameId, { 'gameState.attachments': next, 'gameState.unitOrder': newTop }).catch(err => console.error('persist detach failed', err));
      return next;
    });
  };

  // Update overrides for a unit and persist
  const updateUnitOverrides = (unitId, partial) => {
    setLeadershipOverrides(prev => {
      const next = { ...(prev || {}) };
      const current = next[unitId] || { canLead: 'auto', canBeLed: 'auto', allowList: [] };
      const merged = {
        ...current,
        ...partial,
        allowList: partial.allowList !== undefined ? Array.from(new Set(partial.allowList)) : current.allowList,
      };
      next[unitId] = merged;
      updateGameState(gameId, { 'gameState.leadershipOverrides': next }).catch(err => console.error('persist overrides failed', err));
      return next;
    });
  };

  // Helper functions for new unit status system
  const getUnitStatusClass = (unit) => {
    if (unit.currentWounds === 0) return 'dead';
    if (unit.hasActed) return 'done'; // Assuming we'll add this field
    return 'ready';
  };

  //

  // Quick leader check for visuals (orange glow)
  const isLeaderUnit = (unit) => {
    if (!unit) return false;
    const ov = leadershipOverrides[unit.id];
    if (ov?.canLead === 'yes') return true;
    if (ov?.canLead === 'no') return false;
    const keywords = (unit.keywords || []).map(k => String(k).toLowerCase());
    const rules = (unit.rules || []).map(r => String(r).toLowerCase());
    const abilities = unit.abilities || [];
    const name = String(unit.name || '').toLowerCase();

    const hasLeaderKeyword = keywords.includes('leader');
    const hasCharacterKeyword = keywords.includes('character');
    const hasLeaderRule = rules.some(r => r.includes('leader'));
    const hasLeaderAbility = abilities.some(a => String(a.name || '').toLowerCase().includes('leader'));
    const hasAttachText = abilities.some(a => String(a.description || a.text || '').toLowerCase().includes('this model can be attached to'));

    const commonLeaderNames = ['captain','commander','lieutenant','librarian','chaplain','ancient','champion','sanguinary','priest','company master','apothecary','judiciar'];
    const isCommonLeaderName = commonLeaderNames.some(n => name.includes(n));

    return hasLeaderKeyword || hasCharacterKeyword || hasLeaderRule || hasLeaderAbility || hasAttachText || isCommonLeaderName;
  };

  // Baseline source-data check (strict, from abilities text)
  const sourceCanAttach = (leader, draggedUnit) => {
    if (!leader || !draggedUnit) return false;
    // Must actually have a Leader ability
    const abilities = leader.abilities || [];
    const hasLeaderAbility = abilities.some(a => String(a.name || '').toLowerCase().includes('leader'));
    if (!hasLeaderAbility) return false;

    const normalize = (s) => String(s || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const unitFull = normalize(draggedUnit.name);
    // Try without trailing "with ..." qualifiers for broader matching
    const unitBase = normalize(draggedUnit.name.replace(/\bwith\b.*$/, ''));

    // Look for explicit attach permission mentioning the target unit
    return abilities.some(ability => {
      const name = normalize(ability.name);
      const text = normalize(ability.description || ability.text);
      if (!(name.includes('leader') || text.includes('this model can be attached to') || text.includes('can be attached to'))) {
        return false;
      }
      // Must reference the unit by name (full or base)
      return text.includes(unitFull) || text.includes(unitBase);
    });
  };

  // Centralized eligibility helpers are imported from ../utils/eligibility
  const canLeaderAttachToUnit = (leader, draggedUnit) => {
    return canAttach(leader, draggedUnit, leadershipOverrides, sourceCanAttach);
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
            modifiers={[restrictToVerticalAxis, restrictToFirstScrollableAncestor]}
            onDragStart={handleDndStart}
            onDragOver={handleDndOver}
            onDragEnd={handleDndEnd}
            onDragCancel={cleanupDragState}
          >
            <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
              <div className="units-list" ref={listRef}>
                {orderedUnits.map((unit, idx) => {
                  const shouldGlowAsLeader = !!draggedUnit && isLeaderUnit(unit) && draggedUnit.id !== unit.id && canLeaderAttachToUnit(unit, draggedUnit);
                  const freezeTransform = !!(hoveredLeaderId === unit.id || attachIntentLeaderId === unit.id);
                  const dropIntent = !!(attachIntentLeaderId === unit.id);
                  const insertEdge = insertGuide.id === unit.id ? insertGuide.edge : null;
                  const titleText = dropIntent
                    ? `Attach to ${unit.name}`
                    : (insertEdge ? 'Drop to reorder' : undefined);
                  const ov = leadershipOverrides[unit.id] || {};
                  const overrideActive = ovHasActive(ov);
                  const overrideSummary = ovSummary(ov, (id) => allUnitsById[id]?.name || id);
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
                        insertEdge={insertEdge}
                        titleText={titleText}
                        pulse={pulseLeaderId === unit.id}
                        overrideActive={overrideActive}
                        overrideSummary={overrideSummary}
                      />
                      {attachments[unit.id] && attachments[unit.id].length > 0 && (
                        <div className="attached-units">
                          <SortableContext items={attachments[unit.id]} strategy={verticalListSortingStrategy}>
                            {attachments[unit.id].map((attachedId) => {
                              const au = allUnitsById[attachedId];
                              if (!au) return null;
                              const childInsert = insertGuide.scope === 'children' && insertGuide.id === attachedId ? insertGuide.edge : null;
                              const childOv = leadershipOverrides[attachedId] || {};
                              const childOverrideActive = ovHasActive(childOv);
                              const childOverrideSummary = ovSummary(childOv, (id) => allUnitsById[id]?.name || id);
                              return (
                                <React.Fragment key={attachedId}>
                                  <AttachedUnitSortable
                                    unit={au}
                                    isSelected={selectedUnit?.id === attachedId}
                                    onClick={setSelectedUnit}
                                    statusClass={getUnitStatusClass(au)}
                                    insertEdge={childInsert}
                                    leaderName={unit.name}
                                    leaderId={unit.id}
                                    onDetach={() => detachUnit(unit.id, attachedId)}
                                    overrideActive={childOverrideActive}
                                    overrideSummary={childOverrideSummary}
                                  />
                                </React.Fragment>
                              );
                            })}
                          </SortableContext>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </SortableContext>
            <DragOverlay adjustScale={false} dropAnimation={null}>
              {draggedUnit && overlayInBounds ? (
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
              overrides={leadershipOverrides[selectedUnit.id] || { canLead: 'auto', canBeLed: 'auto', allowList: [] }}
              allUnits={allUnits}
              onUpdateOverrides={(partial) => updateUnitOverrides(selectedUnit.id, partial)}
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
