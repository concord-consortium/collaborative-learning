import { registerTileToolbarButtons } from "../../components/toolbar/toolbar-button-manager";
import { ISharedModelManager } from "../../models/shared/shared-model-manager";
import { registerSharedModelInfo } from "../../models/shared/shared-model-registry";
import { registerTextPluginInfo } from "../../models/tiles/text/text-plugin-info";
import { registerDrawingObjectInfo, registerDrawingToolInfo } from "../drawing/components/drawing-object-manager";
import { IGraphModel, registerGraphSharedModelUpdateFunction } from "../graph/models/graph-model";
import {
  EditVariableButton, InsertVariableButton, NewVariableButton, VariableChipComponent, VariableChipObject
} from "./drawing/variable-object";
import { PlottedVariablesAdornmentModel
} from "./graph/plotted-variables-adornment/plotted-variables-adornment-model";
import "./graph/plotted-variables-adornment/plotted-variables-adornment-registration";
import {
  kPlottedVariablesType
} from "./graph/plotted-variables-adornment/plotted-variables-adornment-types";
import { kSharedVariablesID, SharedVariables } from "./shared-variables";
import { NewVariableTextButton, InsertVariableTextButton, EditVariableTextButton,
  kNewVariableButtonName, kInsertVariableButtonName, kEditVariableButtonName} from "./slate/text-tile-buttons";
import { kVariableTextPluginName, VariablesPlugin } from "./slate/variables-plugin";

registerSharedModelInfo({
  type: kSharedVariablesID,
  modelClass: SharedVariables,
  hasName: false
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
    component: NewVariableTextButton
  },
  {
    name: kInsertVariableButtonName,
    component: InsertVariableTextButton
  },
  {
    name: kEditVariableButtonName,
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

registerGraphSharedModelUpdateFunction(
  function handleSharedVariablesUpdate(graphModel: IGraphModel, smm: ISharedModelManager) {
    // Display a plotted variables adornment when this is linked to a shared variables model
    const sharedVariableModels = smm.getTileSharedModelsByType(graphModel, SharedVariables);
    if (sharedVariableModels && sharedVariableModels.length > 0) {
      // We're connected to variables; show adornment or create if not there already.
      if (graphModel.getAdornmentOfType(kPlottedVariablesType)) {
        graphModel.showAdornment(kPlottedVariablesType);
      } else {
        const plottedVariablesAdornment = PlottedVariablesAdornmentModel.create();
        plottedVariablesAdornment.addPlottedVariables();
        graphModel.addAdornment(plottedVariablesAdornment);
      }
    } else {
      // Disconnected
      graphModel.hideAdornment(kPlottedVariablesType);
    }
  }
);
