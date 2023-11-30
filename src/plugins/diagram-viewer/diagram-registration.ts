import { registerTileComponentInfo } from "../../models/tiles/tile-component-info";
import { registerTileContentInfo } from "../../models/tiles/tile-content-info";
import { kDiagramDefaultHeight, kDiagramTileType } from "./diagram-types";
import { defaultDiagramContent, DiagramContentModel } from "./diagram-content";
import { DiagramToolComponent } from "./diagram-tile";
import DiagramToolIcon from "./src/assets/program.svg";
import { DiagramMigrator } from "./diagram-migrator";

registerTileContentInfo({
  type: kDiagramTileType,
  // TODO: maybe there is there a better way to do this kind of casting?
  //   The issue is that modelClass prop has a type of `typeof TileContentModel`,
  //   That type is pretty restrictive and doesn't accommodate the return of
  //   types.snapshotProcessor. There might be a better way to get a
  //   typescript type for a MST "Class" which is less restrictive
  modelClass: DiagramMigrator as typeof DiagramContentModel,
  defaultContent: defaultDiagramContent,
  defaultHeight: kDiagramDefaultHeight,
  isVariableProvider: true
});

registerTileComponentInfo({
  type: kDiagramTileType,
  Component: DiagramToolComponent,
  tileEltClass: "diagram-tool-tile disable-tile-content-drag nowheel",
  Icon: DiagramToolIcon
});
