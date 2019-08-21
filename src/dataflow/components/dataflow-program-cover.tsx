import * as React from "react";

import "./dataflow-program-cover.sass";

interface CoverProps {
  onStopProgramClick: () => void;
}

export const DataflowProgramCover = (props: CoverProps) => {
  return (
    <div className="cover">
      <button className="stop" onClick={props.onStopProgramClick}>
        Stop
      </button>
    </div>
  );
};
