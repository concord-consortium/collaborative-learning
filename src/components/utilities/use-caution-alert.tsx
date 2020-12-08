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

export const useCautionAlert = ({
  className, title, content, confirmLabel, cancelLabel, onConfirm, onClose
}: IProps) => {

  const Content = typeof content === "string"
                    ? TextContent
                    : content;
  const contentProps = typeof content === "string" ? { content } : {};

  const handleConfirm = () => {
    onConfirm();
    hideAlert();
  };

  const [showAlert, hideAlert] = useCustomModal({
    className: `error-alert ${className || ""}`,
    title: title || "",
    Icon: CautionSvg,
    Content,
    contentProps,
    buttons: [
      { label: cancelLabel || "Cancel", onClick: "close" },
      { label: confirmLabel || "OK", isDefault: true, onClick: handleConfirm }
    ],
    onClose
  });

  return [showAlert, hideAlert];
};
