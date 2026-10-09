import React from "react";
import { observer } from "mobx-react-lite";
import { DataSetViewButton } from "../../components/toolbar/data-set-view-button";
import { TileToolbarButton } from "../../components/toolbar/tile-toolbar-button";
import {
  IToolbarButtonComponentProps, registerTileToolbarButtons
} from "../../components/toolbar/toolbar-button-manager";
import { useTimelineContent } from "./hooks/use-timeline-content";

import ZoomInIcon from "./assets/toolbar/zoom-in-icon.svg";
import ZoomOutIcon from "./assets/toolbar/zoom-out-icon.svg";
import ZoomToFitIcon from "./assets/toolbar/zoom-to-fit-icon.svg";
import PanLeftIcon from "./assets/toolbar/pan-left-icon.svg";
import AddMarkerIcon from "./assets/toolbar/add-marker-icon.svg";

const ZoomInButton = observer(function ZoomInButton({ name }: IToolbarButtonComponentProps) {
  const content = useTimelineContent();

  return (
    <TileToolbarButton
      name={name}
      title="Zoom In"
      onClick={() => content?.zoom(0.5)}
      disabled={!content?.canZoomIn}
    >
      <ZoomInIcon/>
    </TileToolbarButton>
  );
});

const ZoomOutButton = observer(function ZoomOutButton({ name }: IToolbarButtonComponentProps) {
  const content = useTimelineContent();

  return (
    <TileToolbarButton
      name={name}
      title="Zoom Out"
      onClick={() => content?.zoom(2)}
      disabled={!content?.canZoomOut}
    >
      <ZoomOutIcon/>
    </TileToolbarButton>
  );
});

const ViewAllButton = observer(function ViewAllButton({ name }: IToolbarButtonComponentProps) {
  const content = useTimelineContent();

  return (
    <TileToolbarButton
      name={name}
      title="View All"
      onClick={() => content?.fitToData()}
      disabled={!content?.canFitToData}
    >
      <ZoomToFitIcon/>
    </TileToolbarButton>
  );
});

const PanLeftButton = observer(function PanLeftButton({ name }: IToolbarButtonComponentProps) {
  const content = useTimelineContent();

  return (
    <TileToolbarButton
      name={name}
      title="Pan Left"
      onClick={() => content?.panLeft()}
      disabled={!content?.canPanLeft}
    >
      <PanLeftIcon/>
    </TileToolbarButton>
  );
});

const PanRightButton = observer(function PanRightButton({ name }: IToolbarButtonComponentProps) {
  const content = useTimelineContent();

  return (
    <TileToolbarButton
      name={name}
      title="Pan Right"
      onClick={() => content?.panRight()}
      disabled={!content?.canPanRight}
    >
      {/* There is only a left arrow asset; mirror it for the right. */}
      <PanLeftIcon style={{ transform: "scaleX(-1)" }}/>
    </TileToolbarButton>
  );
});

const AddMarkerButton = observer(function AddMarkerButton({ name }: IToolbarButtonComponentProps) {
  const content = useTimelineContent();

  return (
    <TileToolbarButton
      name={name}
      title="Add Marker"
      onClick={() => content?.startPlacingMarker()}
      selected={content?.isPlacingMarker}
      disabled={!!content?.markerTime || !content?.dataStartTime}
    >
      <AddMarkerIcon/>
    </TileToolbarButton>
  );
});

registerTileToolbarButtons("timeline",
[
  {
    // This button takes an argument saying what kind of tile it should create.
    name: "data-set-view",
    component: DataSetViewButton
  },
  { name: "zoom-in", component: ZoomInButton },
  { name: "zoom-out", component: ZoomOutButton },
  { name: "view-all", component: ViewAllButton },
  { name: "add-marker", component: AddMarkerButton },
  { name: "pan-left", component: PanLeftButton },
  { name: "pan-right", component: PanRightButton }
]);
