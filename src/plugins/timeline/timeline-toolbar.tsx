import React from "react";
import { TileToolbarButton } from "../../components/toolbar/tile-toolbar-button";
import {
  IToolbarButtonComponentProps, registerTileToolbarButtons
} from "../../components/toolbar/toolbar-button-manager";

import TableItIcon from "./assets/toolbar/table-it-icon.svg";
import DataCardItIcon from "./assets/toolbar/data-card-it-icon.svg";
import BarGraphItIcon from "./assets/toolbar/bar-graph-it-icon.svg";
import ZoomInIcon from "./assets/toolbar/zoom-in-icon.svg";
import ZoomOutIcon from "./assets/toolbar/zoom-out-icon.svg";
import ZoomToFitIcon from "./assets/toolbar/zoom-to-fit-icon.svg";

function TableItButton({ name }: IToolbarButtonComponentProps) {
  return (
    <TileToolbarButton
      name={name}
      title="Table It!"
      onClick={() => undefined}
      disabled={true}
    >
      <TableItIcon/>
    </TileToolbarButton>
  );
}

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

function ZoomInButton({ name }: IToolbarButtonComponentProps) {
  return (
    <TileToolbarButton
      name={name}
      title="Zoom In"
      onClick={() => undefined}
      disabled={true}
    >
      <ZoomInIcon/>
    </TileToolbarButton>
  );
}

function ZoomOutButton({ name }: IToolbarButtonComponentProps) {
  return (
    <TileToolbarButton
      name={name}
      title="Zoom Out"
      onClick={() => undefined}
      disabled={true}
    >
      <ZoomOutIcon/>
    </TileToolbarButton>
  );
}

function ViewAllButton({ name }: IToolbarButtonComponentProps) {
  return (
    <TileToolbarButton
      name={name}
      title="View All"
      onClick={() => undefined}
      disabled={true}
    >
      <ZoomToFitIcon/>
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
  { name: "view-all", component: ViewAllButton }
]);
