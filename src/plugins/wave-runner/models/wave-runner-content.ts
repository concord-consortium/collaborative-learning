import { types, Instance } from "mobx-state-tree";
import { ITileContentModel, TileContentModel } from "../../../models/tiles/tile-content";
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
    startDate: types.optional(types.string, "2026-01-30"),
    endDate: types.optional(types.string, "2026-02-06"),
  })
  .views(self => ({
    get isUserResizable() {
      return true;
    },
    get sharedSeismogram(): SharedSeismogramType | undefined {
      const smm = getSharedModelManager(self);
      return smm?.findFirstSharedModelByType(SharedSeismogram);
    },
  }))
  .views(self => ({
    get isLoading() {
      return self.sharedSeismogram?.isLoading ?? false;
    },
    get loadError() {
      return self.sharedSeismogram?.loadError ?? null;
    },
    get hasData() {
      return self.sharedSeismogram?.hasData ?? false;
    }
  }))
  .actions(self => ({
    setStartDate(date: string) {
      self.startDate = date;
    },
    setEndDate(date: string) {
      self.endDate = date;
    },
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

      sharedSeismogram.loadData(self.startDate, self.endDate);
    }
  }));

export interface WaveRunnerContentModelType extends Instance<typeof WaveRunnerContentModel> {}

export function isWaveRunnerContentModel(model?: ITileContentModel): model is WaveRunnerContentModelType {
  return model?.type === kWaveRunnerTileType;
}
