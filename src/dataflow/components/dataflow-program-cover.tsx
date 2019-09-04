import * as React from "react";

import "./dataflow-program-cover.sass";

interface CoverProps {
  sideBySide: boolean;
}

export const DataflowProgramCover = (props: CoverProps) => {
  const coverClass = `cover ${(!props.sideBySide && "full")}`;
  return (
    <div className={coverClass}/>
  );
};
