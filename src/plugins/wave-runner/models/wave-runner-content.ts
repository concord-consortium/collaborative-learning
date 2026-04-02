import { cast, flow, types, Instance } from "mobx-state-tree";
import { miniseed } from "seisplotjs";
import { fetchRawSeismicData } from "../../../../shared/seismic/earthscope-client";
import { SeismicModelRunner } from "../../../../shared/seismic/seismic-model-runner";
import { ModelMetadata, SeismicEvent } from "../../../../shared/seismic/seismic-model-types";
import { addAttributeToDataSet, addCasesToDataSet, DataSet } from "../../../models/data/data-set";
import { SharedDataSet, SharedDataSetType } from "../../../models/shared/shared-data-set";
import { ITileContentModel, TileContentModel } from "../../../models/tiles/tile-content";
import { getSharedModelManager } from "../../../models/tiles/tile-environment";
import { SharedSeismogram, SharedSeismogramType } from "../../shared-seismogram/shared-seismogram";
import { StationModel, StationSnapshot } from "../../shared-seismogram/station-model";
import { kWaveRunnerTileType } from "../wave-runner-types";

const SUPPORTED_SCHEMA = "https://collaborative-learning.concord.org/schemas/seismic-model/v1.json";

export const PLACEHOLDER_MODEL_URL = "placeholder:random-weights";

const PLACEHOLDER_METADATA: ModelMetadata = {
  $schema: SUPPORTED_SCHEMA,
  id: "placeholder-v1",
  architecture: "placeholder",
  class_names: ["Noise", "Earthquake"],
  sampling_rate: 100,
  window_duration: 60,
  instrument_types: ["H", "N", "L"],
  weightsUrl: "",
};

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
  {
    label: "Placeholder (random weights)",
    metadataUrl: PLACEHOLDER_MODEL_URL,
  },
];

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
    selectedModelUrl: types.maybe(types.string),
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
    get hasStationData() {
      const ss = self.sharedSeismogram;
      return !!(ss?.network && ss?.station && ss?.channel);
    },
  }))
  .actions(self => ({
    setStartDate(date: string) {
      self.startDate = date;
    },
    setEndDate(date: string) {
      self.endDate = date;
    },
    setStation(station: StationSnapshot) {
      self.station = cast(station);
      self.sharedSeismogram?.setStation(
        station.network, station.station, station.location ?? "", station.channel
      );
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

      const { network, station, location, channel } = self.station;
      sharedSeismogram.setStation(network, station, location ?? "", channel);
      sharedSeismogram.setTimeRange(
        `${self.startDate}T00:00:00Z`,
        `${self.endDate}T00:00:00Z`
      );
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
        windowStart: new Date(evt.windowStart).toISOString(),
        windowEnd: new Date(evt.windowEnd).toISOString(),
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
    ensureModelMetadata: flow(function* (metadataUrl: string) {
      // Already loaded for this URL
      if (self.selectedModelUrl === metadataUrl && self.selectedModelMetadata) return;

      self.selectedModelUrl = metadataUrl;
      self.selectedModelMetadata = null;
      self.modelLoadError = null;

      // Placeholder model — use hardcoded metadata, no fetch needed
      if (metadataUrl === PLACEHOLDER_MODEL_URL) {
        self.selectedModelMetadata = { ...PLACEHOLDER_METADATA };
        return;
      }

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

      if (!self.station) {
        self.runError = "No station selected";
        return;
      }

      self.isRunning = true;
      self.runError = null;
      self.eventsFound = 0;
      self.detectedEvents = [];
      self.cachedEventsDataSet = undefined;

      const metadata = self.selectedModelMetadata;
      const { network, station, location, channel } = self.station;

      const runner = new SeismicModelRunner();
      try {
        yield runner.loadModel(metadata);

        const startDate = new Date(`${self.startDate}T00:00:00Z`);
        const endDate = new Date(`${self.endDate}T00:00:00Z`);
        const startMs = startDate.getTime();
        const endMs = endDate.getTime();
        const detectionThreshold = 0.7;

        if (isNaN(startMs) || isNaN(endMs) || endMs <= startMs) {
          self.runError = "Invalid date range. End date must be after start date.";
          self.isRunning = false;
          return;
        }

        const msPerDay = 86400000;
        const totalDays = Math.ceil((endMs - startMs) / msPerDay);
        self.updateChunkProgress(0, totalDays);

        for (let day = 0; day < totalDays; day++) {
          const chunkStart = new Date(startDate.getTime() + day * msPerDay);
          const chunkEnd = new Date(chunkStart.getTime() + msPerDay);

          // Fetch raw data for this day — skip days with no data
          let response: Response;
          try {
            response = yield fetchRawSeismicData(
              network, station, location, channel,
              chunkStart.toISOString(), chunkEnd.toISOString()
            );
          } catch (err: unknown) {
            const isNoData = err instanceof Error && /no data|404/i.test(err.message);
            if (isNoData) {
              self.updateChunkProgress(day + 1, totalDays);
              continue;
            }
            throw err;
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
