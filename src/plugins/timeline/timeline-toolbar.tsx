import React, { useContext } from "react";
import { observer } from "mobx-react-lite";
import { TileModelContext } from "../../components/tiles/tile-api";
import { DataSetViewButton } from "../../components/toolbar/data-set-view-button";
import { TileToolbarButton } from "../../components/toolbar/tile-toolbar-button";
import {
  IToolbarButtonComponentProps, registerTileToolbarButtons
} from "../../components/toolbar/toolbar-button-manager";
import { useTimelineContent } from "./hooks/use-timeline-content";
import { isTimelineContentModel } from "./models/timeline-content";

import ZoomInIcon from "./assets/toolbar/zoom-in-icon.svg";
import ZoomOutIcon from "./assets/toolbar/zoom-out-icon.svg";
import ZoomToFitIcon from "./assets/toolbar/zoom-to-fit-icon.svg";
import ScrollArrowIcon from "../../assets/scroll-arrow-small-icon.svg";

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

// Note: Not switching to useTimelineContent here because these buttons will be removed in another branch soon.
function PanLeftButton({ name }: IToolbarButtonComponentProps) {
  const model = useContext(TileModelContext);
  const content = isTimelineContentModel(model?.content) ? model?.content : undefined;
  return (
    <TileToolbarButton
      name={name}
      title="Pan Left"
      onClick={() => content?.panLeft()}
      disabled={false}
    >
      <ScrollArrowIcon/>
    </TileToolbarButton>
  );
}

function PanRightButton({ name }: IToolbarButtonComponentProps) {
  const model = useContext(TileModelContext);
  const content = isTimelineContentModel(model?.content) ? model?.content : undefined;
  return (
    <TileToolbarButton
      name={name}
      title="Pan Right"
      onClick={() => content?.panRight()}
      disabled={false}
    >
      <ScrollArrowIcon style={{ transform: "rotate(180deg)" }}/>
    </TileToolbarButton>
  );
}

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
  { name: "pan-left", component: PanLeftButton },
  { name: "pan-right", component: PanRightButton }
]);
