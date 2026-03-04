import React from "react";

export const StatusAndOutput: React.FC = () => {
  return (
    <div className="wave-runner-section status-and-output">
      <div className="wave-runner-section-title">Status and Output</div>
      <div className="status-waveform-placeholder">
        Finish&nbsp;<b>Data Setup</b>&nbsp;to see the waveform. Then run the model.
      </div>
      <div className="status-waveform-spacer" />
      <div className="status-estimated-time">
        Estimated time to complete run:
      </div>
      <div className="status-counts-row">
        <div className="status-count">
          <label className="status-count-label">Events Identified</label>
          <div className="status-count-box" />
        </div>
        <div className="status-count">
          <label className="status-count-label">Event Categories</label>
          <div className="status-count-box" />
        </div>
      </div>
    </div>
  );
};
