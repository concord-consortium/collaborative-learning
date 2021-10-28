import { registerToolContentInfo } from "./tool-content-info";
import { kUnknownToolID, UnknownContentModel, UnknownContentModelType } from "./tool-types";

export function defaultContent(): UnknownContentModelType {
  return UnknownContentModel.create();
}

registerToolContentInfo({
  id: kUnknownToolID,
  tool: "unknown",
  modelClass: UnknownContentModel,
  defaultContent
});
