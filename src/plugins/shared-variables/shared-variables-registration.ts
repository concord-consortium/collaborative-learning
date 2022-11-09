import { registerSharedModelInfo } from "../../models/shared/shared-model-registry";
import { registerTextPluginInfo } from "../../models/tiles/text/text-plugin-info";
import { kSharedVariablesID, SharedVariables } from "./shared-variables";
import VariablesToolIcon from "./slate/variables.svg";
import { VariablesPlugin } from "./slate/variables-plugin";
import { updateAfterSharedModelChanges } from "./slate/variables-text-content";
import { registerDrawingObjectInfo, registerDrawingToolInfo } from "../drawing/components/drawing-object-manager";
import { EditVariableButton, EditVariableTool, InsertVariableTool, InsertVariableButton, NewVariableButton,
  NewVariableTool, VariableChipComponent, VariableChipObject }
  from "./drawing/variable-object";

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
  name: "insert-variable",
  toolClass: InsertVariableTool,
  buttonComponent: InsertVariableButton
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
