import { registerToolComponentInfo } from "../tool-component-info";
import { registerToolContentInfo } from "../tool-content-info";
import { ToolMetadataModel } from "../tool-metadata";
import { kImageToolID, ImageContentModel, defaultImageContent } from "./image-content";
import ImageToolComponent from "../../../components/tools/image-tool";
import ImageToolIcon from "../../../clue/assets/icons/image-tool.svg";

registerToolContentInfo({
  id: kImageToolID,
  titleBase: "Image",
  modelClass: ImageContentModel,
  metadataClass: ToolMetadataModel,
  defaultContent: defaultImageContent
});

registerToolComponentInfo({
  id: kImageToolID,
  Component: ImageToolComponent,
  toolTileClass: "image-tool-tile",
  tileHandlesOwnSelection: true,
  Icon: ImageToolIcon
});
