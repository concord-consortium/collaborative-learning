import React from "react";
import CautionSvg from "../../assets/icons/caution.svg";
import { useCustomModal } from "../../hooks/use-custom-modal";

import "./error-alert.scss";

interface IProps {
  className?: string;
  title?: string;
  content: string | React.FC<any>;
  confirmLabel?: string;
  optionLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onOption?: () => void
  onClose?: () => void;
}

interface ITextProps {
  content: string;
}
const TextContent: React.FC<ITextProps> = ({ content }) => {
  return <p>{content}</p>;
};

export const useCautionAlert = ({
  className, title, content, optionLabel, confirmLabel, cancelLabel, onOption, onConfirm, onClose
}: IProps) => {

  const Content = typeof content === "string"
                    ? TextContent
                    : content;
  const contentProps = typeof content === "string" ? { content } : {};
  const buttons = optionLabel
                    ? [
                        { label: optionLabel, onClick: onOption},
                        { label: confirmLabel || "OK", isDefault: true, onClick: onConfirm },
                        { label: cancelLabel || "Cancel" }
                      ]
                    : [
                      { label: cancelLabel || "Cancel" },
                        { label: confirmLabel || "OK", isDefault: true, onClick: onConfirm }
                      ];

  const [showAlert, hideAlert] = useCustomModal({
    className: `error-alert ${className || ""}`,
    title: title || "",
    Icon: CautionSvg,
    Content,
    contentProps,
    buttons,
    onClose
  }, [onClose, onConfirm, onOption]);

  return [showAlert, hideAlert];
};
