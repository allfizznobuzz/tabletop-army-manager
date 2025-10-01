import React from "react";

export default function UploadDropzone({
  columnKey, // 'A' | 'B'
  inputRef,
  uploadError,
  onDragOver,
  onDrop,
  onClick,
}) {
  const aria =
    columnKey === "A"
      ? "Upload army file dropzone for Player A"
      : "Upload army file dropzone for Player B";
  return (
    <div
      className="upload-dropzone"
      role="button"
      aria-label={aria}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onClick}
    >
      <p>
        <strong>Upload army file</strong>
      </p>
      <p>Click to select or drag & drop a .json file</p>
      {uploadError ? <div className="error-message">{uploadError}</div> : null}
    </div>
  );
}
