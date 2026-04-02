import { getType, Instance, types } from "mobx-state-tree";
import { DateTime } from "luxon";
import { SharedModel, SharedModelType } from "../../models/shared/shared-model";

export const kSharedSeismogramType = "SharedSeismogram";

export const SharedSeismogram = SharedModel
  .named("SharedSeismogram")
  .props({
    type: types.optional(types.literal(kSharedSeismogramType), kSharedSeismogramType),
    network: types.maybe(types.string),
    station: types.maybe(types.string),
    location: types.maybe(types.string),
    channel: types.maybe(types.string),
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
    setStation(network: string, station: string, location: string, channel: string) {
      self.network = network;
      self.station = station;
      self.location = location;
      self.channel = channel;
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
