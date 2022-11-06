import { registerToolComponentInfo } from "./tool-component-info";
import { registerToolContentInfo } from "./tool-content-info";
import { kUnknownToolID, UnknownContentModel, UnknownContentModelType } from "./tool-types";
import PlaceholderToolComponent from "../../components/tools/placeholder-tool/placeholder-tool";

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
