import { registerSharedModelInfo } from "../../models/tools/tool-content-info";
import { kSharedVariablesID, SharedVariables } from "./shared-variables";

registerSharedModelInfo({
  type: kSharedVariablesID,
  modelClass: SharedVariables
});
