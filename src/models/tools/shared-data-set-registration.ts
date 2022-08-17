import { kSharedDataSetType, SharedDataSet } from "./shared-data-set";
import { registerSharedModelInfo } from "./tool-content-info";

registerSharedModelInfo({
  type: kSharedDataSetType,
  modelClass: SharedDataSet
});
