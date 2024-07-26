import { registerTileComponentInfo } from "../../models/tiles/tile-component-info";
import { registerTileContentInfo } from "../../models/tiles/tile-content-info";
import { TileMetadataModel } from "../../models/tiles/tile-metadata";
import { kDataCardDefaultHeight, kDataCardTileType } from "./data-card-types";
import { DataCardToolComponent } from "./data-card-tile";
import {
  defaultDataCardContent, DataCardContentModel, updateDataCardContentWithNewSharedModelIds
} from "./data-card-content";

import Icon from "./assets/data-card-tool.svg";
import HeaderIcon from "./assets/data-cards-tile-id.svg";

registerTileContentInfo({
  type: kDataCardTileType,
  modelClass: DataCardContentModel,
  titleBase: "Card Deck Data",
  displayName: "Data Cards",
  shortName: "Data Card",
  useContentTitle: true,
  metadataClass: TileMetadataModel,
  defaultContent: defaultDataCardContent,
  defaultHeight: kDataCardDefaultHeight,
  updateContentWithNewSharedModelIds: updateDataCardContentWithNewSharedModelIds,
  isDataProvider: true,
  isDataConsumer: true
});

registerTileComponentInfo({
  type: kDataCardTileType,
  Component: DataCardToolComponent,
  tileEltClass: "data-card-tool-tile",
  Icon,
  HeaderIcon,
});
