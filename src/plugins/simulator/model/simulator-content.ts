import { reaction } from "mobx";
import { types, Instance, getType, addDisposer, getSnapshot } from "mobx-state-tree";
import { VariableSnapshot, VariableType } from "@concord-consortium/diagram-view";

import { withoutUndo } from "../../../models/history/without-undo";
import { ITileExportOptions } from "../../../models/tiles/tile-content-info";
import { TileContentModel } from "../../../models/tiles/tile-content";
import { getAppConfig } from "../../../models/tiles/tile-environment";
import { SharedModelType } from "../../../models/shared/shared-model";
import { isInputVariable, isOutputVariable } from "../../shared-variables/simulations/simulation-utilities";
import { kSimulatorTileType } from "../simulator-types";
import { kSharedVariablesID, SharedVariables, SharedVariablesType } from "../../shared-variables/shared-variables";
import { defaultSimulationKey, simulations } from "../simulations/simulations";
import { SharedProgramDataType } from "../../dataflow/model/shared-program-data";

export function defaultSimulatorContent(): SimulatorContentModelType {
  return SimulatorContentModel.create({});
}

export const SimulatorContentModel = TileContentModel
  .named("SimulatorTool")
  .props({
    simulation: types.maybe(types.string),
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
      // If no simulation has been specified, use the default simulation from appConfig
      if (!self.simulation) {
        const defaultSimulation = getAppConfig(self)?.getSetting("defaultSimulation", "simulator");
        self.simulation = defaultSimulation as string ?? defaultSimulationKey;
      }
      return simulations[self.simulation];
    },
    get sharedProgramData() { // HEY: Will this work without "attachment routine"?
      const sharedModelManager = self.tileEnv?.sharedModelManager;
      const sharedModels = sharedModelManager?.getTileSharedModels(self);
      const sharedProgramData = sharedModels?.filter((sharedModel: SharedModelType) => {
        return sharedModel.type === "SharedProgramData";
      });
      return sharedProgramData?.[0] as SharedProgramDataType;
    }
  }))
  .views(self => ({
    get variables() {
      return self.sharedModel?.variables;
    }
  }))
  .views(self => ({
    getVariable(name?: string) {
      return self.variables?.find(v => v.name === name);
    },
    get inputVariables(): VariableType[] {
      return self.variables?.filter(v => isInputVariable(v)) ?? [];
    },
    get outputVariables(): VariableType[] {
      return self.variables?.filter(v => isOutputVariable(v)) ?? [];
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

        // const sharedProgramModel = sharedModelManager?.isReady ?
        //   sharedModelManager?.findFirstSharedModelByType(SharedProgramData) : undefined;

        const values = {sharedModelManager, containerSharedModel, tileSharedModels, /*sharedProgramModel*/};
        return values;
      },
      ({sharedModelManager, containerSharedModel, tileSharedModels, /*sharedProgramModel*/}) => {
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

        // if(!tileSharedModels?.includes(sharedProgramModel)) {
        //   sharedModelManager.addTileSharedModel(self, sharedProgramModel);
        // }

        // Set up starter variables
        const defaultVariableSnapshots = self.simulationData.variables;
        defaultVariableSnapshots.forEach((variableSnapshot: VariableSnapshot) => {
          const variable = containerSharedModel?.variables.find(v => v.name === variableSnapshot.name);
          if (!variable) {
            containerSharedModel?.createVariable(variableSnapshot);
          }
        });
      },
      {name: "sharedModelSetup", fireImmediately: true}));
    },
    updateAfterSharedModelChanges() {
      // nothing to do here
    },
    step() {
      withoutUndo();

      // Update all variables that have specified values
      for (const [name, values] of Object.entries(self.simulationData.values)) {
        const variable = self.getVariable(name);
        variable?.setValue(values[self.frame % values.length]);
      }

      // Call simulation's step function
      self.simulationData.step?.({ frame: self.frame, variables: self.variables ?? [] });

      // Increment the frame
      self.frame++;
    }
  }));

export interface SimulatorContentModelType extends Instance<typeof SimulatorContentModel> {}
