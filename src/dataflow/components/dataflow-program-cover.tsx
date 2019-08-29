import * as React from "react";

import "./dataflow-program-cover.sass";

interface CoverProps {
  onStopProgramClick: () => void;
  runningProgram: boolean;
  sideBySide: boolean;
}

export const DataflowProgramCover = (props: CoverProps) => {
  const coverClass = props.sideBySide ? "cover" : "cover full";
  return (
    <div className={coverClass}>
      { props.runningProgram &&
        <button className="stop" onClick={props.onStopProgramClick}>
          Stop
        </button>
      }
    </div>
  );
};
