import React, { useContext } from "react";
import { observer } from "mobx-react-lite";
import { AddTilesContext, TileModelContext } from "../../components/tiles/tile-api";
import { BadgedIcon } from "../../components/toolbar/badged-icon";
import { TileToolbarButton } from "../../components/toolbar/tile-toolbar-button";
import {
  IToolbarButtonComponentProps, registerTileToolbarButtons
} from "../../components/toolbar/toolbar-button-manager";
import { kTableTileType } from "../../models/tiles/table/table-content";
import { useTimelineContent } from "./hooks/use-timeline-content";
import { isTimelineContentModel } from "./models/timeline-content";

import ViewBadgeIcon from "../../assets/icons/view/view-badge.svg";
import TableIcon from "../../clue/assets/icons/table-tool.svg";
import DataCardItIcon from "./assets/toolbar/data-card-it-icon.svg";
import BarGraphItIcon from "./assets/toolbar/bar-graph-it-icon.svg";
import ZoomInIcon from "./assets/toolbar/zoom-in-icon.svg";
import ZoomOutIcon from "./assets/toolbar/zoom-out-icon.svg";
import ZoomToFitIcon from "./assets/toolbar/zoom-to-fit-icon.svg";
import ScrollArrowIcon from "../../assets/scroll-arrow-small-icon.svg";

const TableItButton = observer(function TableItButton({ name }: IToolbarButtonComponentProps) {
  const tileModel = useContext(TileModelContext);
  const addTilesContext = useContext(AddTilesContext);
  const content = useTimelineContent();
  const disabled = !content.sharedDataSet;

  function handleClick() {
    if (!tileModel || !addTilesContext) return;
    const sharedDataSet = content.sharedDataSet;
    const sharedModels = sharedDataSet ? [sharedDataSet] : undefined;
    addTilesContext.addTileAfter(kTableTileType, tileModel, sharedModels);
  }

  return (
    <TileToolbarButton name={name} title="Table It!" onClick={handleClick} disabled={disabled}>
      <BadgedIcon Icon={TableIcon} Badge={ViewBadgeIcon}/>
    </TileToolbarButton>
  );
});

function DataCardItButton({ name }: IToolbarButtonComponentProps) {
  return (
    <TileToolbarButton
      name={name}
      title="Data Card It!"
      onClick={() => undefined}
      disabled={true}
    >
      <DataCardItIcon/>
    </TileToolbarButton>
  );
}

function BarGraphItButton({ name }: IToolbarButtonComponentProps) {
  return (
    <TileToolbarButton
      name={name}
      title="Bar Graph It!"
      onClick={() => undefined}
      disabled={true}
    >
      <BarGraphItIcon/>
    </TileToolbarButton>
  );
}

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
  { name: "table-it", component: TableItButton },
  { name: "data-card-it", component: DataCardItButton },
  { name: "bar-graph-it", component: BarGraphItButton },
  { name: "zoom-in", component: ZoomInButton },
  { name: "zoom-out", component: ZoomOutButton },
  { name: "view-all", component: ViewAllButton },
  { name: "pan-left", component: PanLeftButton },
  { name: "pan-right", component: PanRightButton }
]);
