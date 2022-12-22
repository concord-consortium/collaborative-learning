import { registerSharedModelInfo } from "../../models/shared/shared-model-registry";
import { registerTextPluginInfo } from "../../models/tiles/text/text-plugin-info";
import { kSharedVariablesID, SharedVariables } from "./shared-variables";
import AddVariableChipIcon from "./assets/add-variable-chip-icon.svg";
import InsertVariableChipIcon from "./assets/insert-variable-chip-icon.svg";
import VariableEditorIcon from "./assets/variable-editor-icon.svg";
import { VariablesPlugin, shouldShowEditVariableButton} from "./slate/variables-plugin";
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

// The slate plugin is required for all 3 variable plugins but only registered on the first.
registerTextPluginInfo({
  iconName: "new-variable",
  Icon: AddVariableChipIcon,
  toolTip: "New Variable",
  createSlatePlugin: textContent=> VariablesPlugin(textContent),
  modalHook: useNewVariableDialog,
  buttonEnabled: () => true
});

registerTextPluginInfo({
  iconName: "insert-variable",
  Icon: InsertVariableChipIcon,
  toolTip: "Insert Variable",
  modalHook: useInsertVariableDialog,
  buttonEnabled: () => true
});

registerTextPluginInfo({
  iconName: "edit-variable",
  Icon: VariableEditorIcon,
  toolTip: "Edit Variable",
  modalHook: useEditVariableDialog,
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
