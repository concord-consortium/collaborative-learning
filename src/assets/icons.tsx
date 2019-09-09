import * as React from "react";

interface IconButtonProps {
  icon: string;
  key: string;
  className: string;
  onClickButton: () => void;
  url?: string;
}

export const IconButton = (props: IconButtonProps) => {
  const styleButton = {
    fontSize: "100%",
    fontFamily: "inherit",
    border: 0,
    padding: 0
  };
  const styleIcon = {
    backgroundImage: `url(${props.url})`
  };
  return (
    <button
      id={`icon-${props.icon}`}
      className={props.className}
      onClick={props.onClickButton}
      data-test={`${props.icon}-icon`}
      style={styleButton}
    >
      <div
        className={`icon ${props.icon}`}
        style={props.url ? styleIcon : undefined}
      />
    </button>
  );
};
