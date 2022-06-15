import React from "react";
import "./dataflow-open-program-button.sass";

interface IProps {
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

export const DataflowOpenProgramButton: React.FunctionComponent<IProps> =
        ({ className, onClick}: IProps) => {
  const classes = "open-program " + (className || "");
  return (
    <button className={classes} onClick={onClick} />
  );
};
