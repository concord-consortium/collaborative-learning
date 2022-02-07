import { registerToolContentInfo } from "../tool-content-info";
import { kPlaceholderToolID, PlaceholderContentModel } from "./placeholder-content";
import PlaceholderToolComponent from "../../../components/tools/placeholder-tool/placeholder-tool";

function defaultPlaceholderContent() {
  return PlaceholderContentModel.create();
}

registerToolContentInfo({
  id: kPlaceholderToolID,
  modelClass: PlaceholderContentModel,
  defaultContent: defaultPlaceholderContent,
  Component: PlaceholderToolComponent,
  toolTileClass: "placeholder-tile",
  tileHandlesOwnSelection: true
});
