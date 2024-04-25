import { SharedProgramData, kSharedProgramDataType } from "../../plugins/shared-program-data/shared-program-data";
import { registerSharedModelInfo } from "./shared-model-registry";

registerSharedModelInfo({
  type: kSharedProgramDataType,
  modelClass: SharedProgramData,
  hasName: false
});
