import * as React from "react";

interface IProps {
  icon: string;
  title?: string;
  className: string;
  style?: React.CSSProperties;
  onClickButton?: () => void;
  enabled?: boolean;
  dataTestName?: string;
  children: React.ReactNode;
}

export const IconButtonSvg = (props: IProps) => {
  return (
    <button
      title={props.title}
      className={`icon-button ${props.className}`}
      style={props.style}
      onClick={props.onClickButton}
      data-test={props.dataTestName || `${props.icon}-icon`}
    >
      {props.children}
    </button>
  );
};
