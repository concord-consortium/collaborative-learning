import { observer } from "mobx-react";
import React from "react";
import { BasicEditableTileTitle } from "../../../components/tiles/basic-editable-tile-title";
import { ITileProps } from "../../../components/tiles/tile-component";
import { TileToolbar } from "../../../components/toolbar/tile-toolbar";
import "../timeline-toolbar";
import "./timeline-tile.scss";

export const TimelineComponent: React.FC<ITileProps> = observer(({ readOnly, tileElt }) => {
  return (
    <div className="tile-content timeline-tile">
      <BasicEditableTileTitle />
      <TileToolbar tileType="timeline" readOnly={!!readOnly} tileElement={tileElt} />
    </div>
  );
});
TimelineComponent.displayName = "TimelineComponent";
