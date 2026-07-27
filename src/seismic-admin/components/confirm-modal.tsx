import React from "react";
import "./confirm-modal.scss";

interface Props {
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({ message, confirmLabel = "Confirm", onConfirm, onCancel }: Props) {
  return (
    <div className="confirm-modal-overlay" onClick={onCancel}>
      <div aria-modal="true" className="confirm-modal" onClick={e => e.stopPropagation()} role="dialog">
        <div className="confirm-message">{message}</div>
        <div className="confirm-buttons">
          <button onClick={onCancel}>Cancel</button>
          <button className="danger" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
