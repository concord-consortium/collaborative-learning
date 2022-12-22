import { registerSharedModelInfo } from "../../models/shared/shared-model-registry";
import { registerTextPluginInfo } from "../../models/tiles/text/text-plugin-info";
import { kSharedVariablesID, SharedVariables } from "./shared-variables";
import AddVariableChipIcon from "./assets/add-variable-chip-icon.svg";
import InsertVariableChipIcon from "./assets/insert-variable-chip-icon.svg";
import VariableEditorIcon from "./assets/variable-editor-icon.svg";
import { VariablesPlugin, shouldShowEditVariableButton} from "./slate/variables-plugin";
import { updateAfterSharedModelChanges } from "./slate/variables-text-content";
import { registerDrawingObjectInfo, registerDrawingToolInfo } from "../drawing/components/drawing-object-manager";
import { EditVariableButton, InsertVariableButton, NewVariableButton, VariableChipComponent, VariableChipObject }
  from "./drawing/variable-object";
import { useEditVariableDialog } from "./dialog/use-edit-variable-dialog";
import { useNewVariableDialog } from "./dialog/use-new-variable-dialog";
import { useInsertVariableDialog } from "./dialog/use-insert-variable-dialog";

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
  command: useNewVariableDialog,
  updateTextContentAfterSharedModelChanges: updateAfterSharedModelChanges,
  buttonEnabled: () => true
});
registerTextPluginInfo({
  iconName: "insert-variable",
  Icon: InsertVariableChipIcon,
  toolTip: "Insert Variable",
  command: useInsertVariableDialog,
  updateTextContentAfterSharedModelChanges: updateAfterSharedModelChanges,
  buttonEnabled: () => true
});
registerTextPluginInfo({
  iconName: "edit-variable",
  Icon: VariableEditorIcon,
  toolTip: "Edit Variable",
  command: useEditVariableDialog,
  updateTextContentAfterSharedModelChanges: updateAfterSharedModelChanges,
  buttonEnabled: shouldShowEditVariableButton,
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
