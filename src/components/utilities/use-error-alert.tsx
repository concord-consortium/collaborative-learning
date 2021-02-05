import React, { useCallback } from "react";
import ErrorSvg from "../../assets/icons/error.svg";
import { useCustomModal } from "../../hooks/use-custom-modal";

import "./error-alert.scss";

export interface IErrorAlertProps {
  className?: string;
  title?: string;
  content: string | React.FC<any>;
  canCancel?: boolean;
  buttonLabel?: string;
  onClick?: () => void;
  onClose?: () => void;
}

export const useErrorAlert = ({
  className, title, content, canCancel, buttonLabel, onClick, onClose
}: IErrorAlertProps) => {

  const TextContent: React.FC = useCallback(() => {
    return <p>{content}</p>;
  }, [content]);
  const Content = typeof content === "string"
                    ? TextContent
                    : content;

  const [showAlert, hideAlert] = useCustomModal({
    className: `error-alert ${className || ""}`,
    title: title || "",
    Icon: ErrorSvg,
    Content,
    contentProps: {},
    canCancel,
    buttons: [
      { label: buttonLabel || "OK", isDefault: true, onClick }
    ],
    onClose
  });

  return [showAlert, hideAlert];
};
