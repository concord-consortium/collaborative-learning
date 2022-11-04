import { registerTileComponentInfo } from "./tile-component-info";
import { registerTileContentInfo } from "./tile-content-info";
import { kUnknownToolID, UnknownContentModel, IUnknownContentModel } from "./tile-types";
import PlaceholderTileComponent from "../../components/tiles/placeholder/placeholder-tile";

export function defaultContent(): IUnknownContentModel {
  return UnknownContentModel.create();
}

registerTileContentInfo({
  id: kUnknownToolID,
  modelClass: UnknownContentModel,
  defaultContent
});

registerTileComponentInfo({
  id: kUnknownToolID,
  Component: PlaceholderTileComponent,
  tileEltClass: "placeholder-tile",
  tileHandlesOwnSelection: true
});
