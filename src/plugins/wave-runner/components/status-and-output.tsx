import classNames from "classnames";
import React from "react";
import { observer } from "mobx-react";
import { useWaveRunnerContent } from "../hooks/use-wave-runner-content";
import { WaveformPanel } from "../../shared-seismogram/components/waveform-panel";
import "./status-and-output.scss";

export const StatusAndOutput: React.FC = observer(function StatusAndOutput() {
  const model = useWaveRunnerContent();
  const {
    hasStationData, sharedSeismogram, startDateISO, endDateISO, isRunning, isPaused, isDayInProgress,
    isLoadingData, eventsDataSet, runError, loadDataError, chunksProcessed, chunksTotal
  } = model;
  const currentDay = `day ${chunksTotal ? Math.min(chunksProcessed + 1, chunksTotal) : chunksProcessed + 1}`
    + ` of ${chunksTotal || "?"}`;

  // Run state changes, announced to screen readers. The per-day progress is not, so a long
  // run doesn't announce every day.
  function runStateMessage() {
    if (isRunning) {
      if (!isPaused) return "";
      return isDayInProgress ? `Pausing after ${currentDay}...` : "Pausing...";
    }
    if (isPaused) return `Model paused at day ${chunksProcessed} of ${chunksTotal}. Run to continue.`;
    return eventsDataSet ? "Run complete." : "";
  }

  // The graph space is always a rectangle: gray until a station and model are chosen, black once
  // they are, and a waveform once there is data to draw.
  const isConfigured = !!model.station && !!model.selectedModelUrl;

  // One line carries whatever the tile has to say, so the layout reserves exactly that line's
  // height (see _tile-metrics.scss) rather than a row per possible message.
  const error = loadDataError || runError;
  const statusMessage = error
    || (isLoadingData && `Loading data: day ${model.loadDaysDone + 1} of ${model.loadDaysTotal || "?"}...`)
    || (isRunning && !isPaused && `Processing ${currentDay}...`)
    || runStateMessage()
    || (isConfigured ? "Ready to run the model." : "Set up data then run the model.");

  return (
    <div className="section status-and-output">
      <div className="section-title">Status and Output</div>
      <div className={classNames("waveform-container", { configured: isConfigured })}>
        {sharedSeismogram && hasStationData && (
          <WaveformPanel
            key={`${model.startDate}-${model.endDate}`}
            sharedSeismogram={sharedSeismogram}
            startTime={startDateISO}
            endTime={endDateISO}
          />
        )}
      </div>
      <div className={classNames("status-line", { "waveform-error": !!error })}>{statusMessage}</div>
      <div className="visually-hidden" role="status">{runStateMessage()}</div>
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
