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

interface WaveformPanelProps {
  label: string;
  sharedSeismogram: SharedSeismogramType;
  startTime: DateTime;
  endTime: DateTime;
}

export const WaveformPanel: React.FC<WaveformPanelProps> = observer(function WaveformPanel({
  label, sharedSeismogram, startTime, endTime,
}) {
  const { seismicQueryService } = useStores();
  const containerRef = useRef<HTMLDivElement>(null);
  const uplotRef = useRef<uPlot | null>(null);
  const callerIdRef = useRef(nanoid());
  const [pixelWidth, setPixelWidth] = useState(0);

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

  // Debounce loadViewport
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!stationInfo || pixelWidth === 0) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const { network, station, location, channel } = stationInfo;
      const stationData = { network, station, channel };
      seismicQueryService.loadViewport(callerIdRef.current, { stationData, location, startTime, endTime, pixelWidth });
    }, LOAD_VIEWPORT_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [stationInfo, startTime, endTime, pixelWidth, seismicQueryService]);

  // Query and render
  const queryResult = (stationInfo && pixelWidth > 0)
    ? seismicQueryService.query({
        stationData: stationInfo, location: stationInfo.location, startTime, endTime, pixelWidth
      })
    : null;

  // Create/update uPlot
  useEffect(() => {
    if (!containerRef.current || !queryResult) return;

    const data = queryResult.data as uPlot.AlignedData;

    if (uplotRef.current) {
      uplotRef.current.setData(data);
      return;
    }

    const isEnvelope = queryResult.level !== "raw";
    const amplitudeRange = queryResult.amplitudeRange * AMPLITUDE_RANGE_SCALAR;
    const opts: uPlot.Options = {
      width: pixelWidth,
      height: containerRef.current.clientHeight || DEFAULT_CHART_HEIGHT,
      cursor: { show: false },
      legend: { show: false },
      scales: {
        x: { time: true },
        y: {
          range: [-amplitudeRange, amplitudeRange],
        },
      },
      axes: [
        { show: false },
        { show: false },
      ],
      series: isEnvelope
        ? [
            {},
            { label: "Min", stroke: "white", width: 1 },
            { label: "Max", stroke: "white", width: 1 },
          ]
        : [
            {},
            { label: "Value", stroke: "white", width: 1 },
          ],
      bands: isEnvelope
        ? [{ series: [2, 1], fill: "rgba(255, 255, 255, 0.6)" }]
        : undefined,
    };

    uplotRef.current = new uPlot(opts, data, containerRef.current);

    return () => {
      uplotRef.current?.destroy();
      uplotRef.current = null;
    };
  }, [queryResult, pixelWidth]);

  return (
    <div className="waveform-panel">
      <div className="waveform-panel-label">{label}</div>
      <div ref={containerRef} className="waveform-panel-display" />
    </div>
  );
});
