import { observer } from "mobx-react";
import React, { useContext } from "react";
import { BasicEditableTileTitle } from "../../../components/tiles/basic-editable-tile-title";
import { ITileProps } from "../../../components/tiles/tile-component";
import { TileModelContext } from "../../../components/tiles/tile-api";
import { TileToolbar } from "../../../components/toolbar/tile-toolbar";
import { WaveformPanel } from "../../shared-seismogram/components/waveform-panel";
import { isTimelineContentModel } from "../models/timeline-content";
import { Timeline } from "./timeline";
import { TimelineKey } from "./timeline-key";
import "../timeline-toolbar";
import "./timeline-tile.scss";

export const TimelineComponent: React.FC<ITileProps> = observer(({ readOnly, tileElt }) => {
  const rawContent = useContext(TileModelContext)?.content;
  const model = isTimelineContentModel(rawContent) ? rawContent : undefined;
  const seismogram = model?.seismogram;

  return (
    <div className="tile-content timeline-tile">
      <BasicEditableTileTitle />
      <TileToolbar tileType="timeline" readOnly={!!readOnly} tileElement={tileElt} />
      <div className="timeline-container">
        <div className="event-row">
          <button disabled={true}>Prev</button>
          <button disabled={true}>Next</button>
          <div className="event-label">Event</div>
        </div>
        <Timeline />
        <TimelineKey />
        {seismogram && (
          <WaveformPanel
            label="Full waveform"
            startTime={seismogram.startTime}
            durationSeconds={seismogram.endTime.diff(seismogram.startTime, "seconds").seconds}
            seismogram={seismogram}
          />
        )}
      </div>
    </div>
  );
});
TimelineComponent.displayName = "TimelineComponent";
