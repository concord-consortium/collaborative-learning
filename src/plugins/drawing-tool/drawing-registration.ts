import { registerToolContentInfo } from "../../models/tools/tool-content-info";
import { DrawingContentModel, DrawingToolMetadataModel, defaultDrawingContent } from "./model/drawing-content";
import { kDrawingToolID, kDrawingDefaultHeight } from "./model/drawing-types";
import DrawingToolComponent from "./components/drawing-tool";
import DrawingToolIcon from "../../clue/assets/icons/draw-tool.svg";

registerToolContentInfo({
  id: kDrawingToolID,
  modelClass: DrawingContentModel,
  metadataClass: DrawingToolMetadataModel,
  defaultHeight: kDrawingDefaultHeight,
  exportNonDefaultHeight: true,
  defaultContent: defaultDrawingContent,
  Component: DrawingToolComponent,
  toolTileClass: "drawing-tool-tile",
  Icon: DrawingToolIcon
});
