import React from "react";
import UploadDropzone from "./UploadDropzone";

export default function ArmySidebar({
  columnKey, // 'A' | 'B'
  displayName,
  inputRef,
  hasArmy,
  uploadError,
  onFileInputChange, // (columnKey, event) => void
  onDragOverZone,
  onDropZone, // (columnKey, event) => void
  children,
}) {
  const label = columnKey === "A" ? "Army A" : "Army B";
  const playerLabel = columnKey === "A" ? "Player A" : "Player B";
  const asideId = columnKey === "A" ? "armyA" : "armyB";

  return (
    <aside
      className="units-sidebar army-column"
      id={asideId}
      aria-label={label}
    >
      <div className="column-header">
        <h3>
          {playerLabel} — {displayName || playerLabel}
        </h3>
        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          style={{ display: "none" }}
          aria-label={`Upload army file for ${playerLabel}`}
          onChange={(e) => onFileInputChange?.(columnKey, e)}
        />
        {hasArmy ? (
          <button
            className="action-btn"
            onClick={() => inputRef?.current?.click()}
          >
            Replace army
          </button>
        ) : null}
      </div>
      <div className="units-scroll">
        {!hasArmy && (
          <UploadDropzone
            columnKey={columnKey}
            inputRef={inputRef}
            uploadError={uploadError}
            onDragOver={onDragOverZone}
            onDrop={(e) => onDropZone?.(columnKey, e)}
            onClick={() => inputRef?.current?.click()}
          />
        )}
        {children}
      </div>
    </aside>
  );
}
