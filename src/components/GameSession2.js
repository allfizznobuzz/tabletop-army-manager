import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import {
  restrictToVerticalAxis,
  restrictToFirstScrollableAncestor,
} from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  updateGameState,
  subscribeToGame,
  subscribeToGameUpdates,
} from "../firebase/database";
// AuthContext will be implemented later
import UnitDatasheet from "./UnitDatasheet";
import {
  hasActiveOverrides as ovHasActive,
  getOverrideSummary as ovSummary,
  canAttach,
} from "../utils/eligibility";
import { parseArmyFile } from "../utils/armyParser";
import { resolveWeaponCarrierCount } from "../utils/weaponCarrier";
import {
  woundTarget,
  probabilityFromTarget,
  parseDiceNotation,
  computeDefenderSave,
  parseAp,
} from "../utils/attackMath";
import { resolveDefenderStats } from "../utils/defenderResolver";

// In testing environments, @dnd-kit/sortable may be mocked or unavailable.
// Provide a safe wrapper so destructuring never throws when the hook is mocked to undefined.
// Named like a hook to satisfy rules-of-hooks when used inside components.
const useSafeSortable = (id) => {
  try {
    const v = useSortable({ id });
    if (v && typeof v === "object") return v;
  } catch (e) {
    // ignore and fall through to stub
  }
  return {
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    transition: null,
    isDragging: false,
  };
};

// Sortable unit card powered by dnd-kit
const SortableUnitBase = ({
  unit,
  isSelected,
  onClick,
  statusClass,
  shouldGlowAsLeader,
  freezeTransform,
  dropIntent,
  titleText,
  insertEdge,
  pulse,
  overrideActive,
  overrideSummary,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSafeSortable(unit.id);
  const style = {
    transform: isDragging
      ? undefined
      : freezeTransform
        ? undefined
        : CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
    zIndex: isDragging ? 20 : "auto",
    opacity: isDragging ? 0 : 1,
    willChange: isDragging || freezeTransform ? "auto" : "transform",
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        zIndex: isDragging ? 20 : "auto",
      }}
      className={`unit-card ${isSelected ? "selected" : ""} ${statusClass} ${shouldGlowAsLeader ? "can-attach" : ""} ${dropIntent ? "drop-intent" : ""} ${insertEdge === "top" ? "drag-over-before" : ""} ${insertEdge === "bottom" ? "drag-over-after" : ""} ${pulse ? "pulse" : ""}`}
      data-column={unit.column}
      data-unit-id={unit.id}
      title={titleText}
      role="button"
      tabIndex={0}
      aria-selected={isSelected ? true : undefined}
      onClick={() => onClick(unit)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick(unit);
      }}
    >
      {/* Between-slot overlays for top-level insert targeting */}
      <div
        className="between-slot top"
        aria-hidden="true"
        data-target-id={unit.id}
        data-edge="top"
        data-scope="top"
      ></div>
      <div
        className="between-slot bottom"
        aria-hidden="true"
        data-target-id={unit.id}
        data-edge="bottom"
        data-scope="top"
      ></div>
      {/* Removed target badge per new UX: defender is derived from other visible datasheet */}
      {/* Optional meta row: only when overrides exist, to avoid dead gap */}
      {overrideActive ? (
        <div className="card-meta">
          <span
            className="override-pill"
            tabIndex={0}
            aria-label={overrideSummary}
            title={overrideSummary}
          >
            Overridden
          </span>
        </div>
      ) : null}
      {/* Drag handle (absolute) with keyboard focus */}
      <div
        className="drag-handle"
        role="button"
        tabIndex={0}
        aria-label="Drag to reorder"
        title="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        ⋮⋮
      </div>
      {/* Smaller attach hitbox (visual only) inside the card */}
      <div className="attach-zone" />
      <h4>{unit.name}</h4>
    </div>
  );
};

