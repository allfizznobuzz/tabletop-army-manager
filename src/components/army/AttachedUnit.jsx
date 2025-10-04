import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Safe wrapper around useSortable
const useSafeSortable = (id) => {
  try {
    const v = useSortable({ id });
    if (v && typeof v === "object") return v;
  } catch (e) {
    // ignore
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

const AttachedUnit = ({
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
  stickDy = 0,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSafeSortable(unit.id);
  const base = CSS.Transform.toString(transform) || "";
  const offset =
    typeof stickDy === "number" && stickDy !== 0
      ? `translate3d(0, ${Math.round(stickDy)}px, 0)`
      : "";
  const composed = offset
    ? `${offset}${base ? ` ${base}` : ""}`
    : base || undefined;
  const style = {
    transform: composed,
    transition: offset ? "none" : transition,
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
      className={`attached-unit unit-card ${isSelected ? "selected" : ""} ${statusClass} ${
        insertEdge === "top" ? "drag-over-before" : ""
      } ${insertEdge === "bottom" ? "drag-over-after" : ""} ${pulse ? "pulse" : ""}`}
      data-column={unit.column}
      data-unit-id={unit.id}
      onClick={() => onClick(unit)}
      {...attributes}
      {...listeners}
    >
      <div
        className="between-slot top"
        aria-hidden="true"
        data-target-id={unit.id}
        data-edge="top"
        data-scope="children"
        data-leader-id={leaderId}
      />
      <div
        className="between-slot bottom"
        aria-hidden="true"
        data-target-id={unit.id}
        data-edge="bottom"
        data-scope="children"
        data-leader-id={leaderId}
      />

      {/* Suppress override tags on attached units */}

      {/* Drag handle removed for attached units; whole card is draggable */}
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

export default AttachedUnit;
