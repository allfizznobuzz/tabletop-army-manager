import React, { useState, useMemo, useRef } from "react";
import { DndContext, closestCenter, DragOverlay } from "@dnd-kit/core";
import {
  restrictToVerticalAxis,
  restrictToFirstScrollableAncestor,
} from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { updateGameState } from "../../firebase/database";
import {
  hasActiveOverrides as ovHasActive,
  getOverrideSummary as ovSummary,
} from "utils/eligibility";
import SortableUnit from "./UnitCard";
import AttachedUnit from "./AttachedUnit";

const ArmyColumn = ({
  columnKey,
  title,
  units,
  attachments,
  setAttachments,
  unitOrder,
  setUnitOrder,
  leadershipOverrides,
  allUnitsById,
  selectedUnit,
  setSelectedUnit,
  updateUnitOverrides,
  getUnitStatusClass,
  isLeaderUnit,
  canLeaderAttachToUnit,
  gameId,
  sensors,
  draggedUnit,
  setDraggedUnit,
  pinUnit,
  pinnedUnitId,
  pointerRef,
  scrollRafRef,
  draggingRef,
  attackHelper,
  setAttackHelper,
  pulseTargetId,
  setPulseTargetId,
}) => {
  const [overlayInBounds, setOverlayInBounds] = useState(true);
  const [dndIntent, setDndIntent] = useState({ type: "none" });
  const [hoveredLeaderId, setHoveredLeaderId] = useState(null);
  const [attachFreezeId, setAttachFreezeId] = useState(null);
  const listRef = useRef(null);
  const lastGuideRef = useRef({
    id: null,
    edge: null,
    scope: "top",
    leaderId: null,
    ts: 0,
  });

  const allIds = useMemo(() => units.map((u) => u.id), [units]);
  const orderedUnits = useMemo(() => {
    const attachedSet = new Set(Object.values(attachments || {}).flat());
    const base = unitOrder && unitOrder.length > 0 ? unitOrder : allIds;
    const topIds = base.filter((id) => !attachedSet.has(id));
    return topIds.map((id) => allUnitsById[id]).filter(Boolean);
  }, [allIds, attachments, unitOrder, allUnitsById]);

  // Initialize unit order if not set
  React.useEffect(() => {
    if ((unitOrder || []).length === 0 && orderedUnits.length > 0) {
      setUnitOrder(orderedUnits.map((u) => u.id));
    }
  }, [unitOrder, orderedUnits, setUnitOrder]);

  const itemIds = useMemo(() => orderedUnits.map((u) => u.id), [orderedUnits]);

  const cleanupDragState = () => {
    setDraggedUnit(null);
    setHoveredLeaderId(null);
    setDndIntent({ type: "none" });
    setAttachFreezeId(null);
    draggingRef.current = false;
    if (pointerRef.current._onMove) {
      window.removeEventListener("pointermove", pointerRef.current._onMove);
      pointerRef.current._onMove = null;
    }
    if (scrollRafRef.current) {
      cancelAnimationFrame(scrollRafRef.current);
      scrollRafRef.current = null;
    }
  };

  const handleDndStart = (event) => {
    const activeId = event.active?.id;
    const unit = allUnitsById[activeId] || null;
    setDraggedUnit(unit);
    setHoveredLeaderId(null);
    setDndIntent({ type: "none" });
    setAttachFreezeId(null);
    setOverlayInBounds(true);

    // Begin pointer tracking & autoscroll
    draggingRef.current = true;
    pointerRef.current.has = true;
    const onMove = (e) => {
      const px = pointerRef.current.has
        ? pointerRef.current.x
        : (event.active.rect?.current?.translated?.left || 0) +
          (event.active.rect?.current?.translated?.width || 0) / 2;
      const py = pointerRef.current.has
        ? pointerRef.current.y
        : (event.active.rect?.current?.translated?.top || 0) +
          (event.active.rect?.current?.translated?.height || 0) / 2;
      pointerRef.current.x = e.clientX;
      pointerRef.current.y = e.clientY;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    pointerRef.current._onMove = onMove;

    // No special overlay measurement; keep default behavior
    const autoScrollTick = () => {
      if (!draggingRef.current) return;
      const listEl = listRef.current;
      const scrollerEl = listEl
        ? listEl.closest(".units-scroll") || listEl
        : null;
      if (scrollerEl && pointerRef.current.has) {
        const rect = scrollerEl.getBoundingClientRect();
        const y = pointerRef.current.y;
        const zone = 48;
        let dy = 0;
        if (y < rect.top + zone) {
          const intensity = (zone - (y - rect.top)) / zone;
          dy = -Math.ceil(12 * intensity);
        } else if (y > rect.bottom - zone) {
          const intensity = (zone - (rect.bottom - y)) / zone;
          dy = Math.ceil(12 * intensity);
        }
        if (dy !== 0) scrollerEl.scrollTop += dy;
      }
      scrollRafRef.current = requestAnimationFrame(autoScrollTick);
    };
    scrollRafRef.current = requestAnimationFrame(autoScrollTick);
  };

  const handleDndOver = () => {
    setHoveredLeaderId(null);
    setAttachFreezeId(null);
    setDndIntent({ type: "none" });
  };

  const handleDndEnd = (event) => {
    const { active, over } = event;
    const activeId = active?.id;
    const overItemId = over?.id;
    cleanupDragState();
    if (!overlayInBounds) return;
    if (!overItemId || activeId === overItemId) return;

    // Determine parent leaders (if any) of active and over items
    const findParentLeader = (id) =>
      Object.entries(attachments || {}).find(([, arr]) =>
        (arr || []).includes(id),
      )?.[0] || null;
    const parentA = findParentLeader(activeId);
    const parentB = findParentLeader(overItemId);

    // Reorder within the same leader's children list
    if (parentA && parentA === parentB) {
      const arr = Array.from(attachments[parentA] || []);
      const fromIdx = arr.indexOf(activeId);
      const toIdx = arr.indexOf(overItemId);
      if (fromIdx !== -1 && toIdx !== -1) {
        const without = arr.filter((id) => id !== activeId);
        without.splice(toIdx, 0, activeId);
        const next = { ...(attachments || {}) };
        next[parentA] = without;
        setAttachments(next);
        updateGameState(gameId, {
          [`gameState.columns.${columnKey}.attachments`]: next,
        }).catch((err) => console.error("persist child-reorder failed", err));
      }
      return;
    }

    // Reorder among top-level items only
    const topActive = itemIds.includes(activeId);
    const topOver = itemIds.includes(overItemId);
    if (topActive && topOver) {
      const oldIndex = itemIds.indexOf(activeId);
      const newIndex = itemIds.indexOf(overItemId);
      if (oldIndex !== -1 && newIndex !== -1) {
        const newTopOrder = arrayMove(itemIds, oldIndex, newIndex);
        setUnitOrder(newTopOrder);
        updateGameState(gameId, {
          [`gameState.columns.${columnKey}.unitOrder`]: newTopOrder,
        }).catch((err) => console.error("persist reorder failed", err));
      }
    }
  };

  const detachUnit = (leaderId, childId) => {
    setAttachments((prev) => {
      const next = { ...(prev || {}) };
      if (next[leaderId]) {
        next[leaderId] = (next[leaderId] || []).filter((id) => id !== childId);
        if (next[leaderId].length === 0) delete next[leaderId];
      }
      const top = itemIds.slice();
      const leaderIdx = top.indexOf(leaderId);
      const insertAt = leaderIdx >= 0 ? leaderIdx + 1 : top.length;
      const newTop = top.filter((id) => id !== childId);
      newTop.splice(insertAt, 0, childId);
      setUnitOrder(newTop);
      updateGameState(gameId, {
        [`gameState.columns.${columnKey}.attachments`]: next,
        [`gameState.columns.${columnKey}.unitOrder`]: newTop,
      }).catch((err) => console.error("persist detach failed", err));
      return next;
    });
  };

  return (
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
          {orderedUnits.map((unit) => {
            const isDropIntent =
              dndIntent.type === "attach" && dndIntent.groupId === unit.id;
            const draggedIsLeader = !!draggedUnit && isLeaderUnit(draggedUnit);
            const unitIsLeader = isLeaderUnit(unit);
            // Show glow for ALL eligible targets during drag
            const eligibleForGlow =
              !!draggedUnit &&
              (draggedIsLeader
                ? canLeaderAttachToUnit(draggedUnit, unit)
                : canLeaderAttachToUnit(unit, draggedUnit));
            const shouldGlowAsLeader =
              !!draggedUnit &&
              (eligibleForGlow || hoveredLeaderId === unit.id || isDropIntent);
            const freezeTransform = !!(
              // Deep-center freeze only to avoid clipping and big capture window
              (
                attachFreezeId === unit.id ||
                // Only freeze when this unit is the explicit insert anchor
                (dndIntent.type === "insert" &&
                  dndIntent.scope === "top" &&
                  dndIntent.id === unit.id)
              )
            );
            const dropIntent = !!(
              dndIntent.type === "attach" && dndIntent.groupId === unit.id
            );
            const insertEdge =
              dndIntent.type === "insert" &&
              dndIntent.scope === "top" &&
              dndIntent.id === unit.id
                ? dndIntent.edge
                : null;
            const titleText = dropIntent
              ? `Attach to ${unit.name}`
              : insertEdge
                ? "Drop to reorder"
                : undefined;
            const ov = leadershipOverrides[unit.id] || {};
            const overrideActive = ovHasActive(ov);
            const overrideSummary = ovSummary(
              ov,
              (id) => allUnitsById[id]?.name || id,
            );
            return (
              <React.Fragment key={unit.id}>
                <SortableUnit
                  unit={unit}
                  isSelected={pinnedUnitId === unit.id}
                  isLeader={unitIsLeader}
                  onClick={(u) => {
                    const sameColumn =
                      selectedUnit && selectedUnit.column === u.column;
                    if (attackHelper?.open && !sameColumn) {
                      pinUnit?.(u);
                      setAttackHelper((prev) => ({
                        ...prev,
                        open: true,
                        targetUnitId: u.id,
                        intent: prev.intent,
                      }));
                      return;
                    }
                    pinUnit?.(u);
                    setSelectedUnit(u);
                    setAttackHelper((prev) => {
                      const prevTarget = prev.targetUnitId
                        ? allUnitsById[prev.targetUnitId]
                        : null;
                      const keepTarget =
                        prevTarget && prevTarget.column !== u.column
                          ? prev.targetUnitId
                          : null;
                      return {
                        ...prev,
                        open: false,
                        section: null,
                        index: null,
                        modelsInRange: null,
                        targetUnitId: keepTarget,
                        attackerUnitId: null,
                        intent: "idle",
                        showExpected: prev.showExpected,
                      };
                    });
                  }}
                  statusClass={getUnitStatusClass(unit)}
                  pulse={pulseTargetId === unit.id}
                  overrideActive={overrideActive}
                  overrideSummary={overrideSummary}
                />
                {attachments[unit.id] && attachments[unit.id].length > 0 && (
                  <div className="attached-units">
                    <SortableContext
                      items={attachments[unit.id]}
                      strategy={verticalListSortingStrategy}
                    >
                      {attachments[unit.id].map((attachedId) => {
                        const au = allUnitsById[attachedId];
                        if (!au) return null;
                        const childInsert =
                          dndIntent.type === "insert" &&
                          dndIntent.scope === "children" &&
                          dndIntent.id === attachedId
                            ? dndIntent.edge
                            : null;
                        const childOv = leadershipOverrides[attachedId] || {};
                        const childOverrideActive = ovHasActive(childOv);
                        const childOverrideSummary = ovSummary(
                          childOv,
                          (id) => allUnitsById[id]?.name || id,
                        );
                        return (
                          <React.Fragment key={attachedId}>
                            <AttachedUnit
                              unit={au}
                              isSelected={pinnedUnitId === attachedId}
                              onClick={(u) => {
                                const sameColumn =
                                  selectedUnit &&
                                  selectedUnit.column === u.column;
                                if (attackHelper?.open && !sameColumn) {
                                  pinUnit?.(u);
                                  setAttackHelper((prev) => ({
                                    ...prev,
                                    open: true,
                                    targetUnitId: u.id,
                                    intent: prev.intent,
                                  }));
                                  return;
                                }
                                pinUnit?.(u);
                                setSelectedUnit(u);
                                setAttackHelper((prev) => {
                                  const prevTarget = prev.targetUnitId
                                    ? allUnitsById[prev.targetUnitId]
                                    : null;
                                  const keepTarget =
                                    prevTarget && prevTarget.column !== u.column
                                      ? prev.targetUnitId
                                      : null;
                                  return {
                                    ...prev,
                                    open: false,
                                    section: null,
                                    index: null,
                                    modelsInRange: null,
                                    targetUnitId: keepTarget,
                                    attackerUnitId: null,
                                    intent: "idle",
                                    showExpected: prev.showExpected,
                                  };
                                });
                              }}
                              statusClass={getUnitStatusClass(au)}
                              leaderName={unit.name}
                              leaderId={unit.id}
                              onDetach={() => detachUnit(unit.id, attachedId)}
                              overrideActive={childOverrideActive}
                              overrideSummary={childOverrideSummary}
                              pulse={pulseTargetId === attachedId}
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
          <div
            className={`unit-card dragging ${getUnitStatusClass(draggedUnit)} ${
              selectedUnit?.id === draggedUnit.id ? "selected" : ""
            }`}
            style={{
              pointerEvents: "none",
              cursor: "grabbing",
              boxShadow: "0 10px 20px rgba(0,0,0,0.25)",
              border: "2px solid var(--action-primary)",
            }}
          >
            <div className="drag-handle" title="Drag to reorder">
              ⋮⋮
            </div>
            <h4>{draggedUnit.name}</h4>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default ArmyColumn;
