import { flow, types, Instance } from "mobx-state-tree";
import { miniseed } from "seisplotjs";
import { fetchRawSeismicData } from "../../../../shared/seismic/earthscope-client";
import { SeismicModelRunner } from "../../../../shared/seismic/seismic-model-runner";
import { ModelMetadata, SeismicEvent } from "../../../../shared/seismic/seismic-model-types";
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
    async loadData() {
      const smm = getSharedModelManager(self);
      if (!smm?.isReady) return;

      let sharedSeismogram = self.sharedSeismogram;
      if (!sharedSeismogram) {
        const newSharedSeismogram = SharedSeismogram.create();
        smm.addTileSharedModel(self, newSharedSeismogram, true);
        sharedSeismogram = self.sharedSeismogram ?? newSharedSeismogram;
      }

      sharedSeismogram.loadData();
    }
  }))
  .volatile(() => ({
    isRunning: false,
    chunksProcessed: 0,
    chunksTotal: 0,
    eventsFound: 0,
    runError: null as string | null,
    detectedEvents: [] as SeismicEvent[],
  }))
  .actions(self => ({
    updateChunkProgress(done: number, total: number) {
      self.chunksProcessed = done;
      self.chunksTotal = total;
    },
    addEvents(events: SeismicEvent[]) {
      self.detectedEvents = [...self.detectedEvents, ...events];
      self.eventsFound = self.detectedEvents.length;
    },
  }))
  .actions(self => ({
    runModel: flow(function* () {
      if (self.isRunning) return;
      self.isRunning = true;
      self.runError = null;
      self.eventsFound = 0;
      self.detectedEvents = [];

      // Hardcoded metadata for now — will come from model registry later
      const metadata: ModelMetadata = {
        id: "placeholder-v1",
        architecture: "placeholder",
        class_names: ["Noise", "Earthquake"],
        sampling_rate: 100,
        window_duration: 60,
        instrument_types: ["H"],
        weightsUrl: "",
      };

      const runner = new SeismicModelRunner();
      try {
        yield runner.loadModel(metadata);

        // Mock data covers 2026-01-30 to 2026-02-06 (7 days)
        // Fetch one day at a time
        const startDate = new Date("2026-01-30T00:00:00Z");
        const endDate = new Date("2026-02-06T00:00:00Z");
        const msPerDay = 86400000;
        const totalDays = (endDate.getTime() - startDate.getTime()) / msPerDay;
        self.updateChunkProgress(0, totalDays);

        for (let day = 0; day < totalDays; day++) {
          const chunkStart = new Date(startDate.getTime() + day * msPerDay);
          const chunkEnd = new Date(chunkStart.getTime() + msPerDay);

          // Fetch raw data for this day
          const response: Response = yield fetchRawSeismicData(
            "AK", "K204", "HNZ",
            chunkStart.toISOString(), chunkEnd.toISOString()
          );
          const buffer: ArrayBuffer = yield response.arrayBuffer();

          // Parse miniSEED → Seismogram
          const records = miniseed.parseDataRecords(buffer);
          const seismogram = miniseed.merge(records);

          // Run model on this chunk
          yield runner.processChunk(
            seismogram,
            {
              onProgress: () => {},
              onEvents: (events: SeismicEvent[]) => {
                self.addEvents(events);
              },
            }
          );
          self.updateChunkProgress(day + 1, totalDays);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        self.runError = `Error running model: ${message}`;
        console.error("Wave Runner runModel error:", err);
      } finally {
        runner.dispose();
        self.isRunning = false;
      }
    })
  }));

export interface WaveRunnerContentModelType extends Instance<typeof WaveRunnerContentModel> {}

export function isWaveRunnerContentModel(model?: ITileContentModel): model is WaveRunnerContentModelType {
  return model?.type === kWaveRunnerTileType;
}
