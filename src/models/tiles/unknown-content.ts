import { registerTileComponentInfo } from "./tile-component-info";
import { registerTileContentInfo } from "./tile-content-info";
import { kUnknownTileType, UnknownContentModel, IUnknownContentModel } from "./tile-types";
import PlaceholderTileComponent from "../../components/tiles/placeholder/placeholder-tile";

export function defaultContent(): IUnknownContentModel {
  return UnknownContentModel.create();
}

registerTileContentInfo({
  type: kUnknownTileType,
  modelClass: UnknownContentModel,
  defaultContent
});

registerTileComponentInfo({
  type: kUnknownTileType,
  Component: PlaceholderTileComponent,
  tileEltClass: "placeholder-tile",
  tileHandlesOwnSelection: true
});
