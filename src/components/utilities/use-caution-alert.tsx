import React from "react";
import CautionSvg from "../../assets/icons/caution.svg";
import { useCustomModal } from "../../hooks/use-custom-modal";

import "./error-alert.scss";

interface IProps {
  className?: string;
  title?: string;
  content: string | React.FC<any>;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onClose?: () => void;
}

interface ITextProps {
  content: string;
}
const TextContent: React.FC<ITextProps> = ({ content }) => {
  return <p>{content}</p>;
};

export const useCautionAlert = (props: IProps) => {
  const { className, title, content, confirmLabel, cancelLabel, onConfirm, onClose } = props;


  const Content = typeof content === "string"
                    ? TextContent
                    : content;
  const contentProps = typeof content === "string" ? { content } : {};

  const [showAlert, hideAlert] = useCustomModal({
    className: `error-alert ${className || ""}`,
    title: title || "",
    Icon: CautionSvg,
    Content,
    contentProps,
    buttons: [
      { label: cancelLabel || "Cancel", dataTestId: "cancel-button" },
      { label: confirmLabel || "OK", isDefault: true, onClick: onConfirm, dataTestId: "confirm-button" }
    ],
    onClose
  }, [onClose, onConfirm]);

  return [showAlert, hideAlert];
};
