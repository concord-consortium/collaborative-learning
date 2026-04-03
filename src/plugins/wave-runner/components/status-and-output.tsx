import React from "react";
import { observer } from "mobx-react";
import { useWaveRunnerContent } from "../hooks/use-wave-runner-content";
import { WaveformPanel } from "../../shared-seismogram/components/waveform-panel";
import "./status-and-output.scss";

export const StatusAndOutput: React.FC = observer(function StatusAndOutput() {
  const model = useWaveRunnerContent();
  const { hasStationData, sharedSeismogram, startDateISO, endDateISO } = model;

  return (
    <div className="section status-and-output">
      <div className="section-title">Status and Output</div>
      <div className="waveform-container">
        {sharedSeismogram && hasStationData && (
          <WaveformPanel
            key={`${model.startDate}-${model.endDate}`}
            label={`${model.startDate} – ${model.endDate}`}
            sharedSeismogram={sharedSeismogram}
            startTime={startDateISO}
            endTime={endDateISO}
          />
        )}
      </div>
      <div className="download-status-container">
        {model.isRunning && <div>Running model...</div>}
        {model.runError && <div className="waveform-error">{model.runError}</div>}
      </div>
      <div className="estimated-time">
        {model.isRunning
          ? `Processing day ${model.chunksProcessed + 1} of ${model.chunksTotal || "?"}...`
          : model.eventsFound
            ? "Run complete."
            : "Estimated time to complete run:"}
      </div>
      <div className="status-counts-row">
        <div className="status-count">
          <label className="status-count-label">Events Identified</label>
          <div className="status-count-box">{model.eventsFound ?? ""}</div>
        </div>
        <div className="status-count">
          <label className="status-count-label">Event Categories</label>
          <div className="status-count-box" />
        </div>
      </div>
    </div>
  );
});
