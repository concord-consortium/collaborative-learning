import React, { ReactNode } from "react";
import clsx from "clsx";

import "./timeline-button.scss";

interface ITimelineButtonProps {
  children?: ReactNode | ReactNode[];
  className?: string;
  disabled?: boolean;
  onClick: () => void;
}
export function TimelineButton({ children, className, disabled, onClick }: ITimelineButtonProps) {
  return (
    <button className={clsx("timeline-button", className)} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}
