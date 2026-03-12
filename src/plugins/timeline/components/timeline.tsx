import { observer } from "mobx-react-lite";
import React, { useContext } from "react";
import { TileModelContext } from "../../../components/tiles/tile-api";
import { WaveformPanel } from "../../shared-seismogram/components/waveform-panel";
import { isTimelineContentModel } from "../models/timeline-content";

import "./timeline.scss";

export const Timeline = observer(function Timeline() {
  const rawContent = useContext(TileModelContext)?.content;
  const model = isTimelineContentModel(rawContent) ? rawContent : undefined;
  const seismogram = model?.seismogram;

  return (
    <div className="timeline-area">
      {seismogram ? (
        <WaveformPanel
          label="Full waveform"
          startTime={seismogram.startTime}
          durationSeconds={seismogram.endTime.diff(seismogram.startTime, "seconds").seconds}
          seismogram={seismogram}
        />
      ) : <div className="waveform" />}
    </div>
  );
});
