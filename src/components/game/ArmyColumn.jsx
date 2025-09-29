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
} from "../../utils/eligibility";
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
    setOverlayInBounds(true);

    // Begin pointer tracking & autoscroll
    draggingRef.current = true;
    pointerRef.current.has = true;
    const onMove = (e) => {
      pointerRef.current.x = e.clientX;
      pointerRef.current.y = e.clientY;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    pointerRef.current._onMove = onMove;

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

  const handleDndOver = (event) => {
    const { active } = event;
    if (!draggedUnit) {
      setDndIntent({ type: "none" });
      return;
    }

    const EDGE_PX = 14;
    const px = pointerRef.current.has
      ? pointerRef.current.x
      : (active.rect?.current?.translated?.left || 0) +
        (active.rect?.current?.translated?.width || 0) / 2;
    const py = pointerRef.current.has
      ? pointerRef.current.y
      : (active.rect?.current?.translated?.top || 0) +
        (active.rect?.current?.translated?.height || 0) / 2;

    // Column containment
    const listEl = listRef.current;
    const containerEl = listEl
      ? listEl.closest(".units-sidebar") || listEl
      : null;
    if (containerEl) {
      const rect = containerEl.getBoundingClientRect();
      const inside =
        px >= rect.left &&
        px <= rect.right &&
        py >= rect.top &&
        py <= rect.bottom;
      if (!inside) {
        setOverlayInBounds(false);
        return;
      }
      if (!overlayInBounds) setOverlayInBounds(true);
    }

    const el = document.elementFromPoint(px, py);
    const gap = el?.closest(".between-slot");
    if (gap) {
      const targetId = gap.getAttribute("data-target-id");
      const edge = gap.getAttribute("data-edge");
      const scope = gap.getAttribute("data-scope") || "top";
      const leaderId = gap.getAttribute("data-leader-id");
      const newGuide = {
        id: targetId,
        edge,
        scope,
        leaderId: leaderId || null,
      };
      const prev = lastGuideRef.current;
      const now = Date.now();
      const sameAnchor =
        prev.id === newGuide.id &&
        prev.scope === newGuide.scope &&
        prev.leaderId === newGuide.leaderId;
      if (!sameAnchor || prev.edge !== newGuide.edge || now - prev.ts > 100) {
        setDndIntent({ type: "insert", ...newGuide });
        lastGuideRef.current = { ...newGuide, ts: now };
      }
      const anchorUnit = allUnitsById[targetId];
      if (anchorUnit && isLeaderUnit(anchorUnit)) setHoveredLeaderId(targetId);
      else setHoveredLeaderId(null);
      return;
    }

    const card = el?.closest(".unit-card[data-unit-id]");
    const candidateId = card?.getAttribute("data-unit-id") || null;
    if (candidateId && candidateId !== String(active.id)) {
      const candidate = allUnitsById[candidateId];
      const r = card.getBoundingClientRect();
      const inTopEdge = py <= r.top + EDGE_PX;
      const inBottomEdge = py >= r.bottom - EDGE_PX;
      const inEdges = inTopEdge || inBottomEdge;
      if (isLeaderUnit(candidate)) {
        setHoveredLeaderId(candidateId);
        const eligible =
          !isLeaderUnit(draggedUnit) &&
          canLeaderAttachToUnit(candidate, draggedUnit);
        if (inEdges) {
          const newGuide = {
            id: candidateId,
            edge: inTopEdge ? "top" : "bottom",
            scope: "top",
            leaderId: null,
          };
          const prev = lastGuideRef.current;
          const now = Date.now();
          const sameAnchor =
            prev.id === newGuide.id && prev.scope === newGuide.scope;
          if (
            !sameAnchor ||
            prev.edge !== newGuide.edge ||
            now - prev.ts > 100
          ) {
            setDndIntent({ type: "insert", ...newGuide });
            lastGuideRef.current = { ...newGuide, ts: now };
          }
        } else if (eligible) {
          setDndIntent({ type: "attach", leaderId: candidateId });
        } else {
          const edge = py < (r.top + r.bottom) / 2 ? "top" : "bottom";
          const newGuide = {
            id: candidateId,
            edge,
            scope: "top",
            leaderId: null,
          };
          const prev = lastGuideRef.current;
          const now = Date.now();
          const sameAnchor =
            prev.id === newGuide.id && prev.scope === newGuide.scope;
          if (
            !sameAnchor ||
            prev.edge !== newGuide.edge ||
            now - prev.ts > 100
          ) {
            setDndIntent({ type: "insert", ...newGuide });
            lastGuideRef.current = { ...newGuide, ts: now };
          }
        }
      } else {
        const parentLeaderId =
          Object.entries(attachments || {}).find(([lid, arr]) =>
            (arr || []).includes(candidateId),
          )?.[0] || null;
        if (parentLeaderId) {
          if ((attachments[parentLeaderId] || []).includes(active.id)) {
            const edge = inTopEdge
              ? "top"
              : inBottomEdge
                ? "bottom"
                : py < (r.top + r.bottom) / 2
                  ? "top"
                  : "bottom";
            const newGuide = {
              id: candidateId,
              edge,
              scope: "children",
              leaderId: parentLeaderId,
            };
            const prev = lastGuideRef.current;
            const now = Date.now();
            const sameAnchor =
              prev.id === newGuide.id &&
              prev.scope === newGuide.scope &&
              prev.leaderId === newGuide.leaderId;
            if (
              !sameAnchor ||
              prev.edge !== newGuide.edge ||
              now - prev.ts > 100
            ) {
              setDndIntent({ type: "insert", ...newGuide });
              lastGuideRef.current = { ...newGuide, ts: now };
            }
            setHoveredLeaderId(parentLeaderId);
          } else {
            setHoveredLeaderId(null);
            setDndIntent({ type: "none" });
          }
        } else {
          const edge = inTopEdge
            ? "top"
            : inBottomEdge
              ? "bottom"
              : py < (r.top + r.bottom) / 2
                ? "top"
                : "bottom";
          const newGuide = {
            id: candidateId,
            edge,
            scope: "top",
            leaderId: null,
          };
          const prev = lastGuideRef.current;
          const now = Date.now();
          const sameAnchor =
            prev.id === newGuide.id && prev.scope === newGuide.scope;
          if (
            !sameAnchor ||
            prev.edge !== newGuide.edge ||
            now - prev.ts > 100
          ) {
            setDndIntent({ type: "insert", ...newGuide });
            lastGuideRef.current = { ...newGuide, ts: now };
          }
          setHoveredLeaderId(null);
        }
      }
    } else {
      setHoveredLeaderId(null);
      setDndIntent({ type: "none" });
    }
  };

  const handleDndEnd = (event) => {
    const { active, over } = event;
    const activeId = active?.id;
    const overItemId = over?.id;
    const intent = dndIntent;
    cleanupDragState();
    if (!overlayInBounds) return;

    const activeUnit = allUnitsById[activeId];
    if (intent.type === "attach" && activeUnit && !isLeaderUnit(activeUnit)) {
      const leader = allUnitsById[intent.leaderId];
      if (leader && canLeaderAttachToUnit(leader, activeUnit)) {
        const next = (() => {
          const n = { ...(attachments || {}) };
          Object.keys(n).forEach((lid) => {
            n[lid] = (n[lid] || []).filter((id) => id !== activeId);
            if (n[lid].length === 0) delete n[lid];
          });
          const arr = n[intent.leaderId] || [];
          if (arr.includes(activeId)) {
            n[intent.leaderId] = arr
              .filter((id) => id !== activeId)
              .concat(activeId);
          } else {
            arr.push(activeId);
            n[intent.leaderId] = arr;
          }
          return n;
        })();
        const newTop = itemIds.filter((id) => id !== activeId);
        setAttachments(next);
        setUnitOrder(newTop);
        const base = `gameState.columns.${columnKey}`;
        updateGameState(gameId, {
          [`${base}.attachments`]: next,
          [`${base}.unitOrder`]: newTop,
        }).catch((err) => console.error("persist attach failed", err));
        return;
      }
    }

    if (intent.type === "insert" && intent.id) {
      if (intent.scope === "top") {
        const wasAttached = Object.values(attachments || {}).some((arr) =>
          (arr || []).includes(activeId),
        );
        let next = attachments;
        if (wasAttached) {
          next = { ...(attachments || {}) };
          Object.keys(next).forEach((lid) => {
            next[lid] = (next[lid] || []).filter((id) => id !== activeId);
            if (next[lid].length === 0) delete next[lid];
          });
          setAttachments(next);
        }
        const newTop = itemIds.filter((id) => id !== activeId);
        const anchorIndex = newTop.indexOf(intent.id);
        if (anchorIndex !== -1) {
          const insertAt =
            intent.edge === "bottom" ? anchorIndex + 1 : anchorIndex;
          newTop.splice(insertAt, 0, activeId);
          setUnitOrder(newTop);
          const update = {
            [`gameState.columns.${columnKey}.unitOrder`]: newTop,
          };
          if (wasAttached)
            update[`gameState.columns.${columnKey}.attachments`] = next;
          updateGameState(gameId, update).catch((err) =>
            console.error("persist reorder failed", err),
          );
          return;
        }
      } else if (
        intent.scope === "children" &&
        intent.leaderId &&
        (attachments[intent.leaderId] || []).includes(activeId)
      ) {
        const arr = Array.from(attachments[intent.leaderId] || []);
        const fromIdx = arr.indexOf(activeId);
        const anchorIdx = arr.indexOf(intent.id);
        if (fromIdx !== -1 && anchorIdx !== -1) {
          const without = arr.filter((id) => id !== activeId);
          const insertAt =
            intent.edge === "bottom"
              ? anchorIdx + (fromIdx < anchorIdx ? 0 : 1)
              : anchorIdx + (fromIdx < anchorIdx ? -1 : 0);
          const bounded = Math.max(0, Math.min(without.length, insertAt));
          without.splice(bounded, 0, activeId);
          const next = { ...(attachments || {}) };
          next[intent.leaderId] = without;
          setAttachments(next);
          updateGameState(gameId, {
            [`gameState.columns.${columnKey}.attachments`]: next,
          }).catch((err) => console.error("persist child-reorder failed", err));
          return;
        }
      }
    }

    if (!overItemId || activeId === overItemId) return;
    const oldIndex = itemIds.indexOf(activeId);
    const newIndex = itemIds.indexOf(overItemId);
    if (oldIndex === -1 || newIndex === -1) return;
    const newTopOrder = arrayMove(itemIds, oldIndex, newIndex);
    setUnitOrder(newTopOrder);
    updateGameState(gameId, {
      [`gameState.columns.${columnKey}.unitOrder`]: newTopOrder,
    }).catch((err) => console.error("persist reorder failed", err));
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
            const shouldGlowAsLeader =
              !!draggedUnit &&
              isLeaderUnit(unit) &&
              draggedUnit.id !== unit.id &&
              canLeaderAttachToUnit(unit, draggedUnit);
            const freezeTransform = !!(
              hoveredLeaderId === unit.id ||
              (dndIntent.type === "insert" &&
                dndIntent.scope === "top" &&
                dndIntent.id === unit.id)
            );
            const dropIntent = !!(
              dndIntent.type === "attach" && dndIntent.leaderId === unit.id
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
                  shouldGlowAsLeader={!!shouldGlowAsLeader}
                  freezeTransform={freezeTransform}
                  dropIntent={dropIntent}
                  insertEdge={insertEdge}
                  titleText={titleText}
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
                              insertEdge={childInsert}
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
