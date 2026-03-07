import { observer } from "mobx-react";
import React from "react";
import { BasicEditableTileTitle } from "../../../components/tiles/basic-editable-tile-title";
import { ITileProps } from "../../../components/tiles/tile-component";
import "./timeline-tile.scss";

export const TimelineComponent: React.FC<ITileProps> = observer(() => {
  return (
    <div className="tile-content timeline-tile">
      <BasicEditableTileTitle />
    </div>
  );
});
TimelineComponent.displayName = "TimelineComponent";
