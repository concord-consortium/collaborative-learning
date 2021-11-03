import { registerToolContentInfo } from "../tool-content-info";
import { kTextToolID, TextContentModel, defaultTextContent } from "./text-content";
import TextToolComponent from "../../../components/tools/text-tool";

registerToolContentInfo({
  id: kTextToolID,
  tool: "text",
  modelClass: TextContentModel,
  defaultContent: defaultTextContent,
  Component: TextToolComponent,
  toolTileClass: "text-tool-tile",
  tileHandlesOwnSelection: true
});
