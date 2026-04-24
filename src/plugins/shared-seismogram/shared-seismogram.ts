import { getType, Instance, types } from "mobx-state-tree";
import { DateTime } from "luxon";
import { SharedModel, SharedModelType } from "../../models/shared/shared-model";
import { StationModel, StationSnapshot } from "./station-model";

export const kSharedSeismogramType = "SharedSeismogram";

export const SharedSeismogram = SharedModel
  .named("SharedSeismogram")
  .props({
    type: types.optional(types.literal(kSharedSeismogramType), kSharedSeismogramType),
    station: types.maybe(StationModel),
    startTimeISO: types.maybe(types.string),
    endTimeISO: types.maybe(types.string),
  })
  .views(self => ({
    get startTime() {
      return self.startTimeISO ? DateTime.fromISO(self.startTimeISO, { zone: "utc" }) : undefined;
    },
    get endTime() {
      return self.endTimeISO ? DateTime.fromISO(self.endTimeISO, { zone: "utc" }) : undefined;
    },
  }))
  .actions(self => ({
    setStation(station: StationSnapshot) {
      self.station = StationModel.create(station);
    },
    setTimeRange(startTimeISO: string, endTimeISO: string) {
      self.startTimeISO = startTimeISO;
      self.endTimeISO = endTimeISO;
    },
  }));

export interface SharedSeismogramType extends Instance<typeof SharedSeismogram> {}

export function isSharedSeismogram(model?: SharedModelType): model is SharedSeismogramType {
  return !!model && getType(model) === SharedSeismogram;
}
