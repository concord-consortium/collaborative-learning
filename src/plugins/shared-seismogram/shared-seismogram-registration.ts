import { kSharedSeismogramType, SharedSeismogram } from "./shared-seismogram";
import { registerSharedModelInfo } from "../../models/shared/shared-model-registry";

registerSharedModelInfo({
  type: kSharedSeismogramType,
  modelClass: SharedSeismogram,
  hasName: false,
});
