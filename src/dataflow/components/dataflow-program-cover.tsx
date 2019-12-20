import * as React from "react";

import "./dataflow-program-cover.sass";

interface CoverProps {
  editorClass: string;
  isRunning: boolean;
}

export const DataflowProgramCover = (props: CoverProps) => {
  const coverClass = `cover ${props.editorClass} ${(props.isRunning ? "running" : "")}`;
  return (
    <div className={coverClass}/>
  );
};
