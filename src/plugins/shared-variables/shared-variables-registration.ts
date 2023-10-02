import { registerSharedModelInfo } from "../../models/shared/shared-model-registry";
import { registerTextPluginInfo } from "../../models/tiles/text/text-plugin-info";
import { kSharedVariablesID, SharedVariables } from "./shared-variables";
import { NewVariableTextButton, InsertVariableTextButton, EditVariableTextButton,
  kNewVariableButtonName, kInsertVariableButtonName, kEditVariableButtonName} from "./slate/text-tile-buttons";
import { kVariableTextPluginName, VariablesPlugin } from "./slate/variables-plugin";
import { registerDrawingObjectInfo, registerDrawingToolInfo } from "../drawing/components/drawing-object-manager";
import { EditVariableButton, InsertVariableButton, NewVariableButton, VariableChipComponent, VariableChipObject }
  from "./drawing/variable-object";
import { registerTileToolbarButtons } from "../../components/toolbar/toolbar-button-manager";

registerSharedModelInfo({
  type: kSharedVariablesID,
  modelClass: SharedVariables
});

registerTextPluginInfo({
  pluginName: kVariableTextPluginName,
  createSlatePlugin(textContent) {
    const plugin = new VariablesPlugin(textContent);
    plugin.addTileSharedModelWhenReady();
    return plugin;
  },
});

registerTileToolbarButtons('text', [
  {
    name: kNewVariableButtonName,
    title: "New Variable",
    component: NewVariableTextButton
  },
  {
    name: kInsertVariableButtonName,
    title: "Insert Variable",
    component: InsertVariableTextButton
  },
  {
    name: kEditVariableButtonName,
    title: "Edit Variable",
    component: EditVariableTextButton
  },
]);

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
