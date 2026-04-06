import { flow, getType, Instance, types } from "mobx-state-tree";
import { DateTime } from "luxon";
import { miniseed, seismogram as seismogramNS } from "seisplotjs";
type Seismogram = seismogramNS.Seismogram;
import { SharedModel, SharedModelType } from "../../models/shared/shared-model";
import { fetchRawSeismicData } from "../../../shared/seismic/earthscope-client";
import { StationSnapshot } from "./station-model";

export const kSharedSeismogramType = "SharedSeismogram";

export const SharedSeismogram = SharedModel
  .named("SharedSeismogram")
  .props({
    type: types.optional(types.literal(kSharedSeismogramType), kSharedSeismogramType),
    startTimeISO: types.maybe(types.string),
    endTimeISO: types.maybe(types.string),
  })
  .volatile(() => ({
    seismogram: undefined as Seismogram | undefined,
    isLoading: false,
    loadError: null as string | null,
  }))
  .views(self => ({
    get hasData() {
      return self.seismogram !== undefined;
    },
    get startTime() {
      return self.startTimeISO ? DateTime.fromISO(self.startTimeISO, { zone: "utc" }) : undefined;
    },
    get endTime() {
      return self.endTimeISO ? DateTime.fromISO(self.endTimeISO, { zone: "utc" }) : undefined;
    }
  }))
  .actions(self => ({
    setSeismogram(s: Seismogram | undefined) {
      self.seismogram = s;
      self.startTimeISO = s?.startTime?.toISO() ?? undefined;
      self.endTimeISO = s?.endTime?.toISO() ?? undefined;
    },
  }))
  .actions(self => ({
    loadData: flow(function* (station: StationSnapshot, startDate: string, endDate: string) {
      self.isLoading = true;
      self.loadError = null;
      self.seismogram = undefined;
      try {
        const start = new Date(`${startDate}T00:00:00Z`);
        const end = new Date(`${endDate}T00:00:00Z`);
        const msPerDay = 86400000;

        if (isNaN(start.getTime()) || isNaN(end.getTime()) || end.getTime() <= start.getTime()) {
          self.loadError = "Invalid date range. End date must be after start date.";
          return;
        }

        const totalDays = Math.ceil((end.getTime() - start.getTime()) / msPerDay);

        const allRecords: any[] = [];
        for (let day = 0; day < totalDays; day++) {
          const chunkStart = new Date(start.getTime() + day * msPerDay);
          const chunkEnd = new Date(chunkStart.getTime() + msPerDay);
          try {
            const response: Response = yield fetchRawSeismicData(
              station.network, station.station, station.location ?? "", station.channel,
              chunkStart.toISOString(), chunkEnd.toISOString()
            );
            const buffer: ArrayBuffer = yield response.arrayBuffer();
            const records = miniseed.parseDataRecords(buffer);
            allRecords.push(...records);
          } catch (err: unknown) {
            // Skip "no data" errors (thrown by fetchRawSeismicData when no mock file matches).
            // Rethrow unexpected errors (network failures, CORS, auth) so they surface to the user.
            if (err instanceof Error && err.message.includes("No mock data")) continue;
            throw err;
          }
        }

        if (allRecords.length === 0) {
          self.loadError = "No seismic data found for the selected date range.";
          return;
        }
        self.setSeismogram(miniseed.merge(allRecords));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        self.loadError = `Error loading seismic data: ${message}`;
      } finally {
        self.isLoading = false;
      }
    })
  }));

export interface SharedSeismogramType extends Instance<typeof SharedSeismogram> {}

export function isSharedSeismogram(model?: SharedModelType): model is SharedSeismogramType {
  return !!model && getType(model) === SharedSeismogram;
}
