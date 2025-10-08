import React, { useEffect } from "react";

import "./modal.scss";

type Props = React.PropsWithChildren<{
  title: string;
  onClose: () => void;
}>

const Modal: React.FC<Props> = ({ title, onClose, children }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <>
      <div className="modal-backdrop" />
      <div className="modal">
        <div className="modal-titlebar">
          <span>{title}</span>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-content">
          {children}
        </div>
      </div>
    </>
  );
};

export default Modal;
