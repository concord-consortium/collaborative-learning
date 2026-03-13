import React, { useEffect, useRef } from "react";
import { DateTime, Interval } from "luxon";
import { seismograph, seismographconfig, seismogram as seismogramModule } from "seisplotjs";
type Seismogram = seismogramModule.Seismogram;
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
  seismogram,
}) => {
  const divRef = useRef<HTMLDivElement>(null);

  // Plot the seismogram
  useEffect(() => {
    if (!divRef.current || !seismogram) return;

    const div = divRef.current;
    let spElement: HTMLElement | null = null;

    const endTime = startTime.plus({ seconds: durationSeconds });
    const sdd = seismogramModule.SeismogramDisplayData.fromSeismogram(seismogram);
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

    try {
      spElement = new seismograph.Seismograph([sdd], config) as unknown as HTMLElement;
      div.appendChild(spElement);
    } catch (e) {
      // Seismograph custom element may not render in all environments
    }

    return () => {
      if (spElement && div && div.contains(spElement)) {
        div.removeChild(spElement);
      }
    };
  }, [seismogram, startTime, durationSeconds]);

  return (
    <div className="waveform-panel">
      <div className="waveform-panel-label">{label}</div>
      <div ref={divRef} className="waveform-panel-display" />
    </div>
  );
};
