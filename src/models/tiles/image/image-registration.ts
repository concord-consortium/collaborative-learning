import { registerTileComponentInfo } from "../tile-component-info";
import { registerTileContentInfo } from "../tile-content-info";
import { TileMetadataModel } from "../tile-metadata";
import { kImageToolID, ImageContentModel, defaultImageContent } from "./image-content";
import ImageToolComponent from "../../../components/tiles/image/image-tile";
import ImageToolIcon from "../../../clue/assets/icons/image-tool.svg";

registerTileContentInfo({
  id: kImageToolID,
  titleBase: "Image",
  modelClass: ImageContentModel,
  metadataClass: TileMetadataModel,
  defaultContent: defaultImageContent
});

registerTileComponentInfo({
  id: kImageToolID,
  Component: ImageToolComponent,
  tileEltClass: "image-tool-tile",
  tileHandlesOwnSelection: true,
  Icon: ImageToolIcon
});
