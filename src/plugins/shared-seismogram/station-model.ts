import { types, Instance, SnapshotIn } from "mobx-state-tree";
import { StationData } from "../../../shared/seismic/seismic-types";

/**
 * Compute the SEED-style station identifier from station fields.
 * Usable with both MST instances and plain config objects.
 * Format: {network}_{station}_{location}_{channel}
 * Empty location is replaced with "", yielding a double underscore in the id.
 */
export function stationId(
  station: { network: string; station: string; location?: string; channel: string }
): string {
  const loc = station.location || "";
  return `${station.network}_${station.station}_${loc}_${station.channel}`;
}

export const StationModel = types
  .model("Station", {
    network: types.string,
    station: types.string,
    location: types.optional(types.string, ""),
    channel: types.string,
    label: types.optional(types.string, ""),
  })
  .views(self => ({
    get id() {
      return stationId(self);
    },
    equals(station: StationConfig) {
      return self.network === station.network && self.station === station.station
        && self.location === (station.location ?? "") && self.channel === station.channel
        && self.label === (station.label ?? "");
    }
  }));

export interface StationModelType extends Instance<typeof StationModel> {}
export type StationSnapshot = SnapshotIn<typeof StationModel>;

/**
 * Shape of a station entry in unit configuration.
 * Same fields as StationSnapshot (location is optional, defaults to "").
 */
export interface StationConfig extends StationData {
  location?: string;
  label?: string;
}
