import { flow, getType, Instance, types } from "mobx-state-tree";
import { miniseed, seismogram as seismogramNS } from "seisplotjs";
type Seismogram = seismogramNS.Seismogram;
import { SharedModel, SharedModelType } from "../../models/shared/shared-model";

export const kSharedSeismogramType = "SharedSeismogram";

const S3_BASE = "https://models-resources.s3.amazonaws.com/collaborative-learning/datasets";
const MSEED_URLS = [
  `${S3_BASE}/2026_01_30_00_00_00-2026_01_31_00_00_00_anchorage_airport.mseed`,
  `${S3_BASE}/2026_01_31_00_00_00-2026_02_01_00_00_00_anchorage_airport.mseed`,
  `${S3_BASE}/2026_02_01_00_00_00-2026_02_02_00_00_00_anchorage_airport.mseed`,
  `${S3_BASE}/2026_02_02_00_00_00-2026_02_03_00_00_00_anchorage_airport.mseed`,
  `${S3_BASE}/2026_02_03_00_00_00-2026_02_04_00_00_00_anchorage_airport.mseed`,
  `${S3_BASE}/2026_02_04_00_00_00-2026_02_05_00_00_00_anchorage_airport.mseed`,
  `${S3_BASE}/2026_02_05_00_00_00-2026_02_06_00_00_00_anchorage_airport.mseed`,
];

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
    }
  }))
  .actions(self => ({
    setSeismogram(s: Seismogram | undefined) {
      self.seismogram = s;
    },
    loadData: flow(function* () {
      self.isLoading = true;
      self.loadError = null;
      try {
        const buffers: ArrayBuffer[] = yield Promise.all(
          MSEED_URLS.map((url: string) => fetch(url).then((res: Response) => res.arrayBuffer()))
        );
        const allRecords = buffers.flatMap((buf: ArrayBuffer) => miniseed.parseDataRecords(buf));
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
