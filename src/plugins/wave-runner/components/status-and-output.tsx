import React, { useContext } from "react";
import { observer } from "mobx-react";
import { DateTime } from "luxon";
import { TileModelContext } from "../../../components/tiles/tile-api";
import { isWaveRunnerContentModel } from "../models/wave-runner-content";
import { WaveformPanel } from "../../shared-seismogram/components/waveform-panel";
import "./status-and-output.scss";

export const StatusAndOutput: React.FC = observer(function StatusAndOutput() {
  const rawContent = useContext(TileModelContext)?.content;
  const model = isWaveRunnerContentModel(rawContent) ? rawContent : undefined;
  const seismogram = model?.sharedSeismogram?.seismogram;

  return (
    <div className="section status-and-output">
      <div className="section-title">Status and Output</div>
      <div className="waveform-container">
        {model?.isLoading && <div className="waveform-loading">Loading seismic data...</div>}
        {model?.loadError && <div className="waveform-error">{model.loadError}</div>}
        {seismogram && (
          <WaveformPanel
            key="1 week"
            label="1 week"
            startTime={DateTime.fromISO("2026-01-30T00:00:00Z", { zone: "utc" })}
            durationSeconds={7 * 86400}
            seismogram={seismogram}
          />
        )}
      </div>
      <div className="download-status-container" />
      <div className="estimated-time">Estimated time to complete run:</div>
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
});
