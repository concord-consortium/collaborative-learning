import classNames from "classnames";
import React, { useCallback, useRef } from "react";
import Modal from "react-modal";
import { useModal } from "react-modal-hook";
import CloseIconSvg from "../assets/icons/close/close.svg";

import "./custom-modal.scss";

// constant for use as return value from client onClick handlers
export const kLeaveModalOpen = true;

interface IModalButton {
  className?: string;
  label: string | React.FC<any>;
  isDefault?: boolean;
  isDisabled?: boolean;
  onClick?: (() => void) | (() => boolean); // close dialog on falsy return value
}

const invokeButton = (button: IModalButton, onClose: () => void) => {
  // close dialog on falsy return value from onClick
  !button.isDisabled && !button.onClick?.() && onClose();
};

interface IProps<IContentProps> {
  className?: string;
  title: string | React.FC<any>;
  Icon?: React.FC<any>;
  Content: React.FC<IContentProps>;
  contentProps: IContentProps;
  focusElement?: string;
  canCancel?: boolean;
  // defined left-to-right, e.g. Extra Button, Cancel, OK
  buttons: IModalButton[];
  onClose?: () => void;
}
export const useCustomModal = <IContentProps,>({
  className, Icon, title, Content, contentProps, focusElement, canCancel, buttons, onClose
}: IProps<IContentProps>, dependencies?: any[]) => {

  const contentElt = useRef<HTMLDivElement>();
  const hideModalRef = useRef<() => void>();
  const handleCloseRef = useRef<() => void>(() => hideModalRef.current?.());

  const blurModal = useCallback(() => {
    // focusing the content element blurs any input control
    contentElt.current?.focus();
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Enter") {
      const defaultButton = buttons.find(b => b.isDefault);
      if (defaultButton && !defaultButton.isDisabled) {
        blurModal();
        // useRef to avoid circular dependencies
        invokeButton(defaultButton, handleCloseRef.current);
        e.stopPropagation();
        e.preventDefault();
      }
    }
  }, [blurModal, buttons, handleCloseRef]);

  const handleAfterOpen = ({overlayEl, contentEl}: { overlayEl: Element, contentEl: HTMLDivElement }) => {
    contentElt.current = contentEl;

    contentEl.addEventListener("keydown", handleKeyDown, true);

    const element = focusElement && contentEl.querySelector(focusElement) as HTMLElement|| contentEl;
    element && setTimeout(() => {
      element.focus?.();
      (element as HTMLInputElement).select?.();
    });
  };

  const handleClose = useCallback(() => {
    contentElt.current?.removeEventListener("keydown", handleKeyDown, true);
    hideModalRef.current?.();
  }, [handleKeyDown]);
  handleCloseRef.current = handleClose;

  const [showModal, hideModal] = useModal(() => {
    return (
      <Modal className={`custom-modal ${className || ""}`} isOpen
              shouldCloseOnEsc={canCancel}
              shouldCloseOnOverlayClick={false}
              onAfterOpen={handleAfterOpen as any}
              onRequestClose={handleClose} onAfterClose={onClose}>
        <div className="modal-header">
          <div className="modal-icon">
            {Icon && <Icon/>}
          </div>
          <div className="modal-title">{title}</div>
          {canCancel !== false &&
            <button type="button" className="modal-close" onClick={handleClose}>
              <CloseIconSvg />
            </button>}
        </div>
        <div className="modal-content">
          <Content {...(contentProps)}/>
        </div>
        <div className="modal-footer">
          {buttons.map((b, i) => {
            const classes = classNames("modal-button", b.className, { default: b.isDefault, disabled: b.isDisabled });
            const key = `${i}-${b.className}`;
            const handleClick = () => invokeButton(b, handleClose);
            return (
              <button type="button" className={classes} key={key} onClick={handleClick}>
                {b.label}
              </button>
            );
          })}
        </div>
      </Modal>
    );
  }, dependencies);
  hideModalRef.current = hideModal;

  return [showModal, handleClose, blurModal];
};
