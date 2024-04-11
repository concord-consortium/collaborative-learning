import { kSharedProgramDataType, SharedProgramData } from "../../plugins/dataflow/model/shared-program-data";
import { registerSharedModelInfo } from "./shared-model-registry";

registerSharedModelInfo({
  type: kSharedProgramDataType,
  modelClass: SharedProgramData,
  hasName: false
});
