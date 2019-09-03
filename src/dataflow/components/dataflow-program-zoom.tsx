import * as React from "react";

import "./dataflow-program-zoom.sass";

interface ZoomProps {
  onZoomInClick: () => void;
  onZoomOutClick: () => void;
  disabled: boolean;
}

export const DataflowProgramZoom = (props: ZoomProps) => {
  return (
    <div className="program-editor-zoom">
      <button
        onClick={props.onZoomInClick}
        disabled={props.disabled}
      >
        +
      </button>
      <button
        onClick={props.onZoomOutClick}
        disabled={props.disabled}
      >
        -
      </button>
    </div>
  );
};
