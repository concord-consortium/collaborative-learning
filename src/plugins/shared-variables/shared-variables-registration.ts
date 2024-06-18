import { registerTileToolbarButtons } from "../../components/toolbar/toolbar-button-manager";
import { ISharedModelManager } from "../../models/shared/shared-model-manager";
import { registerSharedModelInfo } from "../../models/shared/shared-model-registry";
import { registerTextPluginInfo } from "../../models/tiles/text/text-plugin-info";
import { registerDrawingObjectInfo } from "../drawing/components/drawing-object-manager";
import { IGraphModel, registerGraphSharedModelUpdateFunction } from "../graph/models/graph-model";
import { VariableChipComponent, VariableChipObject, NewVariableButton, EditVariableButton, InsertVariableButton
} from "./drawing/variable-object";
import { isPlottedVariablesAdornment, PlottedVariablesAdornmentModel
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

registerTileToolbarButtons("drawing", [
  { name: "new-variable", component: NewVariableButton},
  { name: "insert-variable", component: InsertVariableButton},
  { name: "edit-variable", component: EditVariableButton},
]);

registerDrawingObjectInfo({
  type: "variable",
  component:VariableChipComponent,
  modelClass: VariableChipObject
});

registerGraphSharedModelUpdateFunction(
  function handleSharedVariablesUpdate(graphModel: IGraphModel, smm: ISharedModelManager) {
    // Display a plotted variables adornment when this is linked to a shared variables model
    const sharedVariableModels = smm.getTileSharedModelsByType(graphModel, SharedVariables);
    if (sharedVariableModels && sharedVariableModels.length > 0) {
      // We're connected to variables; make sure adornment is showing, or create if not there already.
      let adornment = graphModel.getAdornmentOfType(kPlottedVariablesType);
      if (adornment) {
        graphModel.showAdornment(kPlottedVariablesType);
      } else {
        adornment = PlottedVariablesAdornmentModel.create();
        graphModel.addAdornment(adornment);
      }
      // Make sure there's at least one PlottedVariables in it.
      if (adornment && isPlottedVariablesAdornment(adornment)) {
        if (adornment.plottedVariables.size === 0) {
          adornment.addPlottedVariables();
        }
      }
    } else {
      // Disconnected
      const adornment = graphModel.getAdornmentOfType(kPlottedVariablesType);
      if (adornment && isPlottedVariablesAdornment(adornment)) {
        adornment.clearPlottedVariables();
      }
      graphModel.hideAdornment(kPlottedVariablesType);
    }
  }
);
