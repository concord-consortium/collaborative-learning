import React from "react";
import { observer } from "mobx-react";
import { DateTime } from "luxon";
import { useWaveRunnerContent } from "../hooks/use-wave-runner-content";
import { WaveformPanel } from "../../shared-seismogram/components/waveform-panel";
import "./status-and-output.scss";

export const StatusAndOutput: React.FC = observer(function StatusAndOutput() {
  const model = useWaveRunnerContent();
  const sharedSeismogram = model.sharedSeismogram;
  const hasStation = model.hasStationData;

  const startTime = DateTime.fromISO(`${model.startDate}T00:00:00Z`, { zone: "utc" });
  const endTime = DateTime.fromISO(`${model.endDate}T00:00:00Z`, { zone: "utc" });

  return (
    <div className="section status-and-output">
      <div className="section-title">Status and Output</div>
      <div className="waveform-container">
        {sharedSeismogram && hasStation && (
          <WaveformPanel
            key={`${model.startDate}-${model.endDate}`}
            label={`${model.startDate} – ${model.endDate}`}
            sharedSeismogram={sharedSeismogram}
            startTime={startTime}
            endTime={endTime}
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
