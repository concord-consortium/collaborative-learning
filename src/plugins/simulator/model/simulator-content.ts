import { reaction } from "mobx";
import { types, Instance, getType, addDisposer, getSnapshot } from "mobx-state-tree";

import { brainwavesGrabberVariables } from "../simulations/brainwaves-grabber";
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
    type: types.optional(types.literal(kSimulatorTileType), kSimulatorTileType),
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
  }))
  .views(self => ({
    getVariable(name: string) {
      return self.sharedModel?.variables.find(v => v.name === name);
    }
  }))
  // .views(self => ({
  //   get timeVariable() {
  //     return self.sharedModel?.variables.find(variable => variable.name === "time");
  //   },
  //   get xVariable() {
  //     return self.sharedModel?.variables.find(variable => variable.name === "x");

  //   },
  //   get yVariable() {
  //     return self.sharedModel?.variables.find(variable => variable.name === "y");
  //   }
  // }))
  .actions(self => ({
    // TODO: Do we want to attach to an existing SharedVariables if one exists when the tile is created?
    // Currently, it will be impossible to link to a Diagram tile.
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
          sharedModelManager.addTileSharedModel(self, containerSharedModel);
        }

        // Set up starter variables
        
        // TODO: VariableSnapshotType
        const defaultVariableSnapshots = brainwavesGrabberVariables;
        defaultVariableSnapshots.forEach((variableSnapshot: any) => {
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

        //     // TODO: Set up starter variables
        //   }

        //   // TODO: This will currently generate multiple history events because it
        //   // is running outside of a document tree action.
        //   // Add the shared model to both the document and the tile
        //   sharedModelManager.addTileSharedModel(self, containerSharedModel);
        // }

        // // If there isn't a time variable create one
        // let timeVariable = containerSharedModel.variables.find(variable => variable.name === "time");
        // if (!timeVariable) {
        //   timeVariable = containerSharedModel.createVariable();
        //   timeVariable.setName("time");
        //   timeVariable.setValue(0);
        // }
      },
      {name: "sharedModelSetup", fireImmediately: true}));
    },
    updateAfterSharedModelChanges() {
      // nothing to do here
    },
    // step() {
    //   const {timeVariable} = self;
    //   if (timeVariable?.value === undefined) {
    //     timeVariable?.setValue(0);
    //   } else {
    //     timeVariable?.setValue(timeVariable.value + 0.05);
    //   }

    //   self.sharedModel?.variables.forEach(variable => {
    //     if (variable.name?.startsWith("prev_")) {
    //       const realName = variable.name?.substring(5);
    //       const realVariable = self.sharedModel?.variables.find(_var => _var.name === realName);
    //       if (realVariable && realVariable.computedValue !== undefined) {
    //         variable.setValue(realVariable.computedValue);
    //       }
    //     }
    //   });
    // }
  }));

export interface SimulatorContentModelType extends Instance<typeof SimulatorContentModel> {}
