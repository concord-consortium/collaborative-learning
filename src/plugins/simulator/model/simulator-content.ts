import { reaction } from "mobx";
import { types, Instance, getType, addDisposer, getSnapshot } from "mobx-state-tree";
import { VariableSnapshot, VariableType } from "@concord-consortium/diagram-view";

import { withoutUndo } from "../../../models/history/without-undo";
import { ITileExportOptions } from "../../../models/tiles/tile-content-info";
import { ITileContentModel, TileContentModel } from "../../../models/tiles/tile-content";
import { getAppConfig } from "../../../models/tiles/tile-environment";
import { SharedModelType } from "../../../models/shared/shared-model";
import { isInputVariable, isOutputVariable } from "../../shared-variables/simulations/simulation-utilities";
import { kSimulatorTileType } from "../simulator-types";
import { kSharedVariablesID, SharedVariables, SharedVariablesType } from "../../shared-variables/shared-variables";
import { defaultSimulationKey, simulations } from "../simulations/simulations";
import { SharedProgramData, SharedProgramDataType } from "../../shared-program-data/shared-program-data";
import { IClueTileObject } from "../../../models/annotations/clue-object";
import { tileContentAPIViews } from "../../../models/tiles/tile-model-hooks";
import { kPotentiometerServoKey } from "../simulations/potentiometer-servo/potentiometer-servo";
import { getMiniNodesDisplayData } from "../simulations/potentiometer-servo/chip-sim-utils";

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
      // ignore options?.forHash option - return default export when hashing
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
    get sharedProgramData() {
      const sharedModelManager = self.tileEnv?.sharedModelManager;
      const sharedModels = sharedModelManager?.getTileSharedModels(self); // only returns those who are attached
      const sharedProgramData = sharedModels?.filter( sharedModel => {
        return sharedModel.type === "SharedProgramData";
      });
      return sharedProgramData?.[0] as SharedProgramDataType;
    }
  }))
  .views(self => ({
    get variables() {
      return self.sharedModel?.variables;
    },
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
  .views(self => tileContentAPIViews({
    get annotatableObjects(): IClueTileObject[] {
      if (self.simulation === kPotentiometerServoKey) {
        // Make an annotatable object for each mini-node
        const nodeData = getMiniNodesDisplayData(self.sharedProgramData);
        const visibleNodes = [
          ...nodeData.inputNodesArr,
          ...nodeData.operatorNodesArr,
          ...nodeData.outputNodesArr];
        const nodeObjects = visibleNodes.map(node =>
          ({
            objectId: node.id,
            objectType: "node"
          }));

        // Plus an object for each of the 14 pins on each side of the image
        const boardPins = [
          ...Array.from({ length: 14 }, (o, index) => `L${index}`),
          ...Array.from({ length: 14 }, (o, index) => `R${index}`)
        ];
        const pinObjects = boardPins.map(pin =>
          ({
            objectId: pin,
            objectType: "pin"
          }));

        return [...nodeObjects, ...pinObjects];
      }
      return [];
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
          sharedModelManager?.getTileSharedModels(self) : undefined; // only returns those who are attached

        const ourSharedProgramData = tileSharedModels?.find( sharedModel => {
          return getType(sharedModel) === SharedProgramData;
        });

        const existingSharedPrograms = sharedModelManager?.isReady ?
          sharedModelManager?.getSharedModelsByType("SharedProgramData") : undefined;

        const programsWithDataflowTiles: SharedModelType[] = [];
        existingSharedPrograms?.forEach((program) => {
          const programTiles = sharedModelManager?.getSharedModelTiles(program);
          if (programTiles?.find((tile) => tile?.content?.type === "Dataflow")) {
            programsWithDataflowTiles.push(program);
          }
        });

        const values = {
          sharedModelManager,
          containerSharedModel,
          tileSharedModels,
          programsWithDataflowTiles,
          ourSharedProgramData
        };
        return values;
      },
      ({
        sharedModelManager,
        containerSharedModel,
        tileSharedModels,
        programsWithDataflowTiles,
        ourSharedProgramData
      }) => {
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

        if (programsWithDataflowTiles.length > 0) {
          if(ourSharedProgramData) {
            if (!programsWithDataflowTiles.includes(ourSharedProgramData)) {
              sharedModelManager.removeTileSharedModel(self, ourSharedProgramData);
              sharedModelManager.addTileSharedModel(self, programsWithDataflowTiles[0]);
            }
          } else {
            sharedModelManager.addTileSharedModel(self, programsWithDataflowTiles[0]);
          }
        }

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

export function isSimulatorModel(model?: ITileContentModel): model is SimulatorContentModelType {
  return model?.type === kSimulatorTileType;
}