// ArmyColumn renders one player's army column with fully-contained DnD and attach logic.
// It persists state to gameState.columns.<col>.{attachments,unitOrder} and never crosses columns.
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
  ovSummary,
  gameId,
  sensors,
  draggedUnit,
  setDraggedUnit,
  pinUnit,
  pinnedUnitId,
  pointerRef,
  scrollRafRef,
  draggingRef,
  // Attack Helper wiring
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
  useEffect(() => {
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
                      // Opposite column while helper open => set defender, keep weapon selection
                      pinUnit?.(u);
                      setAttackHelper((prev) => ({
                        ...prev,
                        open: true,
                        targetUnitId: u.id,
                        intent: prev.intent,
                      }));
                      return;
                    }
                    // Same column (or helper closed) => switch attacker, clear weapon; preserve defender if opposite
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
                            <AttachedUnitSortable
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
            className={`unit-card dragging ${getUnitStatusClass(draggedUnit)} ${selectedUnit?.id === draggedUnit.id ? "selected" : ""}`}
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

SortableUnitBase.displayName = "SortableUnit";
const SortableUnit = React.memo(SortableUnitBase);

// Sortable for attached units (to reorder within a leader or detach)
const AttachedUnitSortable = ({
  unit,
  isSelected,
  onClick,
  statusClass,
  insertEdge,
  onDetach,
  leaderName,
  leaderId,
  overrideActive,
  overrideSummary,
  pulse,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSafeSortable(unit.id);
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : "auto",
  };
  const handleKey = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onDetach?.();
    }
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`attached-unit unit-card ${isSelected ? "selected" : ""} ${statusClass} ${insertEdge === "top" ? "drag-over-before" : ""} ${insertEdge === "bottom" ? "drag-over-after" : ""} ${pulse ? "pulse" : ""}`}
      data-column={unit.column}
      data-unit-id={unit.id}
      aria-selected={isSelected ? true : undefined}
      onClick={() => onClick(unit)}
    >
      {/* Between-slot overlays for child insert targeting */}
      <div
        className="between-slot top"
        aria-hidden="true"
        data-target-id={unit.id}
        data-edge="top"
        data-scope="children"
        data-leader-id={leaderId}
      ></div>
      <div
        className="between-slot bottom"
        aria-hidden="true"
        data-target-id={unit.id}
        data-edge="bottom"
        data-scope="children"
        data-leader-id={leaderId}
      ></div>
      {/* Removed target badge per new UX */}
      {/* Optional meta row: only when overrides exist */}
      {overrideActive ? (
        <div className="card-meta">
          <span
            className="override-pill"
            tabIndex={0}
            aria-label={overrideSummary}
            title={overrideSummary}
          >
            Overridden
          </span>
        </div>
      ) : null}
      {/* Drag handle (absolute) with keyboard focus */}
      <div
        className="drag-handle"
        role="button"
        tabIndex={0}
        aria-label="Drag to reorder"
        title="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        ⋮⋮
      </div>
      <button
        type="button"
        className="detach-btn"
        aria-label={`Detach from ${leaderName || "leader"}`}
        title={`Detach from ${leaderName || "leader"}`}
        onClick={(e) => {
          e.stopPropagation();
          onDetach?.();
        }}
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
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);
  const [draggedUnit, setDraggedUnit] = useState(null);
  // Attack Helper state
  const [attackHelper, setAttackHelper] = useState({
    open: false,
    section: null, // 'ranged' | 'melee'
    index: null,
    modelsInRange: null,
    targetUnitId: null,
    attackerUnitId: null,
    intent: "idle", // idle | open_no_target | open_with_target
    showExpected: false,
  });

  // Sync CSS variable for sticky army header height to keep columns perfectly level at any width
  // Batch reads/writes to avoid ResizeObserver loop warnings.
  useEffect(() => {
    const root = document.documentElement;
    let rafId = 0;
    let lastH = 0;
    const measureAndSet = () => {
      if (rafId) return; // coalesce
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        let h = 0;
        document
          .querySelectorAll(".army-column .column-header")
          .forEach((el) => {
            const rect = el.getBoundingClientRect();
            h = Math.max(h, Math.ceil(rect.height));
          });
        if (h && h !== lastH) {
          lastH = h;
          root.style.setProperty("--army-header-offset", `${h}px`);
        }
      });
    };
    const ro = new ResizeObserver(() => measureAndSet());
    document
      .querySelectorAll(".army-column .column-header")
      .forEach((el) => ro.observe(el));
    window.addEventListener("resize", measureAndSet);
    measureAndSet();
    return () => {
      window.removeEventListener("resize", measureAndSet);
      ro.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);
  const [pulseTargetId, setPulseTargetId] = useState(null);
  const [attachmentsA, setAttachmentsA] = useState({});
  const [attachmentsB, setAttachmentsB] = useState({});
  const [unitOrderA, setUnitOrderA] = useState([]);
  const [unitOrderB, setUnitOrderB] = useState([]);
  const [leadershipOverrides, setLeadershipOverrides] = useState({});
  const pointerRef = useRef({ x: 0, y: 0, has: false });
  const scrollRafRef = useRef(null);
  const draggingRef = useRef(false);
  const inputARef = useRef(null);
  const inputBRef = useRef(null);
  const [uploadErrorA, setUploadErrorA] = useState("");
  const [uploadErrorB, setUploadErrorB] = useState("");
  const lastActionRef = useRef(null);

  // Keep last-clicked unit per column pinned so both datasheets can display
  const [pinnedUnitIdA, setPinnedUnitIdA] = useState(null);
  const [pinnedUnitIdB, setPinnedUnitIdB] = useState(null);

  const pinUnit = (u) => {
    if (!u) return;
    if (u.column === "A") setPinnedUnitIdA(u.id);
    else if (u.column === "B") setPinnedUnitIdB(u.id);
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
      if (typeof unsubscribeGame === "function") unsubscribeGame();
      if (typeof unsubscribeUpdates === "function") unsubscribeUpdates();
    };
  }, [gameId]);

  // Narrow layout detection for overlay fallback
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(max-width: 768px)");
    const handle = (e) => setIsNarrow(!!e.matches);
    // Initialize
    handle(mql);
    if (mql.addEventListener) mql.addEventListener("change", handle);
    else if (mql.addListener) mql.addListener(handle);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", handle);
      else if (mql.removeListener) mql.removeListener(handle);
    };
  }, []);

  // Close overlay when deselecting or when exiting narrow mode
  useEffect(() => {
    if (!isNarrow) setOverlayOpen(false);
    if (!selectedUnit) setOverlayOpen(false);
  }, [isNarrow, selectedUnit]);

  // Do not auto-collapse on attacker change; unit card clicks explicitly reset helper state.
  useEffect(() => {
    if (lastActionRef.current === "toggle_weapon") {
      lastActionRef.current = null;
    }
  }, [selectedUnit?.id]);

  // Collapse when clicking outside both the panel and enemy unit cards
  useEffect(() => {
    if (!attackHelper.open) return;
    const onDocPointer = (e) => {
      const panel = e.target?.closest?.(".attack-helper, .attack-helper-panel");
      if (panel) return; // keep open when interacting with panel
      const unitCard = e.target?.closest?.(".unit-card");
      if (unitCard) {
        // Allow unit click handlers to process (enemy selection)
        return;
      }
      // If a weapon toggle occurred this tick, do not close
      if (lastActionRef.current === "toggle_weapon") {
        lastActionRef.current = null;
        return;
      }
      // Allow weapon row clicks inside datasheets to update selection without closing first
      const weaponRow = e.target?.closest?.(".weapon-row");
      if (weaponRow) return;
      // Also allow any clicks within a datasheet surface
      const datasheet = e.target?.closest?.(".unit-datasheet");
      if (datasheet) return;
      setAttackHelper((prev) => ({
        open: false,
        section: null,
        index: null,
        modelsInRange: null,
        targetUnitId: null,
        attackerUnitId: null,
        intent: "idle",
        showExpected: prev.showExpected,
      }));
    };
    document.addEventListener("pointerup", onDocPointer);
    return () => document.removeEventListener("pointerup", onDocPointer);
  }, [attackHelper.open]);

  // Build full units list (snapshot from gameData)
  const allUnitsA = useMemo(() => {
    if (!gameData?.playerA?.armyData?.units) return [];
    const units = gameData.playerA.armyData.units;
    return units.map((unit, index) => ({
      id: `A_unit_${index}`,
      name: unit.name || "Unknown Unit",
      column: "A",
      playerName: gameData.playerA.displayName || "Player A",
      currentWounds:
        unit.currentWounds !== undefined
          ? unit.currentWounds
          : unit.wounds || 1,
      totalWounds: unit.wounds || 1,
      totalDamage: unit.totalDamage || 0,
      victoryPoints: unit.victoryPoints || 0,
      points: unit.points || 0,
      models: unit.models || unit.size || 1,
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
      keywords: unit.keywords || [],
    }));
  }, [gameData?.playerA?.armyData]);

  const allUnitsB = useMemo(() => {
    if (!gameData?.playerB?.armyData?.units) return [];
    const units = gameData.playerB.armyData.units;
    return units.map((unit, index) => ({
      id: `B_unit_${index}`,
      name: unit.name || "Unknown Unit",
      column: "B",
      playerName: gameData.playerB.displayName || "Player B",
      currentWounds:
        unit.currentWounds !== undefined
          ? unit.currentWounds
          : unit.wounds || 1,
      totalWounds: unit.wounds || 1,
      totalDamage: unit.totalDamage || 0,
      victoryPoints: unit.victoryPoints || 0,
      points: unit.points || 0,
      models: unit.models || unit.size || 1,
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
      keywords: unit.keywords || [],
    }));
  }, [gameData?.playerB?.armyData]);

  const allUnits = useMemo(
    () => [...allUnitsA, ...allUnitsB],
    [allUnitsA, allUnitsB],
  );

  const allUnitsById = useMemo(() => {
    const map = {};
    allUnits.forEach((u) => {
      map[u.id] = u;
    });
    return map;
  }, [allUnits]);

  // Resolve attacker/defender for compare view
  const pinnedA = pinnedUnitIdA ? allUnitsById[pinnedUnitIdA] : null;
  const pinnedB = pinnedUnitIdB ? allUnitsById[pinnedUnitIdB] : null;
  const leftUnit =
    pinnedA || (selectedUnit?.column === "A" ? selectedUnit : null);
  const rightUnit =
    pinnedB || (selectedUnit?.column === "B" ? selectedUnit : null);
  const targetUnit = selectedUnit
    ? selectedUnit.column === "A"
      ? rightUnit || null
      : leftUnit || null
    : null;

  // Per-column ordering is managed inside ArmyColumn

  // Placeholder approach needs no visual order effect

  // Sync per-column state from backend
  useEffect(() => {
    const a = gameData?.gameState?.columns?.A?.attachments || {};
    setAttachmentsA(a);
  }, [gameData?.gameState?.columns?.A?.attachments]);

  useEffect(() => {
    const b = gameData?.gameState?.columns?.B?.attachments || {};
    setAttachmentsB(b);
  }, [gameData?.gameState?.columns?.B?.attachments]);

  useEffect(() => {
    const orderA = gameData?.gameState?.columns?.A?.unitOrder;
    if (Array.isArray(orderA)) setUnitOrderA(orderA);
  }, [gameData?.gameState?.columns?.A?.unitOrder]);

  useEffect(() => {
    const orderB = gameData?.gameState?.columns?.B?.unitOrder;
    if (Array.isArray(orderB)) setUnitOrderB(orderB);
  }, [gameData?.gameState?.columns?.B?.unitOrder]);

  // dnd-kit sensors and handlers
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 1 } }),
  );

  // sensors are reused in per-column DnD

  // Sync leadership overrides from backend
  useEffect(() => {
    const backend = gameData?.gameState?.leadershipOverrides || {};
    setLeadershipOverrides(backend);
  }, [gameData?.gameState?.leadershipOverrides]);

  // Per-column detach handled inside ArmyColumn

  // Update overrides for a unit and persist
  const updateUnitOverrides = (unitId, partial) => {
    setLeadershipOverrides((prev) => {
      const next = { ...(prev || {}) };
      const current = next[unitId] || {
        canLead: "auto",
        canBeLed: "auto",
        allowList: [],
      };
      const merged = {
        ...current,
        ...partial,
        allowList:
          partial.allowList !== undefined
            ? Array.from(new Set(partial.allowList))
            : current.allowList,
      };
      next[unitId] = merged;
      updateGameState(gameId, { "gameState.leadershipOverrides": next }).catch(
        (err) => console.error("persist overrides failed", err),
      );
      return next;
    });
  };

  // Helper functions for new unit status system
  const getUnitStatusClass = (unit) => {
    if (unit.currentWounds === 0) return "dead";
    if (unit.hasActed) return "done"; // Assuming we'll add this field
    return "ready";
  };

  // Quick leader check for visuals (orange glow)
  const isLeaderUnit = (unit) => {
    if (!unit) return false;
    const ov = leadershipOverrides[unit.id];
    if (ov?.canLead === "yes") return true;
    if (ov?.canLead === "no") return false;
    const keywords = (unit.keywords || []).map((k) => String(k).toLowerCase());
    const rules = (unit.rules || []).map((r) => String(r).toLowerCase());
    const abilities = unit.abilities || [];
    const name = String(unit.name || "").toLowerCase();

    const hasLeaderKeyword = keywords.includes("leader");
    const hasCharacterKeyword = keywords.includes("character");
    const hasLeaderRule = rules.some((r) => r.includes("leader"));
    const hasLeaderAbility = abilities.some((a) =>
      String(a.name || "")
        .toLowerCase()
        .includes("leader"),
    );
    const hasAttachText = abilities.some((a) =>
      String(a.description || a.text || "")
        .toLowerCase()
        .includes("this model can be attached to"),
    );

    const commonLeaderNames = [
      "captain",
      "commander",
      "lieutenant",
      "librarian",
      "chaplain",
      "ancient",
      "champion",
      "sanguinary",
      "priest",
      "company master",
      "apothecary",
      "judiciar",
    ];
    const isCommonLeaderName = commonLeaderNames.some((n) => name.includes(n));

    return (
      hasLeaderKeyword ||
      hasCharacterKeyword ||
      hasLeaderRule ||
      hasLeaderAbility ||
      hasAttachText ||
      isCommonLeaderName
    );
  };

  // Baseline source-data check (strict, from abilities text)
  const sourceCanAttach = (leader, draggedUnit) => {
    if (!leader || !draggedUnit) return false;
    // Must actually have a Leader ability
    const abilities = leader.abilities || [];
    const hasLeaderAbility = abilities.some((a) =>
      String(a.name || "")
        .toLowerCase()
        .includes("leader"),
    );
    if (!hasLeaderAbility) return false;

    const normalize = (s) =>
      String(s || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const unitFull = normalize(draggedUnit.name);
    // Try without trailing "with ..." qualifiers for broader matching
    const unitBase = normalize(draggedUnit.name.replace(/\bwith\b.*$/, ""));

    // Look for explicit attach permission mentioning the target unit
    return abilities.some((ability) => {
      const name = normalize(ability.name);
      const text = normalize(ability.description || ability.text);
      if (
        !(
          name.includes("leader") ||
          text.includes("this model can be attached to") ||
          text.includes("can be attached to")
        )
      ) {
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

  // Import army from a selected or dropped file
  const importArmyFromFile = async (columnKey, file) => {
    if (!file || !file.name.toLowerCase().endsWith(".json")) {
      const msg = `Unsupported file type for ${file ? file.name : "unknown file"}. Please select a .json file.`;
      columnKey === "A" ? setUploadErrorA(msg) : setUploadErrorB(msg);
      return;
    }
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const parsed = parseArmyFile(json);
      const base = columnKey === "A" ? "playerA" : "playerB";
      const order = (parsed.units || []).map(
        (_, i) => `${columnKey}_unit_${i}`,
      );
      await updateGameState(gameId, {
        [`${base}.armyData`]: parsed,
        [`gameState.columns.${columnKey}.attachments`]: {},
        [`gameState.columns.${columnKey}.unitOrder`]: order,
      });
      // clear errors
      columnKey === "A" ? setUploadErrorA("") : setUploadErrorB("");
    } catch (e) {
      const msg = `Failed to import ${file.name}: ${e.message || e}`;
      columnKey === "A" ? setUploadErrorA(msg) : setUploadErrorB(msg);
    }
  };

  const onFileInputChange = async (columnKey, e) => {
    const files = e.target.files;
    if (files && files[0]) {
      await importArmyFromFile(columnKey, files[0]);
      // reset input so selecting the same file again triggers change
      e.target.value = "";
    }
  };

  const onDragOverZone = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  };

  const onDropZone = async (columnKey, e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      await importArmyFromFile(columnKey, file);
    }
  };

  // Determine whose turn it is
  const isMyTurn = gameData?.currentTurn === user?.uid;

  const hasArmyA = !!gameData?.playerA?.armyData;
  const hasArmyB = !!gameData?.playerB?.armyData;

  // --- Attack Helper utils and renderer ---
  const toHitTarget = (weapon, section) => {
    const skill = weapon?.skill;
    if (typeof skill === "number" && skill >= 2 && skill <= 6) return skill;
    if (section === "ranged") {
      const bs = Number(selectedUnit?.ballistic_skill || 0);
      return bs >= 2 && bs <= 6 ? bs : null;
    }
    const ws = Number(selectedUnit?.weapon_skill || 0);
    return ws >= 2 && ws <= 6 ? ws : null;
  };

  const groupWeapons = (unit) => {
    const list = Array.isArray(unit?.weapons) ? unit.weapons : [];
    const map = new Map();
    const keyOf = (w) => {
      const name = w.name || "";
      const range =
        w.range === "Melee" || w.type === "Melee" ? "Melee" : w.range || '12"';
      const type = w.type || (range === "Melee" ? "Melee" : "Assault 1");
      const attacks = w.attacks ?? 1;
      const skill = w.skill ?? 3;
      const strength = w.strength ?? 4;
      const ap = w.ap ?? 0;
      const damage = w.damage ?? 1;
      return `${name}|${range}|${type}|${attacks}|${skill}|${strength}|${ap}|${damage}`;
    };
    list.forEach((w) => {
      const k = keyOf(w);
      const existing = map.get(k);
      if (existing) {
        existing.count = existing.count ? existing.count + 1 : 2;
      } else {
        const initial = { ...w };
        if (Number.isFinite(w.count) && w.count > 0) {
          initial.count = w.count;
        }
        map.set(k, initial);
      }
    });
    const grouped = Array.from(map.values());
    const ranged = grouped.filter(
      (w) => w.type !== "Melee" && w.range !== "Melee",
    );
    const melee = grouped.filter(
      (w) => w.type === "Melee" || w.range === "Melee",
    );
    return { ranged, melee };
  };

  const defenderSaveView = (target) => {
    if (!target) return { label: "—", hint: "select a target" };
    const { armourSave, invulnSave } = resolveDefenderStats(target || {});
    if (invulnSave)
      return { label: `${invulnSave}+ (Inv)`, hint: "invulnerable" };
    if (armourSave) return { label: `${armourSave}+`, hint: "armor save" };
    return { label: "—", hint: "missing" };
  };

  const renderAttackHelper = () => {
    const attacker = attackHelper?.attackerUnitId
      ? allUnitsById[attackHelper.attackerUnitId]
      : selectedUnit;
    if (!attacker) return null;
    const { ranged, melee } = groupWeapons(attacker);
    const section = attackHelper?.section;
    const index = attackHelper?.index;
    const weapon =
      section === "ranged"
        ? ranged[index]
        : section === "melee"
          ? melee[index]
          : null;
    const modelsInRange = attackHelper?.modelsInRange || attacker.models || 1;
    const AParsed = parseDiceNotation(weapon?.attacks);
    const sVal = Number(weapon?.strength || attacker.strength || 0);
    const selectedTarget = attackHelper?.targetUnitId
      ? allUnitsById[attackHelper.targetUnitId]
      : targetUnit;
    const {
      toughness: tResolved,
      armourSave: svResolved,
      invulnSave,
    } = resolveDefenderStats(selectedTarget || {});
    const tVal = Number(tResolved || 0);
    const toHitT = weapon ? toHitTarget(weapon, section) : null;
    const toHitP = toHitT ? probabilityFromTarget(toHitT) : null;
    const woundT = tVal ? woundTarget(sVal, tVal) : null;
    const woundP = woundT ? probabilityFromTarget(woundT) : null;
    const apInt = parseAp(weapon?.ap || 0);
    const saveInfo = defenderSaveView(selectedTarget);
    const breakdown = computeDefenderSave(svResolved, apInt, invulnSave);
    const bestSv = breakdown.best;
    const bestLabel = selectedTarget
      ? bestSv != null
        ? `${bestSv}+${breakdown.used === "invuln" ? " (Inv)" : ""}`
        : "—"
      : "—";
    const bestHint = selectedTarget
      ? bestSv != null
        ? breakdown.used === "invuln"
          ? "invulnerable"
          : "armor after AP"
        : "missing"
      : "select a target";

    let totalAttacks = null;
    if (AParsed.kind === "fixed")
      totalAttacks = Number(AParsed.value || 0) * modelsInRange;

    const showHeaderNames = !!weapon;

    return (
      <section className="attack-helper is-sticky" aria-label="Attack Helper">
        <div className="helper-header">
          <div className="helper-name">Dice Calculator</div>
          <div className="helper-title">
            <span>Attacker:</span>
            <strong
              className={`attacker-name${showHeaderNames ? " active" : ""}`}
            >
              {showHeaderNames && attacker ? attacker.name : ""}
            </strong>
            {showHeaderNames ? <span className="sep">•</span> : null}
            <span>Defender:</span>
            <strong
              className={`defender-name${showHeaderNames ? " active" : ""}`}
            >
              {showHeaderNames && selectedTarget ? selectedTarget.name : ""}
            </strong>
            {showHeaderNames ? <span className="sep">•</span> : null}
            <span>Weapon:</span>
            <strong>{weapon ? weapon.name : "—"}</strong>
          </div>
        </div>
        <div className="helper-grid">
          <div className="helper-cell">
            <div className="section-title">Attacks</div>
            <div className="value">
              {weapon ? (
                AParsed.kind === "fixed" ? (
                  (totalAttacks ?? "—")
                ) : (
                  `Roll ${AParsed.value}`
                )
              ) : (
                <>
                  — <span className="meta">select a weapon</span>
                </>
              )}
            </div>
            <label className="models-input-row">
              <span>Models in range/engaged</span>
              <input
                type="number"
                min={1}
                aria-label="Models in range"
                value={modelsInRange}
                onChange={(e) =>
                  setAttackHelper((prev) => ({
                    ...prev,
                    modelsInRange: Math.max(1, Number(e.target.value) || 1),
                  }))
                }
              />
            </label>
          </div>

          <div className="helper-cell">
            <div className="section-title">To Hit</div>
            <div className="value">
              {weapon && toHitT ? (
                <>
                  {toHitT}+
                  <span className="meta">
                    {" "}
                    {toHitP != null ? `(p≈${(toHitP * 100).toFixed(1)}%)` : ""}
                  </span>
                </>
              ) : (
                <>
                  —{" "}
                  <span className="meta">
                    {weapon ? "missing" : "select a weapon"}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="helper-cell">
            <div className="section-title">To Wound</div>
            <div className="value">
              {weapon && woundT ? (
                <>
                  {woundT}+
                  <span className="meta">
                    {" "}
                    {woundP != null ? `(p≈${(woundP * 100).toFixed(1)}%)` : ""}
                  </span>
                </>
              ) : (
                <>
                  —{" "}
                  <span className="meta">
                    {weapon ? "select a target" : "select a weapon & target"}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="helper-cell">
            <div className="section-title">Defender Save</div>
            <div className="value">
              {bestLabel}
              <span className="meta"> {bestHint}</span>
            </div>
            {weapon ? (
              <div className="meta">
                Armour after AP:{" "}
                {breakdown.armourAfterAp ? `${breakdown.armourAfterAp}+` : "—"}
                {svResolved ? ` (SV ${svResolved}+)` : ""} AP {apInt || 0}
              </div>
            ) : null}
          </div>
        </div>

        <div className="helper-cell" style={{ marginTop: 8 }}>
          <label
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <input
              type="checkbox"
              aria-label="Show expected results"
              checked={!!attackHelper?.showExpected}
              onChange={() =>
                setAttackHelper((prev) => ({
                  ...prev,
                  showExpected: !prev.showExpected,
                }))
              }
            />
            Show expected results
          </label>
          {weapon && attackHelper?.showExpected
            ? (() => {
                const attacksAvg =
                  AParsed.kind === "fixed"
                    ? Number(AParsed.value || 0) * modelsInRange
                    : Number(AParsed.avg || 0) * modelsInRange;
                const pHit = toHitP ?? 0;
                const pWound = woundP ?? 0;
                const pSave = bestSv ? probabilityFromTarget(bestSv) || 0 : 0;
                const pFail = 1 - pSave;
                const dmgParsed = parseDiceNotation(weapon?.damage);
                const dmgAvg =
                  dmgParsed.kind === "fixed"
                    ? Number(dmgParsed.value || 0)
                    : Number(dmgParsed.avg || 0);
                const expHits = attacksAvg * pHit;
                const expWounds = expHits * pWound;
                const expUnsaved = expWounds * pFail;
                const expDamage = expUnsaved * dmgAvg;
                return (
                  <div
                    className="meta"
                    aria-label="Expected results"
                    style={{ marginTop: 6 }}
                  >
                    Expected hits: {expHits.toFixed(1)} • Expected wounds:{" "}
                    {expWounds.toFixed(1)} • Expected unsaved:{" "}
                    {expUnsaved.toFixed(1)} • Expected damage:{" "}
                    {expDamage.toFixed(1)}
                  </div>
                );
              })()
            : null}
        </div>
      </section>
    );
  };

  return (
    <div className="game-session">
      <div className="game-header">
        <h2>{gameData?.name || "Game"}</h2>
        <div className="game-info">
          <span>Round: {gameData?.round || 1}</span>
          <span>Current Turn: {isMyTurn ? "Your Turn" : "Waiting..."}</span>
          <span>Game ID: {gameId}</span>
        </div>
        {isNarrow && selectedUnit ? (
          <div style={{ marginTop: "0.5rem" }}>
            <button
              type="button"
              className="action-btn"
              aria-label="Open Datasheet overlay"
              onClick={() => setOverlayOpen(true)}
            >
              Open Datasheet
            </button>
          </div>
        ) : null}
      </div>

      <div className="game-content" data-testid="game-content">
        {/* Column 1: Player A */}
        <aside
          className="units-sidebar army-column"
          id="armyA"
          aria-label="Army A"
        >
          <div className="column-header">
            <h3>Player A — {gameData?.playerA?.displayName || "Player A"}</h3>
            <input
              ref={inputARef}
              type="file"
              accept=".json,application/json"
              style={{ display: "none" }}
              aria-label="Upload army file for Player A"
              onChange={(e) => onFileInputChange("A", e)}
            />
            {hasArmyA ? (
              <button
                className="action-btn"
                onClick={() => inputARef.current?.click()}
              >
                Replace army
              </button>
            ) : null}
          </div>
          <div className="units-scroll">
            {!hasArmyA && (
              <div
                className="upload-dropzone"
                role="button"
                aria-label="Upload army file dropzone for Player A"
                onDragOver={onDragOverZone}
                onDrop={(e) => onDropZone("A", e)}
                onClick={() => inputARef.current?.click()}
              >
                <p>
                  <strong>Upload army file</strong>
                </p>
                <p>Click to select or drag & drop a .json file</p>
                {uploadErrorA && (
                  <div className="error-message">{uploadErrorA}</div>
                )}
              </div>
            )}
            {hasArmyA ? (
              <ArmyColumn
                columnKey="A"
                title="Player A"
                units={allUnitsA}
                attachments={attachmentsA}
                setAttachments={setAttachmentsA}
                unitOrder={unitOrderA}
                setUnitOrder={setUnitOrderA}
                leadershipOverrides={leadershipOverrides}
                allUnitsById={allUnitsById}
                selectedUnit={selectedUnit}
                setSelectedUnit={setSelectedUnit}
                updateUnitOverrides={updateUnitOverrides}
                getUnitStatusClass={getUnitStatusClass}
                isLeaderUnit={isLeaderUnit}
                canLeaderAttachToUnit={canLeaderAttachToUnit}
                ovHasActive={ovHasActive}
                ovSummary={ovSummary}
                gameId={gameId}
                sensors={sensors}
                draggedUnit={draggedUnit}
                setDraggedUnit={setDraggedUnit}
                pinUnit={pinUnit}
                pinnedUnitId={pinnedUnitIdA}
                pointerRef={pointerRef}
                scrollRafRef={scrollRafRef}
                draggingRef={draggingRef}
                // Attack Helper wiring
                attackHelper={attackHelper}
                setAttackHelper={setAttackHelper}
                pulseTargetId={pulseTargetId}
                setPulseTargetId={setPulseTargetId}
              />
            ) : (
              <div className="empty-army">
                <p>No army yet. Add one to begin.</p>
              </div>
            )}
          </div>
        </aside>

        {/* Column 2: Center area with sticky rail + independent scroll pane */}
        <main className="datasheet-area">
          <div className="datasheet-sticky-rail">
            {selectedUnit ? renderAttackHelper() : null}
          </div>
          <div className="datasheet-scroll">
            {leftUnit || rightUnit ? (
              <div className="datasheet-compare-grid">
                <div className="pane left">
                  {leftUnit ? (
                    <UnitDatasheet
                      unit={leftUnit}
                      isSelected={selectedUnit?.id === leftUnit.id}
                      onClick={() => {}}
                      overrides={
                        leadershipOverrides[leftUnit.id] || {
                          canLead: "auto",
                          canBeLed: "auto",
                          allowList: [],
                        }
                      }
                      allUnits={allUnits}
                      onUpdateOverrides={(partial) =>
                        updateUnitOverrides(leftUnit.id, partial)
                      }
                      attackHelper={attackHelper}
                      onToggleWeapon={(section, index, weapon) => {
                        // Pin the opposite side so it doesn't default when switching attackers
                        if (!pinnedUnitIdB && rightUnit)
                          setPinnedUnitIdB(rightUnit.id);
                        lastActionRef.current = "toggle_weapon";
                        setAttackHelper((prev) => {
                          const defaultModels = resolveWeaponCarrierCount(
                            leftUnit,
                            weapon,
                          );
                          let nextTargetId =
                            prev.targetUnitId ||
                            pinnedUnitIdB ||
                            (rightUnit ? rightUnit.id : null);
                          if (nextTargetId) {
                            const cand = allUnitsById[nextTargetId];
                            if (!cand || cand.column === leftUnit.column)
                              nextTargetId = null;
                          }
                          const hasTarget = !!nextTargetId;
                          return {
                            open: true,
                            section,
                            index,
                            modelsInRange: defaultModels,
                            targetUnitId: nextTargetId,
                            attackerUnitId: leftUnit.id,
                            intent: hasTarget
                              ? "open_with_target"
                              : "open_no_target",
                            showExpected: prev.showExpected,
                          };
                        });
                        setSelectedUnit(leftUnit);
                      }}
                      onCloseAttackHelper={() =>
                        setAttackHelper({
                          open: false,
                          section: null,
                          index: null,
                          modelsInRange: null,
                          targetUnitId: null,
                          intent: "idle",
                          showExpected: attackHelper?.showExpected,
                        })
                      }
                      onChangeModelsInRange={(val) =>
                        setAttackHelper((prev) => ({
                          ...prev,
                          modelsInRange: Math.max(1, Number(val) || 1),
                        }))
                      }
                      onToggleExpected={() =>
                        setAttackHelper((prev) => ({
                          ...prev,
                          showExpected: !prev.showExpected,
                        }))
                      }
                      selectedTargetUnit={targetUnit}
                    />
                  ) : (
                    <div className="no-unit-selected">
                      {!hasArmyA && !hasArmyB ? (
                        <>
                          <h3>Start by adding armies to both columns</h3>
                          <p>
                            Use the Upload army controls in each column to
                            import an army JSON.
                          </p>
                        </>
                      ) : (
                        <>
                          <h3>Select a unit from Player A to view details</h3>
                          <p>Click on any unit in the left roster.</p>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <div className="pane right">
                  {rightUnit ? (
                    <UnitDatasheet
                      unit={rightUnit}
                      isSelected={selectedUnit?.id === rightUnit.id}
                      onClick={() => {}}
                      overrides={
                        leadershipOverrides[rightUnit.id] || {
                          canLead: "auto",
                          canBeLed: "auto",
                          allowList: [],
                        }
                      }
                      allUnits={allUnits}
                      onUpdateOverrides={(partial) =>
                        updateUnitOverrides(rightUnit.id, partial)
                      }
                      attackHelper={attackHelper}
                      onToggleWeapon={(section, index, weapon) => {
                        // Pin the opposite side so it doesn't default when switching attackers
                        if (!pinnedUnitIdA && leftUnit)
                          setPinnedUnitIdA(leftUnit.id);
                        lastActionRef.current = "toggle_weapon";
                        setAttackHelper((prev) => {
                          const defaultModels = resolveWeaponCarrierCount(
                            rightUnit,
                            weapon,
                          );
                          let nextTargetId =
                            prev.targetUnitId ||
                            pinnedUnitIdA ||
                            (leftUnit ? leftUnit.id : null);
                          if (nextTargetId) {
                            const cand = allUnitsById[nextTargetId];
                            if (!cand || cand.column === rightUnit.column)
                              nextTargetId = null;
                          }
                          const hasTarget = !!nextTargetId;
                          return {
                            open: true,
                            section,
                            index,
                            modelsInRange: defaultModels,
                            targetUnitId: nextTargetId,
                            attackerUnitId: rightUnit.id,
                            intent: hasTarget
                              ? "open_with_target"
                              : "open_no_target",
                            showExpected: prev.showExpected,
                          };
                        });
                        setSelectedUnit(rightUnit);
                      }}
                      onCloseAttackHelper={() =>
                        setAttackHelper({
                          open: false,
                          section: null,
                          index: null,
                          modelsInRange: null,
                          targetUnitId: null,
                          intent: "idle",
                          showExpected: attackHelper?.showExpected,
                        })
                      }
                      onChangeModelsInRange={(val) =>
                        setAttackHelper((prev) => ({
                          ...prev,
                          modelsInRange: Math.max(1, Number(val) || 1),
                        }))
                      }
                      onToggleExpected={() =>
                        setAttackHelper((prev) => ({
                          ...prev,
                          showExpected: !prev.showExpected,
                        }))
                      }
                      selectedTargetUnit={targetUnit}
                    />
                  ) : (
                    <div className="no-unit-selected">
                      {!hasArmyA && !hasArmyB ? (
                        <>
                          <h3>Start by adding armies to both columns</h3>
                          <p>
                            Use the Upload army controls in each column to
                            import an army JSON.
                          </p>
                        </>
                      ) : (
                        <>
                          <h3>Select a unit from Player B to view details</h3>
                          <p>Click on any unit in the right roster.</p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="no-unit-selected">
                {!hasArmyA && !hasArmyB ? (
                  <>
                    <h3>Start by adding armies to both columns</h3>
                    <p>
                      Use the Upload army controls in each column to import an
                      army JSON.
                    </p>
                  </>
                ) : (
                  <>
                    <h3>Select a unit from either column to view details</h3>
                    <p>
                      Click on any unit to see its datasheet and available
                      actions.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        </main>

        {/* Column 3: Player B */}
        <aside
          className="units-sidebar army-column"
          id="armyB"
          aria-label="Army B"
        >
          <div className="column-header">
            <h3>Player B — {gameData?.playerB?.displayName || "Player B"}</h3>
            <input
              ref={inputBRef}
              type="file"
              accept=".json,application/json"
              style={{ display: "none" }}
              aria-label="Upload army file for Player B"
              onChange={(e) => onFileInputChange("B", e)}
            />
            {hasArmyB ? (
              <button
                className="action-btn"
                onClick={() => inputBRef.current?.click()}
              >
                Replace army
              </button>
            ) : null}
          </div>
          <div className="units-scroll">
            {!hasArmyB && (
              <div
                className="upload-dropzone"
                role="button"
                aria-label="Upload army file dropzone for Player B"
                onDragOver={onDragOverZone}
                onDrop={(e) => onDropZone("B", e)}
                onClick={() => inputBRef.current?.click()}
              >
                <p>
                  <strong>Upload army file</strong>
                </p>
                <p>Click to select or drag & drop a .json file</p>
                {uploadErrorB && (
                  <div className="error-message">{uploadErrorB}</div>
                )}
              </div>
            )}
            {hasArmyB ? (
              <ArmyColumn
                columnKey="B"
                title="Player B"
                units={allUnitsB}
                attachments={attachmentsB}
                setAttachments={setAttachmentsB}
                unitOrder={unitOrderB}
                setUnitOrder={setUnitOrderB}
                leadershipOverrides={leadershipOverrides}
                allUnitsById={allUnitsById}
                selectedUnit={selectedUnit}
                setSelectedUnit={setSelectedUnit}
                updateUnitOverrides={updateUnitOverrides}
                getUnitStatusClass={getUnitStatusClass}
                isLeaderUnit={isLeaderUnit}
                canLeaderAttachToUnit={canLeaderAttachToUnit}
                ovHasActive={ovHasActive}
                ovSummary={ovSummary}
                gameId={gameId}
                sensors={sensors}
                draggedUnit={draggedUnit}
                setDraggedUnit={setDraggedUnit}
                pinUnit={pinUnit}
                pinnedUnitId={pinnedUnitIdB}
                pointerRef={pointerRef}
                scrollRafRef={scrollRafRef}
                draggingRef={draggingRef}
                // Attack Helper wiring
                attackHelper={attackHelper}
                setAttackHelper={setAttackHelper}
                pulseTargetId={pulseTargetId}
                setPulseTargetId={setPulseTargetId}
              />
            ) : (
              <div className="empty-army">
                <p>No armies yet. Add one to begin.</p>
              </div>
            )}
          </div>
        </aside>
      </div>
      {isNarrow && overlayOpen && selectedUnit ? (
        <div
          className="datasheet-overlay"
          role="dialog"
          aria-label="Datasheet Overlay"
        >
          <button
            type="button"
            className="overlay-close"
            aria-label="Close Datasheet"
            onClick={() => setOverlayOpen(false)}
          ></button>
          {selectedUnit ? renderAttackHelper() : null}
          <UnitDatasheet
            unit={selectedUnit}
            isSelected={true}
            onClick={() => {}}
            overrides={
              leadershipOverrides[selectedUnit.id] || {
                canLead: "auto",
                canBeLed: "auto",
                allowList: [],
              }
            }
            allUnits={allUnits}
            onUpdateOverrides={(partial) =>
              updateUnitOverrides(selectedUnit.id, partial)
            }
            // Attack Helper props
            attackHelper={attackHelper}
            onToggleWeapon={(section, index, weapon) => {
              setAttackHelper((prev) => {
                const same =
                  prev.open &&
                  prev.attackerUnitId === selectedUnit.id &&
                  prev.section === section &&
                  prev.index === index;
                if (same)
                  return {
                    open: false,
                    section: null,
                    index: null,
                    modelsInRange: null,
                    targetUnitId: null,
                    attackerUnitId: null,
                    intent: "idle",
                    showExpected: prev.showExpected,
                  };
                const defaultModels = resolveWeaponCarrierCount(
                  selectedUnit,
                  weapon,
                );
                const nextTargetId =
                  prev.targetUnitId ||
                  (selectedUnit?.column === "A"
                    ? pinnedUnitIdB || (rightUnit ? rightUnit.id : null)
                    : pinnedUnitIdA || (leftUnit ? leftUnit.id : null));
                const hasTarget = !!nextTargetId;
                return {
                  open: true,
                  section,
                  index,
                  modelsInRange: defaultModels,
                  targetUnitId: nextTargetId,
                  attackerUnitId: selectedUnit.id,
                  intent: hasTarget ? "open_with_target" : "open_no_target",
                };
              });
            }}
            onCloseAttackHelper={() =>
              setAttackHelper({
                open: false,
                section: null,
                index: null,
                modelsInRange: null,
                targetUnitId: null,
                intent: "idle",
              })
            }
            onChangeModelsInRange={(val) =>
              setAttackHelper((prev) => ({
                ...prev,
                modelsInRange: Math.max(1, Number(val) || 1),
              }))
            }
            onToggleExpected={() =>
              setAttackHelper((prev) => ({
                ...prev,
                showExpected: !prev.showExpected,
              }))
            }
            selectedTargetUnit={
              attackHelper.targetUnitId
                ? allUnitsById[attackHelper.targetUnitId]
                : null
            }
          />
        </div>
      ) : null}
    </div>
  );
};

export default GameSession;
