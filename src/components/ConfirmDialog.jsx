import React from "react";

const ConfirmDialog = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "Delete",
  cancelText = "Cancel",
  isDestructive = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="confirm-dialog-overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-dialog-header">
          <h3>{title}</h3>
        </div>

        <div className="confirm-dialog-body">
          <p>{message}</p>
        </div>

        <div className="confirm-dialog-actions">
          <button onClick={onCancel} className="cancel-btn">
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`confirm-btn ${isDestructive ? "destructive" : ""}`}
          >
            {confirmText}
          </button>
        </div>
      </div>

      <style>{`
        .confirm-dialog-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .confirm-dialog {
          background: white;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          max-width: 400px;
          width: 90%;
          max-height: 90vh;
          overflow: hidden;
        }

        .confirm-dialog-header {
          padding: 1.5rem 1.5rem 0 1.5rem;
        }

        .confirm-dialog-header h3 {
          margin: 0;
          color: #2c3e50;
          font-size: 1.25rem;
        }

        .confirm-dialog-body {
          padding: 1rem 1.5rem;
          color: #666;
          line-height: 1.5;
        }

        .confirm-dialog-body p {
          margin: 0;
        }

        .confirm-dialog-actions {
          padding: 1rem 1.5rem 1.5rem 1.5rem;
          display: flex;
          gap: 1rem;
          justify-content: flex-end;
        }

        .cancel-btn {
          background: #95a5a6;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }

        .cancel-btn:hover {
          background: #7f8c8d;
        }

        .confirm-btn {
          background: #3498db;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          font-weight: bold;
        }

        .confirm-btn:hover {
          background: #2980b9;
        }

        .confirm-btn.destructive {
          background: #e74c3c;
        }

        .confirm-btn.destructive:hover {
          background: #c0392b;
        }

        @media (max-width: 480px) {
          .confirm-dialog-actions {
            flex-direction: column-reverse;
          }

          .cancel-btn, .confirm-btn {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default ConfirmDialog;
