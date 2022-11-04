import { registerToolComponentInfo } from "../../models/tools/tool-component-info";
import { registerToolContentInfo } from "../../models/tools/tool-content-info";
import { kDiagramDefaultHeight, kDiagramToolID } from "./diagram-types";
import { defaultDiagramContent, DiagramContentModel } from "./diagram-content";
import { DiagramToolComponent } from "./diagram-tool";
import DiagramToolIcon from "./src/assets/program.svg";
import { DiagramMigrator } from "./diagram-migrator";

registerToolContentInfo({
  id: kDiagramToolID,
  // TODO: maybe there is there a better way to do this kind of casting?
  //   The issue is that modelClass prop has a type of `typeof ToolContentModel`,
  //   That type is pretty restrictive and doesn't accommodate the return of
  //   types.snapshotProcessor. There might be a better way to get a
  //   typescript type for a MST "Class" which is less restrictive
  modelClass: DiagramMigrator as typeof DiagramContentModel,
  defaultContent: defaultDiagramContent,
  defaultHeight: kDiagramDefaultHeight
});

registerToolComponentInfo({
  id: kDiagramToolID,
  Component: DiagramToolComponent,
  toolTileClass: "diagram-tool-tile disable-tile-content-drag nowheel",
  Icon: DiagramToolIcon
});
