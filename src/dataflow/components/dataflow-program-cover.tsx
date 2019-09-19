import * as React from "react";

import "./dataflow-program-cover.sass";

interface CoverProps {
  sideBySide: boolean;
  isRunning: boolean;
}

export const DataflowProgramCover = (props: CoverProps) => {
  const coverClass = `cover ${(!props.sideBySide && "full")} ${(props.isRunning && "running")}`;
  return (
    <div className={coverClass}/>
  );
};
