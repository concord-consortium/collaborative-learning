import { registerSharedModelInfo } from "../../models/shared/shared-model-registry";
import { registerTextPluginInfo } from "../../models/tiles/text/text-plugin-info";
import { kSharedVariablesID, SharedVariables } from "./shared-variables";
import VariablesToolIcon from "./slate/variables.svg";
import AddVariableChipIcon from "./assets/add-variable-chip-icon.svg";
import InsertVariableChipIcon from "./assets/insert-variable-chip-icon.svg";
import VariableEditorIcon from "./assets/variable-editor-icon.svg";
import { VariablesPlugin} from "./slate/variables-plugin";
import { updateAfterSharedModelChanges } from "./slate/variables-text-content";
import { registerDrawingObjectInfo, registerDrawingToolInfo } from "../drawing/components/drawing-object-manager";
import { EditVariableButton, InsertVariableButton, NewVariableButton, VariableChipComponent, VariableChipObject }
  from "./drawing/variable-object";

registerSharedModelInfo({
  type: kSharedVariablesID,
  modelClass: SharedVariables
});

// FIXME: clean this up.
// Should one registerPlugin call add all the variable buttons? Probably.
// Adding it this way (multiple registrations and buttons specified in the settings of app config for now
// so I can work on the funtionality of the buttons.

//"new-variable", "insert-variable", "edit-variable"
registerTextPluginInfo({
  iconName: "new-variable",
  Icon: AddVariableChipIcon,
  toolTip: "New Variable",
  createSlatePlugin: textContent=> VariablesPlugin(textContent),
  command: "new-text-variable",
  updateTextContentAfterSharedModelChanges: updateAfterSharedModelChanges
});
registerTextPluginInfo({
  iconName: "insert-variable",
  Icon: InsertVariableChipIcon,
  toolTip: "Insert Variable",
  command: "insert-text-variable",
  updateTextContentAfterSharedModelChanges: updateAfterSharedModelChanges
});
registerTextPluginInfo({
  iconName: "edit-variable",
  Icon: VariableEditorIcon,
  toolTip: "Edit Variable",
  command: "edit-text-variable",
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
