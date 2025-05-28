import classNames from "classnames";
import React, { useCallback, useEffect, useRef, useState } from "react";
import Modal from "react-modal";
import { useModal } from "react-modal-hook";
import CloseIconSvg from "../assets/icons/close/close.svg";

import "./custom-modal.scss";

// constant for use as return value from client onClick handlers
export const kLeaveModalOpen = true;

export interface IModalButton {
  className?: string;
  label: string | React.FC<any>;
  isDefault?: boolean;
  isDisabled?: boolean;
  onClick?: (() => void) | (() => boolean); // close dialog on falsy return value
  dataTestId?: string;
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
  dataTestId?: string;
}
export const useCustomModal = <IContentProps,>({
  className, Icon, title, Content, contentProps, focusElement, canCancel, buttons,
  onClose, dataTestId
}: IProps<IContentProps>, dependencies?: any[]) => {

  const [contentElt, setContentElt] = useState<HTMLDivElement>();
  const hideModalRef = useRef<() => void>();
  const handleCloseRef = useRef<() => void>(() => hideModalRef.current?.());

  const blurModal = useCallback(() => {
    // focusing the content element blurs any input control
    contentElt?.focus();
  }, [contentElt]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !(e.target instanceof HTMLTextAreaElement)) {
        const defaultButton = buttons.find(b => b.isDefault);
        if (defaultButton && !defaultButton.isDisabled) {
          blurModal();
          // useRef to avoid circular dependencies
          invokeButton(defaultButton, handleCloseRef.current);
          e.stopPropagation();
          e.preventDefault();
        }
      }
    };

    contentElt?.addEventListener("keydown", handleKeyDown, true);
    return () => contentElt?.removeEventListener("keydown", handleKeyDown, true);
  }, [blurModal, buttons, contentElt]);

  const handleAfterOpen = ({overlayEl, contentEl}: { overlayEl: Element, contentEl: HTMLDivElement }) => {
    setContentElt(contentEl);

    const element = focusElement && contentEl.querySelector(focusElement) as HTMLElement || contentEl;
    element && setTimeout(() => {
      element.focus?.();
      (element as HTMLInputElement).select?.();
    });
  };

  const handleClose = useCallback(() => {
    hideModalRef.current?.();
  }, []);
  handleCloseRef.current = handleClose;

  const [showModal, hideModal] = useModal(() => {
    // NOTE: the data-testid attribute is not passed to the modal element
    // because it is not a valid attribute for ReactModal and instead
    // is passed to the modal header and content elements to allow for testing
    return (
      <Modal className={`custom-modal ${className || ""}`} isOpen
              shouldCloseOnEsc={canCancel}
              shouldCloseOnOverlayClick={false}
              onAfterOpen={handleAfterOpen as any}
              onRequestClose={handleClose} onAfterClose={onClose}>
        <div className="modal-header" data-testid={dataTestId && `${dataTestId}-header`}>
          <div className="modal-icon">
            {Icon && <Icon/>}
          </div>
          <div className="modal-title">{title}</div>
          {canCancel !== false &&
            <button type="button" className="modal-close" onClick={handleClose}>
              <CloseIconSvg />
            </button>}
        </div>
        <div className="modal-content" data-testid={dataTestId && `${dataTestId}-content`}>
          { /* TODO Fix type cast */ }
          <Content as any {...(contentProps)}/>
        </div>
        {buttons.length > 0 &&
          <div className="modal-footer">
            {buttons.map((b, i) => {
              const classes = classNames("modal-button", b.className, { default: b.isDefault, disabled: b.isDisabled });
              const key = `${i}-${b.className}`;
              const handleClick = () => invokeButton(b, handleClose);
              return (
                <button type="button" className={classes} key={key} onClick={handleClick} {...(b.dataTestId ? { 'data-testid': b.dataTestId } : {})}>
                  {b.label}
                </button>
              );
            })}
          </div>
        }
      </Modal>
    );
  }, dependencies);
  hideModalRef.current = hideModal;

  return [showModal, handleClose, blurModal];
};
