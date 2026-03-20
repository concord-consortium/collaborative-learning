import { observer } from "mobx-react-lite";
import React, { useContext, useEffect } from "react";
import { TileModelContext } from "../../../components/tiles/tile-api";
import { WaveformPanel } from "../../shared-seismogram/components/waveform-panel";
import { isTimelineContentModel } from "../models/timeline-content";

import "./timeline.scss";

export const Timeline = observer(function Timeline() {
  const rawContent = useContext(TileModelContext)?.content;
  const model = isTimelineContentModel(rawContent) ? rawContent : undefined;
  const seismogram = model?.seismogram;

  const dataStartTime = model?.dataStartTime;
  const dataEndTime = model?.dataEndTime;
  const startTime = model?.viewStartTime;
  const endTime = model?.viewEndTime;

  // Initialize view range when seismogram data becomes available,
  // and clamp view to stay within bounds if data range changes.
  useEffect(() => {
    if (!model || !dataStartTime || !dataEndTime) return;
    if (!model.viewStartTime || !model.viewEndTime) {
      // First load: set view to full data range
      model.fitToData();
    } else {
      // Data range changed: clamp view to stay within bounds
      const viewStart = model.viewStartTime;
      const viewEnd = model.viewEndTime;
      const newStart = viewStart < dataStartTime ? dataStartTime : viewStart;
      const newEnd = viewEnd > dataEndTime ? dataEndTime : viewEnd;
      if (newStart >= newEnd) {
        model.fitToData();
      } else if (newStart !== viewStart || newEnd !== viewEnd) {
        model.setViewRange(newStart, newEnd);
      }
    }
  }, [model, dataStartTime, dataEndTime]);

  return (
    <div className="timeline-area">
      {seismogram && startTime && endTime ? (
        <WaveformPanel
          label="Full waveform"
          startTime={startTime}
          durationSeconds={endTime.diff(startTime, "seconds").seconds}
          seismogram={seismogram}
        />
      ) : <div className="waveform" />}
    </div>
  );
});
