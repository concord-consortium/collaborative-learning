import React from "react";
import { observer } from "mobx-react";
import { useWaveRunnerContent } from "../hooks/use-wave-runner-content";
import { WaveformPanel } from "../../shared-seismogram/components/waveform-panel";
import "./status-and-output.scss";

export const StatusAndOutput: React.FC = observer(function StatusAndOutput() {
  const model = useWaveRunnerContent();
  const {
    hasStationData, sharedSeismogram, startDateISO, endDateISO, isRunning, isPaused, isLoadingData,
    eventsDataSet, runError, loadDataError, chunksProcessed, chunksTotal
  } = model;

  function runStatus() {
    if (isRunning) {
      return isPaused
        ? `Pausing after day ${chunksProcessed + 1} of ${chunksTotal || "?"}...`
        : `Processing day ${chunksProcessed + 1} of ${chunksTotal || "?"}...`;
    }
    if (isPaused) return `Model paused at day ${chunksProcessed} of ${chunksTotal}. Run to continue.`;
    return eventsDataSet ? "Run complete." : "Estimated time to complete run:";
  }

  return (
    <div className="section status-and-output">
      <div className="section-title">Status and Output</div>
      <div className="waveform-container">
        {sharedSeismogram && hasStationData && (
          <WaveformPanel
            key={`${model.startDate}-${model.endDate}`}
            sharedSeismogram={sharedSeismogram}
            startTime={startDateISO}
            endTime={endDateISO}
          />
        )}
      </div>
      <div className="download-status-container">
        {isLoadingData && <div>Loading data: day {model.loadDaysDone + 1} of {model.loadDaysTotal || "?"}...</div>}
        {isRunning && <div>Running model...</div>}
        {loadDataError && <div className="waveform-error">{loadDataError}</div>}
        {runError && <div className="waveform-error">{runError}</div>}
      </div>
      <div className="estimated-time">{runStatus()}</div>
      <div className="status-counts-row">
        <div className="status-count">
          <label className="status-count-label">Events Identified</label>
          <div className="status-count-box">
            {model.eventsFound ?? "-"}
          </div>
        </div>
        <div className="status-count">
          <label className="status-count-label">Event Categories</label>
          <div className="status-count-box">-</div>
        </div>
      </div>
    </div>
  );
});
