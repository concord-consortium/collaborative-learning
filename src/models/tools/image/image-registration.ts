import { registerToolContentInfo } from "../tool-content-info";
import { kImageToolID, ImageContentModel, defaultImageContent } from "./image-content";
import ImageToolComponent from "../../../components/tools/image-tool";
import ImageToolIcon from "../../../clue/assets/icons/image-tool.svg";

registerToolContentInfo({
  id: kImageToolID,
  tool: "image",
  modelClass: ImageContentModel,
  defaultContent: defaultImageContent,
  Component: ImageToolComponent,
  toolTileClass: "image-tool-tile",
  tileHandlesOwnSelection: true,
  icon: ImageToolIcon
});
