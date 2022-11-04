import { registerTileComponentInfo } from "../tile-component-info";
import { registerTileContentInfo } from "../tile-content-info";
import { kPlaceholderToolID, PlaceholderContentModel } from "./placeholder-content";
import PlaceholderTileComponent from "../../../components/tiles/placeholder/placeholder-tile";

function defaultPlaceholderContent() {
  return PlaceholderContentModel.create();
}

registerTileContentInfo({
  id: kPlaceholderToolID,
  modelClass: PlaceholderContentModel,
  defaultContent: defaultPlaceholderContent
});

registerTileComponentInfo({
  id: kPlaceholderToolID,
  Component: PlaceholderTileComponent,
  tileEltClass: "placeholder-tile",
  tileHandlesOwnSelection: true
});
