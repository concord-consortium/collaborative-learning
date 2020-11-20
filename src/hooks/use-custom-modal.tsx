import classNames from "classnames";
import React from "react";
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
  // defined left-to-right, e.g. Extra Button, Cancel, OK
  buttons: Array<{
    className?: string;
    label: string | React.FC<any>;
    onClick: (() => void) | "cancel";
    isDefault?: boolean;
  }>;
  dependencies?: any[];
}
export const useCustomModal = ({
  className, Icon, title, Content, focusElement, buttons, dependencies
}: IProps) => {

  const handleAfterOpen = ({overlayEl, contentEl}: { overlayEl: Element, contentEl: HTMLDivElement }) => {
    if (focusElement) {
      const element = contentEl.querySelector(focusElement);
      (element as HTMLElement)?.focus();
    }
  };

  const [showModal, hideModal] = useModal(() => (
    <Modal className={`custom-modal ${className}`} isOpen
            onAfterOpen={handleAfterOpen as any} onRequestClose={hideModal}>
      <div className="modal-header">
        <div className="modal-icon">
          {Icon && <Icon/>}
        </div>
        <div className="modal-title">{title}</div>
        <button type="button" className="modal-close" onClick={hideModal}>
          <CloseIconSvg />
        </button>
      </div>
      <div className="modal-content">
        <Content/>
      </div>
      <div className="modal-footer">
        {buttons.map((b, i) => {
          const classes = classNames("modal-button", b.className);
          const key = `${i}-${b.className}`;
          const handleClick = b.onClick === "cancel" ? hideModal : b.onClick;
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
