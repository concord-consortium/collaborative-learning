import React from "react";

import "./dataflow-program-zoom.scss";

interface ZoomProps {
  onZoomInClick: () => void;
  onZoomOutClick: () => void;
  disabled: boolean;
}

export const DataflowProgramZoom = (props: ZoomProps) => {
  return (
    <div className="program-editor-zoom">
      <button
        title="Zoom In"
        aria-label="Zoom In"
        onClick={props.onZoomInClick}
        disabled={props.disabled}
        data-testid="zoom-in-button"
      >
        <span>+</span>
      </button>
      <button
        title="Zoom Out"
        aria-label="Zoom Out"
        onClick={props.onZoomOutClick}
        disabled={props.disabled}
        data-testid="zoom-out-button"
      >
        <span>–</span>
      </button>
    </div>
  );
};
