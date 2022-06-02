import { registerToolContentInfo } from "../../models/tools/tool-content-info";
import { kImageToolID, ImageContentModel, defaultImageContent } from "./models/image-content";
import ImageToolComponent from "./components/image-tool";
import ImageToolIcon from "../../clue/assets/icons/image-tool.svg";


registerToolContentInfo({
  id: kImageToolID,
  modelClass: ImageContentModel,
  defaultContent: defaultImageContent,
  Component: ImageToolComponent,
  toolTileClass: "image-tool-tile",
  tileHandlesOwnSelection: true,
  Icon: ImageToolIcon
});
