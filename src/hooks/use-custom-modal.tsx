import classNames from "classnames";
import React, { useCallback, useEffect, useRef } from "react";
import Modal from "react-modal";
import { useModal } from "react-modal-hook";
import CloseIconSvg from "../assets/icons/close/close.svg";

import "./custom-modal.scss";

interface IProps {
  className?: string;
  title: string | React.FC<any>;
  Icon?: React.FC<any>;
  Content: React.FC<any>;
  focusElement?: string;
  canCancel?: boolean;
  // defined left-to-right, e.g. Extra Button, Cancel, OK
  buttons: Array<{
    className?: string;
    label: string | React.FC<any>;
    onClick: (() => void) | "close";
    isDefault?: boolean;
  }>;
  onClose?: () => void;
}
export const useCustomModal = ({
  className, Icon, title, Content, focusElement, canCancel, buttons, onClose
}: IProps, dependencies?: any[]) => {

  const contentElt = useRef<HTMLDivElement>();

  const handleAfterOpen = ({overlayEl, contentEl}: { overlayEl: Element, contentEl: HTMLDivElement }) => {
    contentElt.current = contentEl;
    const element = focusElement && contentEl.querySelector(focusElement) || contentEl;
    setTimeout(() => (element as HTMLElement)?.focus());
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Enter") {
      const defaultButton = buttons.find(b => b.isDefault);
      if (defaultButton && (typeof defaultButton.onClick !== "string")) {
        defaultButton.onClick();
        e.stopPropagation();
        e.preventDefault();
      }
    }
  }, [buttons]);

  const isKeyDownHandlerInstalled = useRef(false);
  useEffect(() => {
    if (!isKeyDownHandlerInstalled.current && contentElt.current) {
      contentElt.current.addEventListener("keydown", handleKeyDown);
      isKeyDownHandlerInstalled.current = true;
    }
    return () => isKeyDownHandlerInstalled.current
                  ? contentElt.current?.removeEventListener("keydown", handleKeyDown)
                  : undefined;
  }, [handleKeyDown]);

  const [showModal, hideModal] = useModal(() => (
    <Modal className={`custom-modal ${className || ""}`} isOpen
            shouldCloseOnEsc={canCancel}
            shouldCloseOnOverlayClick={false}
            onAfterOpen={handleAfterOpen as any}
            onRequestClose={hideModal} onAfterClose={onClose}>
      <div className="modal-header">
        <div className="modal-icon">
          {Icon && <Icon/>}
        </div>
        <div className="modal-title">{title}</div>
        {canCancel !== false &&
          <button type="button" className="modal-close" onClick={hideModal}>
            <CloseIconSvg />
          </button>}
      </div>
      <div className="modal-content">
        <Content/>
      </div>
      <div className="modal-footer">
        {buttons.map((b, i) => {
          const classes = classNames("modal-button", b.className, { default: b.isDefault });
          const key = `${i}-${b.className}`;
          const handleClick = b.onClick === "close" ? hideModal : b.onClick;
          return (
            <button type="button" className={classes} key={key} onClick={handleClick}>
              {b.label}
            </button>
          );
        })}
      </div>
    </Modal>
  ), dependencies);
  return [showModal, hideModal];
};
