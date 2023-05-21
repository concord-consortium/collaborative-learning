import { reaction } from "mobx";
import { types, Instance, getType, addDisposer, getSnapshot } from "mobx-state-tree";
import { ITileExportOptions } from "../../models/tiles/tile-content-info";
import { TileContentModel } from "../../models/tiles/tile-content";
import { SharedVariables, SharedVariablesType } from "../shared-variables/shared-variables";
import { kSimulatorTileType } from "./simulator-types";

export function defaultSimulatorContent(): SimulatorContentModelType {
  return SimulatorContentModel.create({text: "Hello World"});
}


export const SimulatorContentModel = TileContentModel
  .named("SimulatorTool")
  .props({
    type: types.optional(types.literal(kSimulatorTileType), kSimulatorTileType),
    text: "",
  })
  .views(self => ({
    exportJson(options?: ITileExportOptions) {
      // crude, but enough to get us started
      return JSON.stringify(getSnapshot(self));
    },
    get isUserResizable() {
      return true;
    },
    get sharedModel() {
      const sharedModelManager = self.tileEnv?.sharedModelManager;
      // Perhaps we should pass the type to getTileSharedModel, so it can return the right value
      // just like findFirstSharedModelByType does
      //
      // For now we are checking the type ourselves, and we are assuming the shared model we want
      // is the first one.
      const firstSharedModel = sharedModelManager?.getTileSharedModels(self)?.[0];
      if (!firstSharedModel || getType(firstSharedModel) !== SharedVariables) {
        return undefined;
      }
      return firstSharedModel as SharedVariablesType;
    },
  }))
  .views(self => ({
    get timeVariable() {
      return self.sharedModel?.variables.find(variable => variable.name === "time");
    },
    get xVariable() {
      return self.sharedModel?.variables.find(variable => variable.name === "x");

    },
    get yVariable() {
      return self.sharedModel?.variables.find(variable => variable.name === "y");
    }
  }))
  .actions(self => ({
    setText(text: string) {
      self.text = text;
    },
    afterAttach() {

      // Monitor our parents and update our shared model when we have a document parent
      addDisposer(self, reaction(() => {
        const sharedModelManager = self.tileEnv?.sharedModelManager;

        const containerSharedModel = sharedModelManager?.isReady ?
          sharedModelManager?.findFirstSharedModelByType(SharedVariables) : undefined;

        const tileSharedModels = sharedModelManager?.isReady ?
          sharedModelManager?.getTileSharedModels(self) : undefined;

        const values = {sharedModelManager, containerSharedModel, tileSharedModels};
        return values;
      },
      ({sharedModelManager, containerSharedModel, tileSharedModels}) => {
        if (!sharedModelManager?.isReady) {
          // We aren't added to a document yet so we can't do anything yet
          return;
        }

        if (containerSharedModel && tileSharedModels?.includes(containerSharedModel)) {
          // We already have a shared model so we skip some steps
          // below. If we don't skip these steps we can get in an infinite
          // loop.
        } else {
          if (!containerSharedModel) {
            // The document doesn't have a shared model yet
            containerSharedModel = SharedVariables.create();
          }

          // TODO: This will currently generate multiple history events because it
          // is running outside of a document tree action.
          // Add the shared model to both the document and the tile
          sharedModelManager.addTileSharedModel(self, containerSharedModel);
        }

        // If there isn't a time variable create one
        let timeVariable = containerSharedModel.variables.find(variable => variable.name === "time");
        if (!timeVariable) {
          timeVariable = containerSharedModel.createVariable();
          timeVariable.setName("time");
          timeVariable.setValue(0);
        }
      },
      {name: "sharedModelSetup", fireImmediately: true}));
    },
    updateAfterSharedModelChanges() {
      // nothing to do here
    },
    step() {
      const {timeVariable} = self;
      if (timeVariable?.value === undefined) {
        timeVariable?.setValue(0);
      } else {
        timeVariable?.setValue(timeVariable.value + 0.05);
      }

      self.sharedModel?.variables.forEach(variable => {
        if (variable.name?.startsWith("prev_")) {
          const realName = variable.name?.substring(5);
          const realVariable = self.sharedModel?.variables.find(_var => _var.name === realName);
          if (realVariable && realVariable.computedValue !== undefined) {
            variable.setValue(realVariable.computedValue);
          }
        }
      });
    }
  }));

export interface SimulatorContentModelType extends Instance<typeof SimulatorContentModel> {}
