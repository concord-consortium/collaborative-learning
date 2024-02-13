import { registerTileComponentInfo } from "../tile-component-info";
import { registerTileContentInfo } from "../tile-content-info";
import { TileMetadataModel } from "../tile-metadata";
import { kImageTileType, ImageContentModel, defaultImageContent } from "./image-content";
import ImageToolComponent from "../../../components/tiles/image/image-tile";

import Icon from "../../../clue/assets/icons/image-tool.svg";
import HeaderIcon from "../../../assets/icons/sort-by-tools/image-tile-id.svg";

registerTileContentInfo({
  type: kImageTileType,
  displayName: "Image",
  modelClass: ImageContentModel,
  metadataClass: TileMetadataModel,
  defaultContent: defaultImageContent
});

registerTileComponentInfo({
  type: kImageTileType,
  Component: ImageToolComponent,
  tileEltClass: "image-tool-tile",
  tileHandlesOwnSelection: true,
  Icon,
  HeaderIcon
});
