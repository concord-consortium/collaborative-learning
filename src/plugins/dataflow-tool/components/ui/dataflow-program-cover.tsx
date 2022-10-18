import React from "react";

import "./dataflow-program-cover.scss";

interface CoverProps {
  editorClass: string;
}

export const DataflowProgramCover = (props: CoverProps) => {
  const coverClass = `cover ${props.editorClass} running`;
  return (
    <div className={coverClass}/>
  );
};
