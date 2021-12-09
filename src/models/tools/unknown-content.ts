import { registerToolContentInfo } from "./tool-content-info";
import { kUnknownToolID, UnknownContentModel, UnknownContentModelType } from "./tool-types";
import PlaceholderToolComponent from "../../components/tools/placeholder-tool/placeholder-tool";

export function defaultContent(): UnknownContentModelType {
  return UnknownContentModel.create();
}

registerToolContentInfo({
  id: kUnknownToolID,
  tool: "unknown",
  modelClass: UnknownContentModel,
  defaultContent,
  // TODO: should really have a separate unknown tool that shows an "unknown tile" message
  Component: PlaceholderToolComponent,
  toolTileClass: "placeholder-tile",
  tileHandlesOwnSelection: true
});
