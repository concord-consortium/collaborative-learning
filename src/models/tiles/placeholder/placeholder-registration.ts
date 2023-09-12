import { registerTileComponentInfo } from "../tile-component-info";
import { registerTileContentInfo } from "../tile-content-info";
import { kPlaceholderTileType, kPlaceholderTileDefaultHeight, PlaceholderContentModel } from "./placeholder-content";
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
