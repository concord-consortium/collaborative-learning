import React from "react";

import "./dataflow-program-zoom.scss";

interface ZoomProps {
  onZoomInClick: () => void;
  onZoomOutClick: () => void;
  disabled: boolean;
}

export const DataflowProgramZoom = (props: ZoomProps) => {
  return (
    <div className="program-editor-zoom" onScroll={() => console.log(`zoom`)} >
      <button
        title={"Zoom In"}
        onClick={props.onZoomInClick}
        disabled={props.disabled}
      >
        +
      </button>
      <button
        title={"Zoom Out"}
        onClick={props.onZoomOutClick}
        disabled={props.disabled}
      >
        -
      </button>
    </div>
  );
};
