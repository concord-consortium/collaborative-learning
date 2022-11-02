import { registerTextPluginInfo } from "../../models/tools/text/text-plugin-info";
import { registerSharedModelInfo } from "../../models/tools/tool-content-info";
import { kSharedVariablesID, SharedVariables } from "./shared-variables";
import VariablesToolIcon from "./slate/variables.svg";
import { VariablesPlugin } from "./slate/variables-plugin";
import { updateAfterSharedModelChanges } from "./slate/variables-text-content";
import { registerDrawingObjectInfo, registerDrawingToolInfo } from "../drawing-tool/components/drawing-object-manager";
import { EditVariableButton, EditVariableTool, NewVariableButton, NewVariableTool, VariableChipComponent,
  VariableChipObject, VariableChipToolbarButton, VariableDrawingTool } from "./drawing/variable-object";

registerSharedModelInfo({
  type: kSharedVariablesID,
  modelClass: SharedVariables
});

registerTextPluginInfo({
  iconName: "m2s-variables",
  Icon: VariablesToolIcon,
  toolTip: "Variables",
  createSlatePlugin: (textContent) => VariablesPlugin(textContent),
  command: "configureVariable",
  updateTextContentAfterSharedModelChanges: updateAfterSharedModelChanges
});

registerDrawingObjectInfo({
  type: "variable",
  component:VariableChipComponent,
  modelClass: VariableChipObject
});

registerDrawingToolInfo({
  name: "new-variable",
  toolClass: NewVariableTool,
  buttonComponent: NewVariableButton
});

registerDrawingToolInfo({
  name: "edit-variable",
  toolClass: EditVariableTool,
  buttonComponent: EditVariableButton
});

registerDrawingToolInfo({
  name: "variable",
  toolClass: VariableDrawingTool,
  buttonComponent: VariableChipToolbarButton
});


