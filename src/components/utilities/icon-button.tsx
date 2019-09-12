import * as React from "react";

interface IconButtonProps {
  icon: string;
  key: string;
  className: string;
  onClickButton: () => void;
  url?: string;
}

export const IconButton = (props: IconButtonProps) => {
  const styleIcon = {
    backgroundImage: `url(${props.url})`
  };
  return (
    <button
      id={`icon-${props.icon}`}
      className={`icon-button ${props.className}`}
      onClick={props.onClickButton}
      data-test={`${props.icon}-icon`}
    >
      <div
        className={`${props.icon}`}
        style={props.url ? styleIcon : undefined}
      />
    </button>
  );
};
