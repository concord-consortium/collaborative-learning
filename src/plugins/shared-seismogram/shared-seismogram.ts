import { flow, getType, Instance, types } from "mobx-state-tree";
import { miniseed, seismogram as seismogramNS } from "seisplotjs";
type Seismogram = seismogramNS.Seismogram;
import { SharedModel, SharedModelType } from "../../models/shared/shared-model";
import { fetchRawSeismicData } from "../../../shared/seismic/earthscope-client";

export const kSharedSeismogramType = "SharedSeismogram";

export const SharedSeismogram = SharedModel
  .named("SharedSeismogram")
  .props({
    type: types.optional(types.literal(kSharedSeismogramType), kSharedSeismogramType),
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
      return self.seismogram?.startTime;
    },
    get endTime() {
      return self.seismogram?.endTime;
    }
  }))
  .actions(self => ({
    setSeismogram(s: Seismogram | undefined) {
      self.seismogram = s;
    },
    loadData: flow(function* (startDate: string, endDate: string) {
      self.isLoading = true;
      self.loadError = null;
      self.seismogram = undefined;
      try {
        const start = new Date(`${startDate}T00:00:00Z`);
        const end = new Date(`${endDate}T00:00:00Z`);
        const msPerDay = 86400000;
        const totalDays = Math.round((end.getTime() - start.getTime()) / msPerDay);

        const allRecords: any[] = [];
        for (let day = 0; day < totalDays; day++) {
          const chunkStart = new Date(start.getTime() + day * msPerDay);
          const chunkEnd = new Date(chunkStart.getTime() + msPerDay);
          try {
            const response: Response = yield fetchRawSeismicData(
              "AK", "K204", "HNZ",
              chunkStart.toISOString(), chunkEnd.toISOString()
            );
            const buffer: ArrayBuffer = yield response.arrayBuffer();
            const records = miniseed.parseDataRecords(buffer);
            allRecords.push(...records);
          } catch {
            // Skip days with no data available
          }
        }

        if (allRecords.length === 0) {
          self.loadError = "No seismic data found for the selected date range.";
          return;
        }
        self.seismogram = miniseed.merge(allRecords);
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
