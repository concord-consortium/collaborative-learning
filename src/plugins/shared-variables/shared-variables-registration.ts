import { registerSharedModelInfo } from "../../models/shared/shared-model-registry";
import { registerTextPluginInfo } from "../../models/tiles/text/text-plugin-info";
import { kSharedVariablesID, SharedVariables } from "./shared-variables";
import VariablesToolIcon from "./slate/variables.svg";
import { VariableComponent } from "./slate/variables-plugin";
import { updateAfterSharedModelChanges } from "./slate/variables-text-content";
import { registerDrawingObjectInfo, registerDrawingToolInfo } from "../drawing/components/drawing-object-manager";
import { EditVariableButton, InsertVariableButton, NewVariableButton, VariableChipComponent, VariableChipObject }
  from "./drawing/variable-object";

registerSharedModelInfo({
  type: kSharedVariablesID,
  modelClass: SharedVariables
});

registerTextPluginInfo({
  iconName: "m2s-variables",
  Icon: VariablesToolIcon,
  toolTip: "Variables",
  createSlatePlugin: (textContent) => {console.log('createSlatePLugin'); return "FIXME"},//FIXME: VariableComponent(textContent),
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
  buttonComponent: InsertVariableButton
});

registerDrawingToolInfo({
  name: "new-variable",
  buttonComponent: NewVariableButton
});

registerDrawingToolInfo({
  name: "edit-variable",
  buttonComponent: EditVariableButton
});
