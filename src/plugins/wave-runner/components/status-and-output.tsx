import classNames from "classnames";
import React from "react";
import { observer } from "mobx-react";
import { useWaveRunnerContent } from "../hooks/use-wave-runner-content";
import { WaveformPanel } from "../../shared-seismogram/components/waveform-panel";
import "./status-and-output.scss";

export const StatusAndOutput: React.FC = observer(function StatusAndOutput() {
  const model = useWaveRunnerContent();
  const {
    hasStationData, sharedSeismogram, startDateISO, endDateISO, isRunning, isLoadingData,
    eventsDataSet, runError, loadDataError
  } = model;

  // The graph space is always a rectangle: grey until a station and model are chosen, black once
  // they are, and a waveform once there is data to draw.
  const isConfigured = !!model.station && !!model.selectedModelUrl;

  // One line carries whatever the tile has to say. Reserving a row for each possible message left
  // an empty one sitting between the graph and the text that was actually showing.
  const error = loadDataError || runError;
  const statusMessage = error
    ? error
    : isLoadingData
      ? `Loading data: day ${model.loadDaysDone + 1} of ${model.loadDaysTotal || "?"}...`
      : isRunning
        ? `Processing day ${model.chunksProcessed + 1} of ${model.chunksTotal || "?"}...`
        : eventsDataSet
          ? "Run complete."
          : isConfigured
            ? "Estimated time to complete run:"
            : "Set up data then run the model.";

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
