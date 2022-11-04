import { registerToolComponentInfo } from "../tile-component-info";
import { registerToolContentInfo } from "../tile-content-info";
import { ToolMetadataModel } from "../tile-metadata";
import { kImageToolID, ImageContentModel, defaultImageContent } from "./image-content";
import ImageToolComponent from "../../../components/tiles/image/image-tile";
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
