import { registerToolComponentInfo } from "./tile-component-info";
import { registerToolContentInfo } from "./tile-content-info";
import { kUnknownToolID, UnknownContentModel, UnknownContentModelType } from "./tile-types";
import PlaceholderToolComponent from "../../components/tiles/placeholder/placeholder-tile";

export function defaultContent(): UnknownContentModelType {
  return UnknownContentModel.create();
}

registerToolContentInfo({
  id: kUnknownToolID,
  modelClass: UnknownContentModel,
  defaultContent
});

registerToolComponentInfo({
  id: kUnknownToolID,
  Component: PlaceholderToolComponent,
  toolTileClass: "placeholder-tile",
  tileHandlesOwnSelection: true
});
