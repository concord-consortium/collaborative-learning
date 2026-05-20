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
    // `content` is narrowed to string by the surrounding ternary, but TS can't see through
    // useCallback so we re-narrow here for the React 18 ReactNode typing.
    return <p>{typeof content === "string" ? content : null}</p>;
  }, [content]);
  const Content = typeof content === "string"
                    ? TextContent
                    : content;

  const [showAlert, hideAlert] = useCustomModal({
    className: `error-alert ${className || ""}`,
    title: title || "Uh oh!",
    Icon: ErrorSvg,
    Content,
    contentProps: {},
    canCancel,
    buttons: onClick ? [
      { label: buttonLabel || "OK", isDefault: true, onClick }
    ] : [],
    onClose,
    dataTestId: "error-alert"
  });

  return [showAlert, hideAlert];
};
