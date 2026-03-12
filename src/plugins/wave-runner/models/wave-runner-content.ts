import { getType, types, Instance } from "mobx-state-tree";
import { TileContentModel } from "../../../models/tiles/tile-content";
import { getSharedModelManager } from "../../../models/tiles/tile-environment";
import { SharedSeismogram, SharedSeismogramType } from "../../shared-seismogram/shared-seismogram";
import { kWaveRunnerTileType } from "../wave-runner-types";

export function defaultWaveRunnerContent(): WaveRunnerContentModelType {
  return WaveRunnerContentModel.create();
}

export const WaveRunnerContentModel = TileContentModel
  .named("WaveRunnerTool")
  .props({
    type: types.optional(types.literal(kWaveRunnerTileType), kWaveRunnerTileType),
  })
  .views(self => ({
    get isUserResizable() {
      return true;
    },
    get sharedSeismogram(): SharedSeismogramType | undefined {
      const smm = getSharedModelManager(self);
      return smm?.findFirstSharedModelByType(SharedSeismogram);
    },
    get isLoading() {
      return this.sharedSeismogram?.isLoading ?? false;
    },
    get loadError() {
      return this.sharedSeismogram?.loadError ?? null;
    },
    get hasData() {
      return this.sharedSeismogram?.hasData ?? false;
    }
  }))
  .actions(self => ({
    async loadData() {
      const smm = getSharedModelManager(self);
      if (!smm?.isReady) return;

      let sharedSeismogram = self.sharedSeismogram;
      if (!sharedSeismogram) {
        const newSharedSeismogram = SharedSeismogram.create();
        smm.addTileSharedModel(self, newSharedSeismogram, true);
        sharedSeismogram = self.sharedSeismogram ?? newSharedSeismogram;
      }

      await sharedSeismogram.loadData();
    }
  }));

export interface WaveRunnerContentModelType extends Instance<typeof WaveRunnerContentModel> {}

export function isWaveRunnerContentModel(model: unknown): model is WaveRunnerContentModelType {
  return !!model && getType(model as object) === WaveRunnerContentModel;
}
