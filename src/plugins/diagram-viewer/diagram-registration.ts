import { registerToolContentInfo } from "../../models/tools/tool-content-info";
import { kDiagramDefaultHeight, kDiagramToolID } from "./diagram-types";
import { defaultDiagramContent, DiagramContentModel } from "./diagram-content";
import { DiagramToolComponent } from "./diagram-tool";
import DiagramToolIcon from "./src/assets/program.svg";

registerToolContentInfo({
  id: kDiagramToolID,
  modelClass: DiagramContentModel,
  defaultContent: defaultDiagramContent,
  Component: DiagramToolComponent,
  defaultHeight: kDiagramDefaultHeight,
  toolTileClass: "diagram-tool-tile disable-tile-content-drag",
  Icon: DiagramToolIcon
});
