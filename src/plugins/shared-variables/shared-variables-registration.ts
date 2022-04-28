import { registerPluginToolInfo } from "../../models/tools/text/text-plugin-info";
import { registerSharedModelInfo } from "../../models/tools/tool-content-info";
import { kSharedVariablesID, SharedVariables } from "./shared-variables";
import VariablesToolIcon from "./slate/variables.svg";
import { VariablesPlugin } from "./slate/variables-plugin";

registerSharedModelInfo({
  type: kSharedVariablesID,
  modelClass: SharedVariables
});

registerPluginToolInfo({
  iconName: "m2s-variables",
  Icon: VariablesToolIcon,
  toolTip: "Variables",
  createSlatePlugin: (textContent) => VariablesPlugin(textContent),
  command: "configureVariable",
});
