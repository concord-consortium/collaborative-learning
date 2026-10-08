import classNames from "classnames";
import React, { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import { DateTime } from "luxon";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import { useStores } from "../../../hooks/use-stores";
import { SharedSeismogramType } from "../shared-seismogram";
import { nanoid } from "nanoid";
import "./waveform-panel.scss";

const LOAD_VIEWPORT_DEBOUNCE_MS = 150;
const DEFAULT_CHART_HEIGHT = 150;
const AMPLITUDE_RANGE_SCALAR = 1.2;

type WaveformPanelMode = "waveform" | "timeline" | "overview";

// The overview is a compact trace of a whole record, drawn in black on a light background.
const kModeStyles: Record<WaveformPanelMode, { height: number, rgb: string }> = {
  waveform: { height: 60, rgb: "255, 255, 255" },
  timeline: { height: 100, rgb: "255, 255, 255" },
  overview: { height: 38, rgb: "0, 0, 0" }
};

interface WaveformPanelProps {
  mode?: WaveformPanelMode;
  sharedSeismogram: SharedSeismogramType;
  startTime: DateTime;
  endTime: DateTime;
}

export const WaveformPanel: React.FC<WaveformPanelProps> = observer(function WaveformPanel({
  mode = "waveform", sharedSeismogram, startTime, endTime,
}) {
  const { seismicQueryService } = useStores();
  const containerRef = useRef<HTMLDivElement>(null);
  const uplotRef = useRef<uPlot | null>(null);
  const callerIdRef = useRef(nanoid());
  const [pixelWidth, setPixelWidth] = useState(0);
  const { height, rgb } = kModeStyles[mode];

  const stationInfo = sharedSeismogram.station;

  // Measure container width
  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        setPixelWidth(entry.contentRect.width);
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Re-run loadViewport when cached envelope data is invalidated (e.g. after tile uploads).
  const cacheVersion = seismicQueryService.envelopeInvalidationCount;

  // Debounce loadViewport
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!stationInfo || pixelWidth === 0) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      seismicQueryService.loadViewport(callerIdRef.current, {
        stationData: stationInfo, startTime, endTime, pixelWidth
      });
    }, LOAD_VIEWPORT_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [stationInfo, startTime, endTime, pixelWidth, seismicQueryService, cacheVersion]);

  // Query and render
  const queryResult = (stationInfo && pixelWidth > 0)
    ? seismicQueryService.query({
        stationData: stationInfo, startTime, endTime, pixelWidth
      })
    : null;

  // Track whether the chart is in envelope mode so we can detect structural changes
  const isEnvelopeRef = useRef<boolean | null>(null);
  // Store the current amplitude range in a ref so the uPlot range callback can read it
  const amplitudeRangeRef = useRef(0);

  // Create uPlot when needed (structural changes)
  useEffect(() => {
    if (!containerRef.current || !queryResult) return;

    const isEnvelope = queryResult.level !== "raw";
    amplitudeRangeRef.current = queryResult.amplitudeRange * AMPLITUDE_RANGE_SCALAR;
    const data = queryResult.data as uPlot.AlignedData;

    // If the series structure hasn't changed, update in place
    if (uplotRef.current && isEnvelopeRef.current === isEnvelope) {
      uplotRef.current.setData(data);
      return;
    }

    // First render or structural change (envelope <-> raw) — recreate
    if (uplotRef.current) {
      uplotRef.current.destroy();
      uplotRef.current = null;
    }

    isEnvelopeRef.current = isEnvelope;

    const stroke = `rgb(${rgb})`;
    const opts: uPlot.Options = {
      width: pixelWidth,
      height: containerRef.current.clientHeight || DEFAULT_CHART_HEIGHT,
      cursor: { show: false },
      legend: { show: false },
      scales: {
        x: { time: true },
        y: {
          range: () => [-amplitudeRangeRef.current, amplitudeRangeRef.current],
        },
      },
      axes: [
        { show: false },
        { show: false },
      ],
      series: isEnvelope
        ? [
            {},
            { label: "Min", stroke, width: 1 },
            { label: "Max", stroke, width: 1 },
          ]
        : [
            {},
            { label: "Value", stroke, width: 1 },
          ],
      bands: isEnvelope
        ? [{ series: [2, 1], fill: `rgba(${rgb}, 0.6)` }]
        : undefined,
    };

    uplotRef.current = new uPlot(opts, data, containerRef.current);
  }, [queryResult, pixelWidth, rgb]);

  // Destroy uPlot on unmount
  useEffect(() => {
    return () => {
      uplotRef.current?.destroy();
      uplotRef.current = null;
    };
  }, []);

  // Resize uPlot when the container width changes
  useEffect(() => {
    if (!uplotRef.current || !containerRef.current || pixelWidth === 0) return;
    uplotRef.current.setSize({
      width: pixelWidth,
      height: containerRef.current.clientHeight || DEFAULT_CHART_HEIGHT,
    });
  }, [pixelWidth]);

  return (
    <div className={classNames("waveform-panel", mode)}>
      <div ref={containerRef} className="waveform-panel-display" style={{ height: `${height}px` }} />
    </div>
  );
});
