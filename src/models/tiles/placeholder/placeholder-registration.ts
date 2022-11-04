import { registerToolComponentInfo } from "../tile-component-info";
import { registerToolContentInfo } from "../tile-content-info";
import { kPlaceholderToolID, PlaceholderContentModel } from "./placeholder-content";
import PlaceholderToolComponent from "../../../components/tiles/placeholder/placeholder-tile";

function defaultPlaceholderContent() {
  return PlaceholderContentModel.create();
}

registerToolContentInfo({
  id: kPlaceholderToolID,
  modelClass: PlaceholderContentModel,
  defaultContent: defaultPlaceholderContent
});

registerToolComponentInfo({
  id: kPlaceholderToolID,
  Component: PlaceholderToolComponent,
  toolTileClass: "placeholder-tile",
  tileHandlesOwnSelection: true
});
