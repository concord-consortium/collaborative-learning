import { registerTileComponentInfo } from "../tile-component-info";
import { registerTileContentInfo } from "../tile-content-info";
import { kPlaceholderTileDefaultHeight } from "./placeholder-constants";
import { kPlaceholderTileType, PlaceholderContentModel } from "./placeholder-content";
import PlaceholderTileComponent from "../../../components/tiles/placeholder/placeholder-tile";

function defaultPlaceholderContent() {
  return PlaceholderContentModel.create();
}

registerTileContentInfo({
  type: kPlaceholderTileType,
  modelClass: PlaceholderContentModel,
  defaultContent: defaultPlaceholderContent,
  defaultHeight: kPlaceholderTileDefaultHeight
});

registerTileComponentInfo({
  type: kPlaceholderTileType,
  Component: PlaceholderTileComponent,
  tileEltClass: "placeholder-tile",
  tileHandlesOwnSelection: true
});
