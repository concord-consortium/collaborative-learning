import { reaction } from "mobx";
import { types, Instance, getType, addDisposer, getSnapshot } from "mobx-state-tree";
import { VariableSnapshot } from "@concord-consortium/diagram-view";

import { kBrainwavesKey } from "../simulations/brainwaves-gripper";
import { simulations } from "../simulations/simulations";
import { ITileExportOptions } from "../../../models/tiles/tile-content-info";
import { TileContentModel } from "../../../models/tiles/tile-content";
import { kSharedVariablesID, SharedVariables, SharedVariablesType } from "../../shared-variables/shared-variables";
import { kSimulatorTileType } from "../simulator-types";
import { SharedModelType } from "../../../models/shared/shared-model";

export function defaultSimulatorContent(): SimulatorContentModelType {
  return SimulatorContentModel.create({});
}

export const SimulatorContentModel = TileContentModel
  .named("SimulatorTool")
  .props({
    simulation: types.optional(types.string, kBrainwavesKey),
    type: types.optional(types.literal(kSimulatorTileType), kSimulatorTileType),
  })
  .volatile(self => ({
    frame: 0
  }))
  .views(self => ({
    exportJson(options?: ITileExportOptions) {
      // crude, but enough to get us started
      return JSON.stringify(getSnapshot(self), null, 2);
    },
    get isUserResizable() {
      return true;
    },
    get sharedModel() {
      const sharedModelManager = self.tileEnv?.sharedModelManager;
      const sharedModels = sharedModelManager?.getTileSharedModels(self);
      const sharedVariables =
        sharedModels?.filter((sharedModel: SharedModelType) => sharedModel.type === kSharedVariablesID);
      // We're assuming we want the first SharedVariable associated with this tile.
      const firstSharedModel = sharedVariables?.[0];
      if (!firstSharedModel || getType(firstSharedModel) !== SharedVariables) {
        return undefined;
      }
      return firstSharedModel as SharedVariablesType;
    },
    get simulationData() {
      return simulations[self.simulation];
    }
  }))
  .views(self => ({
    getVariable(name: string) {
      return self.sharedModel?.variables.find(v => v.name === name);
    }
  }))
  .actions(self => ({
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

        if (!containerSharedModel) {
          containerSharedModel = SharedVariables.create();
        }

        if (!tileSharedModels?.includes(containerSharedModel)) {
          // TODO: This will currently generate multiple history events because it
          // is running outside of a document tree action.
          // Add the shared model to both the document and the tile
          sharedModelManager.addTileSharedModel(self, containerSharedModel);
        }

        // Set up starter variables
        const defaultVariableSnapshots = self.simulationData.variables;
        defaultVariableSnapshots.forEach((variableSnapshot: VariableSnapshot) => {
          const variable = containerSharedModel?.variables.find(v => v.name === variableSnapshot.name);
          if (!variable) {
            containerSharedModel?.createVariable(variableSnapshot);
          }
        });

        // if (containerSharedModel && tileSharedModels?.includes(containerSharedModel)) {
        //   // We already have a shared model so we skip some steps
        //   // below. If we don't skip these steps we can get in an infinite
        //   // loop.
        // } else {
        //   if (!containerSharedModel) {
        //     // The document doesn't have a shared model yet
        //     containerSharedModel = SharedVariables.create();
        //   }

        //   // TODO: This will currently generate multiple history events because it
        //   // is running outside of a document tree action.
        //   // Add the shared model to both the document and the tile
        //   sharedModelManager.addTileSharedModel(self, containerSharedModel);
        // }
      },
      {name: "sharedModelSetup", fireImmediately: true}));
    },
    updateAfterSharedModelChanges() {
      // nothing to do here
    },
    step() {
      // Update all variables that have specified values
      for (const [name, values] of Object.entries(self.simulationData.values)) {
        const variable = self.getVariable(name);
        variable?.setValue(values[self.frame % values.length]);
      }

      // Increment the frame
      self.frame++;
    }
  }));

export interface SimulatorContentModelType extends Instance<typeof SimulatorContentModel> {}
