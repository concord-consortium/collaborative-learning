import { registerToolContentInfo } from "../tool-content-info";
import { kImageToolID, ImageMetadataModel, ImageContentModel, defaultImageContent } from "./image-content";
import ImageToolComponent from "../../../components/tools/image-tool";
import ImageToolIcon from "../../../clue/assets/icons/image-tool.svg";

registerToolContentInfo({
  id: kImageToolID,
  titleBase: "Image",
  modelClass: ImageContentModel,
  metadataClass: ImageMetadataModel,
  defaultContent: defaultImageContent,
  Component: ImageToolComponent,
  toolTileClass: "image-tool-tile",
  tileHandlesOwnSelection: true,
  Icon: ImageToolIcon
});
