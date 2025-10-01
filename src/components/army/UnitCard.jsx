import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Safe wrapper around useSortable so tests or mocks won't crash destructuring
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
      style={{ ...style, zIndex: isDragging ? 20 : "auto" }}
      className={`unit-card ${isSelected ? "selected" : ""} ${statusClass} ${
        shouldGlowAsLeader ? "can-attach" : ""
      } ${dropIntent ? "drop-intent" : ""} ${insertEdge === "top" ? "drag-over-before" : ""} ${
        insertEdge === "bottom" ? "drag-over-after" : ""
      } ${pulse ? "pulse" : ""}`}
      data-column={unit.column}
      data-unit-id={unit.id}
      title={titleText}
      role="button"
      tabIndex={0}
      onClick={() => onClick(unit)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick(unit);
      }}
    >
      <div
        className="between-slot top"
        aria-hidden="true"
        data-target-id={unit.id}
        data-edge="top"
        data-scope="top"
      />
      <div
        className="between-slot bottom"
        aria-hidden="true"
        data-target-id={unit.id}
        data-edge="bottom"
        data-scope="top"
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
      <div className="attach-zone" />
      <h4>{unit.name}</h4>
    </div>
  );
};

SortableUnitBase.displayName = "SortableUnit";
export const SortableUnit = React.memo(SortableUnitBase);

export default SortableUnit;
