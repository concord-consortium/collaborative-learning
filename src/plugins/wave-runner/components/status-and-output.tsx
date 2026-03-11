import React, { useEffect, useState } from "react";
import { DateTime } from "luxon";
import { miniseed, seismogram as seismogramNS } from "seisplotjs";
type Seismogram = seismogramNS.Seismogram;
import { WaveformPanel } from "./waveform-panel";
import "./status-and-output.scss";

const S3_BASE = "https://models-resources.s3.amazonaws.com/collaborative-learning/datasets";
const MSEED_URLS = [
  `${S3_BASE}/2026_01_30_00_00_00-2026_01_31_00_00_00_anchorage_airport.mseed`,
  `${S3_BASE}/2026_01_31_00_00_00-2026_02_01_00_00_00_anchorage_airport.mseed`,
  `${S3_BASE}/2026_02_01_00_00_00-2026_02_02_00_00_00_anchorage_airport.mseed`,
  `${S3_BASE}/2026_02_02_00_00_00-2026_02_03_00_00_00_anchorage_airport.mseed`,
  `${S3_BASE}/2026_02_03_00_00_00-2026_02_04_00_00_00_anchorage_airport.mseed`,
  `${S3_BASE}/2026_02_04_00_00_00-2026_02_05_00_00_00_anchorage_airport.mseed`,
  `${S3_BASE}/2026_02_05_00_00_00-2026_02_06_00_00_00_anchorage_airport.mseed`,
];

const SEVEN_DAY_START = DateTime.fromISO("2026-01-30T00:00:00Z", { zone: "utc" });
const THREE_DAY_START = DateTime.fromISO("2026-02-03T00:00:00Z", { zone: "utc" });
const FILE_START     = DateTime.fromISO("2026-02-01T00:00:00Z", { zone: "utc" });
const NINE_AM        = DateTime.fromISO("2026-02-01T09:00:00Z", { zone: "utc" });
const NINE_25        = DateTime.fromISO("2026-02-01T09:25:00Z", { zone: "utc" });
const NINE_28        = DateTime.fromISO("2026-02-01T09:28:25Z", { zone: "utc" });

interface WindowConfig {
  label: string;
  startTime: DateTime;
  durationSeconds: number;
}

const WINDOW_CONFIGS: WindowConfig[] = [
  { label: "1 week",   startTime: SEVEN_DAY_START, durationSeconds: 7 * 86400 },
  { label: "3 days",   startTime: THREE_DAY_START, durationSeconds: 3 * 86400 },
  { label: "24 hours",   startTime: FILE_START, durationSeconds: 86400 },
  { label: "6 hours",    startTime: NINE_AM,    durationSeconds: 21600 },
  { label: "1 hour",     startTime: NINE_AM,    durationSeconds: 3600  },
  { label: "15 minutes", startTime: NINE_25,    durationSeconds: 900   },
  { label: "5 minutes",  startTime: NINE_25,    durationSeconds: 300   },
  { label: "1 minute",   startTime: NINE_28,    durationSeconds: 60    },
  { label: "30 seconds", startTime: NINE_28,    durationSeconds: 30    },
  { label: "15 seconds", startTime: NINE_28,    durationSeconds: 15    },
  { label: "5 seconds",  startTime: NINE_28,    durationSeconds: 5     },
];

export const StatusAndOutput: React.FC = () => {
  const [seismogramData, setSeismogramData] = useState<Seismogram | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all(MSEED_URLS.map(url => fetch(url).then(res => res.arrayBuffer())))
      .then(buffers => {
        if (cancelled) return;
        const allRecords = buffers.flatMap(buf => miniseed.parseDataRecords(buf));
        setSeismogramData(miniseed.merge(allRecords));
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        setError(`Error loading seismic data: ${err.message}`);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="section status-and-output">
      <div className="section-title">Status and Output</div>
      <div className="waveform-container">
        {loading && <div className="waveform-loading">Loading seismic data...</div>}
        {error && <div className="waveform-error">{error}</div>}
        {!loading && !error && seismogramData &&
          WINDOW_CONFIGS.map(config => (
            <WaveformPanel
              key={config.label}
              label={config.label}
              startTime={config.startTime}
              durationSeconds={config.durationSeconds}
              seismogram={seismogramData}
            />
          ))
        }
      </div>
      <div className="download-status-container" />
      <div className="estimated-time">
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
