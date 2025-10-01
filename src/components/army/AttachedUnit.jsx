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
      className={`attached-unit unit-card ${isSelected ? "selected" : ""} ${statusClass} ${
        insertEdge === "top" ? "drag-over-before" : ""
      } ${insertEdge === "bottom" ? "drag-over-after" : ""} ${pulse ? "pulse" : ""}`}
      data-column={unit.column}
      data-unit-id={unit.id}
      onClick={() => onClick(unit)}
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

export default AttachedUnit;
