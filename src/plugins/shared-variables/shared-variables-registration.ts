import { Editor } from "@concord-consortium/slate-editor";
import { registerTileToolbarButtons } from "../../components/toolbar/toolbar-button-manager";
import { IClueTileObject } from "../../models/annotations/clue-object";
import { ISharedModelManager } from "../../models/shared/shared-model-manager";
import { registerSharedModelInfo } from "../../models/shared/shared-model-registry";
import { TextContentModelType } from "../../models/tiles/text/text-content";
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
import { kVariableFormat, kVariableTextPluginName, VariablesPlugin } from "./slate/variables-plugin";


registerSharedModelInfo({
  type: kSharedVariablesID,
  modelClass: SharedVariables,
  hasName: false
});

// Look up the per-textContent plugin instance from the info-level `getAnnotatableObjects`
// hook, which has only `textContent` to work with. WeakMap keeps GC behavior intact —
// when the textContent is collected, its plugin entry goes with it.
const gPluginByContent = new WeakMap<TextContentModelType, VariablesPlugin>();

registerTextPluginInfo({
  pluginName: kVariableTextPluginName,
  createSlatePlugin(textContent) {
    const plugin = new VariablesPlugin(textContent);
    plugin.addTileSharedModelWhenReady();
    gPluginByContent.set(textContent, plugin);
    return plugin;
  },
  getAnnotatableObjects(textContent): IClueTileObject[] {
    // Read textContent.editor BEFORE the WeakMap lookup so MobX tracks it even when
    // the plugin isn't yet registered. The text tile sets the editor (via setEditor)
    // immediately after createSlatePlugin populates the WeakMap, so once that observable
    // changes, the next re-evaluation will find both editor and plugin.
    const editor = textContent.editor;
    const plugin = gPluginByContent.get(textContent);
    if (!plugin || !editor) return [];
    // Track the revision so MobX re-evaluates when variable chips are added or removed.
    // eslint-disable-next-line unused-imports/no-unused-vars
    const _pluginRevision = plugin.variableChipsRevision;
    const objects: IClueTileObject[] = [];
    for (const [node] of Editor.nodes(editor, { at: [], mode: "all" })) {
      const anyNode = node as any;
      if (anyNode?.type === kVariableFormat && typeof anyNode.reference === "string") {
        objects.push({ objectId: anyNode.reference, objectType: kVariableFormat });
      }
    }
    return objects;
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
