import React from "react";
import "./confirm-modal.scss";

interface Props {
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Minimal self-contained confirmation overlay. */
export function ConfirmModal({ message, confirmLabel = "Confirm", onConfirm, onCancel }: Props) {
  return (
    <div className="confirm-modal-overlay" onClick={onCancel}>
      <div className="confirm-modal" onClick={e => e.stopPropagation()}>
        <div className="confirm-message">{message}</div>
        <div className="confirm-buttons">
          <button onClick={onCancel}>Cancel</button>
          <button className="danger" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
