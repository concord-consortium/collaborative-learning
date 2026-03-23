import { flow, types, Instance } from "mobx-state-tree";
import { miniseed } from "seisplotjs";
import { fetchRawSeismicData } from "../../../../shared/seismic/earthscope-client";
import { SeismicModelRunner } from "../../../../shared/seismic/seismic-model-runner";
import { ModelMetadata, SeismicEvent } from "../../../../shared/seismic/seismic-model-types";
import { addAttributeToDataSet, addCasesToDataSet, DataSet } from "../../../models/data/data-set";
import { SharedDataSet, SharedDataSetType } from "../../../models/shared/shared-data-set";
import { ITileContentModel, TileContentModel } from "../../../models/tiles/tile-content";
import { getSharedModelManager } from "../../../models/tiles/tile-environment";
import { SharedSeismogram, SharedSeismogramType } from "../../shared-seismogram/shared-seismogram";
import { kWaveRunnerTileType } from "../wave-runner-types";

const SUPPORTED_SCHEMA = "https://collaborative-learning.concord.org/schemas/seismic-model/v1.json";

export interface ModelListEntry {
  label: string;
  metadataUrl: string;
}

// Default model list — can be overridden by unit JSON in the future
export const DEFAULT_MODELS: ModelListEntry[] = [
  {
    label: "Compact Model",
    metadataUrl: "https://models-resources.concord.org/tiny-cnn-seismicML/models/v1/compact-v1/metadata.json"
  },
];

export function defaultWaveRunnerContent(): WaveRunnerContentModelType {
  return WaveRunnerContentModel.create();
}

export const WaveRunnerContentModel = TileContentModel
  .named("WaveRunnerTool")
  .props({
    type: types.optional(types.literal(kWaveRunnerTileType), kWaveRunnerTileType),
    selectedModelUrl: types.maybe(types.string),
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
    cachedEventsDataSet: undefined as SharedDataSetType | undefined,
    selectedModelMetadata: null as ModelMetadata | null,
    modelLoadError: null as string | null,
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
    clearCachedEventsDataSet() {
      self.cachedEventsDataSet = undefined;
    },
    getOrCreateEventsDataSet(): SharedDataSetType | undefined {
      if (self.detectedEvents.length === 0) return undefined;
      if (self.cachedEventsDataSet) return self.cachedEventsDataSet;

      const smm = getSharedModelManager(self);
      if (!smm?.isReady) return undefined;

      const dataSet = DataSet.create();
      addAttributeToDataSet(dataSet, { name: "windowStart" });
      addAttributeToDataSet(dataSet, { name: "windowEnd" });
      addAttributeToDataSet(dataSet, { name: "eventType" });
      addAttributeToDataSet(dataSet, { name: "confidence" });
      addCasesToDataSet(dataSet, self.detectedEvents.map(evt => ({
        windowStart: evt.windowStart,
        windowEnd: evt.windowEnd,
        eventType: evt.eventType,
        confidence: evt.confidence,
      })));

      const sharedDataSet = SharedDataSet.create({ dataSet });
      smm.addTileSharedModel(self, sharedDataSet);
      self.cachedEventsDataSet = sharedDataSet;
      return sharedDataSet;
    },
  }))
  .actions(self => ({
    /**
     * Ensure metadata is loaded for the given URL. Idempotent — skips the fetch
     * if the URL matches and metadata is already loaded. Called by the dropdown
     * on selection, and by runModel before execution.
     */
    ensureModelMetadata: flow(function* (metadataUrl: string) {
      // Already loaded for this URL
      if (self.selectedModelUrl === metadataUrl && self.selectedModelMetadata) return;

      self.selectedModelUrl = metadataUrl;
      self.selectedModelMetadata = null;
      self.modelLoadError = null;

      try {
        const response: Response = yield fetch(metadataUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch model metadata: ${response.status}`);
        }
        const metadata: ModelMetadata = yield response.json();
        if (metadata.$schema !== SUPPORTED_SCHEMA) {
          throw new Error(
            `Unsupported model schema: "${metadata.$schema}". This version of CLUE supports "${SUPPORTED_SCHEMA}".`
          );
        }
        // Resolve weightsUrl relative to the metadata URL
        metadata.weightsUrl = new URL(metadata.weightsUrl, metadataUrl).href;
        self.selectedModelMetadata = metadata;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        self.modelLoadError = message;
        console.error("Failed to load model metadata:", err);
      }
    }),
  }))
  .actions(self => ({
    runModel: flow(function* () {
      if (self.isRunning) return;
      if (!self.selectedModelUrl) {
        self.runError = "No model selected";
        return;
      }

      // Fetch metadata if not already loaded (e.g., after page reload)
      yield self.ensureModelMetadata(self.selectedModelUrl);
      if (!self.selectedModelMetadata) {
        self.runError = self.modelLoadError || "Failed to load model metadata";
        return;
      }

      self.isRunning = true;
      self.runError = null;
      self.eventsFound = 0;
      self.detectedEvents = [];
      self.cachedEventsDataSet = undefined;

      const metadata = self.selectedModelMetadata;

      const runner = new SeismicModelRunner();
      try {
        yield runner.loadModel(metadata);

        // Hardcoded date ranges per data source (temporary until UI date pickers work)
        const params = typeof window !== "undefined"
          ? new URLSearchParams(window.location.search) : new URLSearchParams();
        let startDate: Date, endDate: Date, detectionThreshold: number;
        if (params.has("seismicLocal")) {
          // Local ROVER data — 7 days of 2025 data
          startDate = new Date("2025-01-01T00:00:00Z");
          endDate = new Date("2025-01-08T00:00:00Z");
          detectionThreshold = 0.6;
        } else if (params.has("seismicProxy")) {
          // Live proxy — limit to 1 day to avoid slow downloads
          startDate = new Date("2026-01-30T00:00:00Z");
          endDate = new Date("2026-01-31T00:00:00Z");
          detectionThreshold = 0.7;
        } else {
          // Mock S3 data — 7 days
          startDate = new Date("2026-01-30T00:00:00Z");
          endDate = new Date("2026-02-06T00:00:00Z");
          detectionThreshold = 0.7;
        }
        const msPerDay = 86400000;
        const totalDays = (endDate.getTime() - startDate.getTime()) / msPerDay;
        self.updateChunkProgress(0, totalDays);

        for (let day = 0; day < totalDays; day++) {
          const chunkStart = new Date(startDate.getTime() + day * msPerDay);
          const chunkEnd = new Date(chunkStart.getTime() + msPerDay);

          // Fetch raw data for this day — skip days with no data
          let response: Response;
          try {
            response = yield fetchRawSeismicData(
              "AK", "K204", "HNZ",
              chunkStart.toISOString(), chunkEnd.toISOString()
            );
          } catch {
            self.updateChunkProgress(day + 1, totalDays);
            continue;
          }
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
            },
            detectionThreshold,
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
