import React, { useEffect, useRef } from "react";
import { DateTime, Interval } from "luxon";
import { seismograph, seismographconfig, seismogram as seismogramModule } from "seisplotjs";
import type { seismogram as SeismogramNS } from "seisplotjs";
type Seismogram = SeismogramNS.Seismogram;
import "./waveform-panel.scss";

interface WaveformPanelProps {
  label: string;
  startTime: DateTime;
  durationSeconds: number;
  seismogram: Seismogram;
}

export const WaveformPanel: React.FC<WaveformPanelProps> = ({
  label,
  startTime,
  durationSeconds,
  seismogram: seismogramData,
}) => {
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!divRef.current || !seismogramData) return;

    const endTime = startTime.plus({ seconds: durationSeconds });
    const sdd = seismogramModule.SeismogramDisplayData.fromSeismogram(seismogramData);
    const interval = Interval.fromDateTimes(startTime, endTime);
    sdd.timeRange = interval;

    const config = new seismographconfig.SeismographConfig();
    config.fixedTimeScale = interval;
    config.isYAxis = false;
    config.isXAxis = false;
    config.showTitle = false;
    config.yLabel = null;
    config.ySublabel = null;
    config.xLabel = null;
    config.lineColors = ["white"];
    config.margin = { top: 0, right: 0, bottom: 0, left: 0 };

    let spElement: HTMLElement | null = null;
    try {
      spElement = new seismograph.Seismograph([sdd], config) as unknown as HTMLElement;
      divRef.current.appendChild(spElement);
    } catch (e) {
      // Seismograph custom element may not render in all environments
    }

    return () => {
      if (spElement && divRef.current && divRef.current.contains(spElement)) {
        divRef.current.removeChild(spElement);
      }
    };
  }, [seismogramData, startTime, durationSeconds]);

  return (
    <div className="waveform-panel">
      <div className="waveform-panel-label">{label}</div>
      <div ref={divRef} className="waveform-panel-display" />
    </div>
  );
};
