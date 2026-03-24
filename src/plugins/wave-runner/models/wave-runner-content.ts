import { cast, types, Instance } from "mobx-state-tree";
import { ITileContentModel, TileContentModel } from "../../../models/tiles/tile-content";
import { getSharedModelManager } from "../../../models/tiles/tile-environment";
import { SharedSeismogram, SharedSeismogramType } from "../../shared-seismogram/shared-seismogram";
import { StationModel, StationSnapshot } from "../../shared-seismogram/station-model";
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
    station: types.maybe(StationModel),
  })
  .views(self => ({
    get isUserResizable() {
      return true;
    },
    get sharedSeismogram(): SharedSeismogramType | undefined {
      const smm = getSharedModelManager(self);
      return smm?.getTileSharedModelsByType(self, SharedSeismogram)[0] as SharedSeismogramType | undefined;
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
      self.sharedSeismogram?.setSeismogram(undefined);
    },
    setEndDate(date: string) {
      self.endDate = date;
      self.sharedSeismogram?.setSeismogram(undefined);
    },
    setStation(station: StationSnapshot) {
      self.station = cast(station);
      self.sharedSeismogram?.setSeismogram(undefined);
    },
  }))
  .actions(self => ({
    async loadData() {
      if (!self.station) return;
      const smm = getSharedModelManager(self);
      if (!smm?.isReady) return;

      let sharedSeismogram = self.sharedSeismogram;
      if (!sharedSeismogram) {
        const newSharedSeismogram = SharedSeismogram.create();
        smm.addTileSharedModel(self, newSharedSeismogram, true);
        sharedSeismogram = self.sharedSeismogram ?? newSharedSeismogram;
      }

      // Pass a plain snapshot, not a live MST node, since loadData is async
      // and the station could theoretically be replaced between yields.
      const { network, station, location, channel, label } = self.station;
      sharedSeismogram.loadData({ network, station, location, channel, label },
        self.startDate, self.endDate);
    }
  }));

export interface WaveRunnerContentModelType extends Instance<typeof WaveRunnerContentModel> {}

export function isWaveRunnerContentModel(model?: ITileContentModel): model is WaveRunnerContentModelType {
  return model?.type === kWaveRunnerTileType;
}
