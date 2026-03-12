import React, { useContext } from "react";
import { observer } from "mobx-react";
import { DateTime } from "luxon";
import { TileModelContext } from "../../../components/tiles/tile-api";
import { isWaveRunnerContentModel } from "../models/wave-runner-content";
import { WaveformPanel } from "../../shared-seismogram/components/waveform-panel";
import "./status-and-output.scss";

interface WindowConfig {
  label: string;
  startTime: DateTime;
  durationSeconds: number;
}

// TODO Clean this file up.
const SEVEN_DAY_START = DateTime.fromISO("2026-01-30T00:00:00Z", { zone: "utc" });
// const THREE_DAY_START = DateTime.fromISO("2026-02-03T00:00:00Z", { zone: "utc" });
// const FILE_START      = DateTime.fromISO("2026-02-01T00:00:00Z", { zone: "utc" });
// const NINE_AM         = DateTime.fromISO("2026-02-01T09:00:00Z", { zone: "utc" });
// const NINE_25         = DateTime.fromISO("2026-02-01T09:25:00Z", { zone: "utc" });
// const NINE_28         = DateTime.fromISO("2026-02-01T09:28:25Z", { zone: "utc" });

const WINDOW_CONFIGS: WindowConfig[] = [
  { label: "1 week",      startTime: SEVEN_DAY_START, durationSeconds: 7 * 86400 },
  // { label: "3 days",      startTime: THREE_DAY_START, durationSeconds: 3 * 86400 },
  // { label: "24 hours",    startTime: FILE_START,      durationSeconds: 86400     },
  // { label: "6 hours",     startTime: NINE_AM,         durationSeconds: 21600     },
  // { label: "1 hour",      startTime: NINE_AM,         durationSeconds: 3600      },
  // { label: "15 minutes",  startTime: NINE_25,         durationSeconds: 900       },
  // { label: "5 minutes",   startTime: NINE_25,         durationSeconds: 300       },
  // { label: "1 minute",    startTime: NINE_28,         durationSeconds: 60        },
  // { label: "30 seconds",  startTime: NINE_28,         durationSeconds: 30        },
  // { label: "15 seconds",  startTime: NINE_28,         durationSeconds: 15        },
  // { label: "5 seconds",   startTime: NINE_28,         durationSeconds: 5         },
];

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
        {seismogram && WINDOW_CONFIGS.map(config => (
          <WaveformPanel
            key={config.label}
            label={config.label}
            startTime={config.startTime}
            durationSeconds={config.durationSeconds}
            seismogram={seismogram}
          />
        ))}
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
