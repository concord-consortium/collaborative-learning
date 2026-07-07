import { DateTime } from "luxon";
import stringify from "json-stringify-pretty-compact";
import { cast, flow, getSnapshot, types, Instance } from "mobx-state-tree";
import { miniseed } from "seisplotjs";
import { MILLISECONDS_PER_DAY } from "../../../../shared/seismic/seismic-day";
import { SeismicDownloadService, DONE } from "../../../models/stores/seismic-download-service";
import { SeismicModelRunner } from "../../../../shared/seismic/seismic-model-runner";
import { ModelMetadata, SeismicEvent } from "../../../../shared/seismic/seismic-model-types";
import { addAttributeToDataSet, addCasesToDataSet, DataSet } from "../../../models/data/data-set";
import { SharedDataSet, SharedDataSetType } from "../../../models/shared/shared-data-set";
import { ITileContentModel, TileContentModel } from "../../../models/tiles/tile-content";
import { ITileExportOptions } from "../../../models/tiles/tile-content-info";
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
    startDate: types.optional(types.string, "2025-01-01"),
    endDate: types.optional(types.string, "2025-12-31"),
    station: types.maybe(StationModel),
    selectedModelUrl: types.maybe(types.string),
  })
  .volatile(() => ({
    isRunning: false,
    chunksProcessed: 0,
    chunksTotal: 0,
    runError: null as string | null,
    detectedEvents: [] as SeismicEvent[],
    selectedModelMetadata: null as ModelMetadata | null,
    modelLoadError: null as string | null,
  }))
  .views(self => ({
    get isUserResizable() {
      return true;
    },
    exportJson(options?: ITileExportOptions) {
      return stringify(getSnapshot(self), {maxLength: 200});
    },
    get sharedSeismogram(): SharedSeismogramType | undefined {
      const smm = getSharedModelManager(self);
      if (!smm?.isReady) return;
      return smm.getTileSharedModelsByType(self, SharedSeismogram)[0] as SharedSeismogramType | undefined;
    },
    get startDateISO() {
      return DateTime.fromISO(`${self.startDate}T00:00:00Z`, { zone: "utc" });
    },
    get endDateISO() {
      return DateTime.fromISO(`${self.endDate}T00:00:00Z`, { zone: "utc" });
    },
    get eventsDataSet(): SharedDataSetType | undefined {
      const smm = getSharedModelManager(self);
      if (!smm?.isReady) return;
      return smm.getTileSharedModelsByType(self, SharedDataSet)[0] as SharedDataSetType | undefined;
    }
  }))
  .views(self => ({
    get hasStationData() {
      return !!self.sharedSeismogram?.station;
    },
    get eventsFound() {
      return self.isRunning ? self.detectedEvents.length : self.eventsDataSet?.dataSet.cases.length;
    }
  }))
  .actions(self => ({
    async loadData() {
      if (!self.station) return;

      let sharedSeismogram = self.sharedSeismogram;
      if (!sharedSeismogram) {
        const smm = getSharedModelManager(self);
        if (!smm?.isReady) return;

        sharedSeismogram = SharedSeismogram.create();
        smm.addTileSharedModel(self, sharedSeismogram, true);
      }

      const { network, station, label, location, channel } = self.station;
      sharedSeismogram.setStation({ network, station, label, location, channel });
      sharedSeismogram.setTimeRange(
        `${self.startDate}T00:00:00Z`,
        `${self.endDate}T00:00:00Z`
      );
    },
    clearEventsDataSet() {
      if (!self.eventsDataSet) return;

      const smm = getSharedModelManager(self);
      if (smm?.isReady) smm.removeTileSharedModel(self, self.eventsDataSet);

      // TODO: Delete the shared dataset if it's orphaned
    }
  }))
  .actions(self => ({
    setStartDate(date: string) {
      if (self.startDate === date) return;

      self.startDate = date;
      self.loadData();
      self.clearEventsDataSet();
    },
    setEndDate(date: string) {
      if (self.endDate === date) return;

      self.endDate = date;
      self.loadData();
      self.clearEventsDataSet();
    },
    setStation(station: StationSnapshot) {
      if (self.station?.equals(station)) return;

      self.station = cast(station);
      self.loadData();
      self.clearEventsDataSet();
    },
    updateChunkProgress(done: number, total: number) {
      self.chunksProcessed = done;
      self.chunksTotal = total;
    },
    addDetectedEvents(events: SeismicEvent[]) {
      self.detectedEvents = [...self.detectedEvents, ...events];
    },
    getOrCreateEventsDataSet(): SharedDataSetType | undefined {
      if (self.eventsDataSet) return self.eventsDataSet;

      const smm = getSharedModelManager(self);
      if (!smm?.isReady) return undefined;

      const dataSet = DataSet.create();
      addAttributeToDataSet(dataSet, { name: "eventType" });
      addAttributeToDataSet(dataSet, { name: "windowStart" });
      addAttributeToDataSet(dataSet, { name: "windowEnd" });
      addAttributeToDataSet(dataSet, { name: "confidence" });
      addAttributeToDataSet(dataSet, { name: "modelLabel" });

      const sharedDataSet = SharedDataSet.create({ dataSet });
      smm.addTileSharedModel(self, sharedDataSet);
      return sharedDataSet;
    },
    ensureModelMetadata: flow(function* (metadataUrl: string) {
      // Already loaded for this URL
      if (self.selectedModelUrl === metadataUrl && self.selectedModelMetadata) return;

      self.selectedModelUrl = metadataUrl;
      self.selectedModelMetadata = null;
      self.modelLoadError = null;
      self.clearEventsDataSet();

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

      self.clearEventsDataSet();
      self.runError = null;
      self.isRunning = true;

      const metadata = self.selectedModelMetadata;

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

        const totalDays = Math.ceil((endMs - startMs) / MILLISECONDS_PER_DAY);
        self.updateChunkProgress(0, totalDays);

        // Bulk-download the range into OPFS, running the model on each day as it lands.
        // Days may arrive out of order; detection is per-window independent, so that's fine.
        // No-data days come as `dayEmpty` and are simply never yielded.
        const downloadService = new SeismicDownloadService();
        downloadService.ensureRange({ ...self.station, startSec: startMs / 1000, endSec: endMs / 1000 });

        let processed = 0;
        while (true) {
          const day: number | typeof DONE = yield downloadService.nextReadyDay();
          if (day === DONE) break;

          const buffer: ArrayBuffer | null = yield downloadService.readDay(day);
          if (!buffer) continue;

          // Parse miniSEED → Seismogram
          const records = miniseed.parseDataRecords(buffer);
          const seismogram = miniseed.merge(records);

          // Run model on this chunk
          yield runner.processChunk(
            seismogram,
            {
              onProgress: () => {},
              onEvents: (events: SeismicEvent[]) => {
                self.addDetectedEvents(events);
              },
            },
            detectionThreshold,
          );
          processed++;
          self.updateChunkProgress(processed, totalDays);
        }

        const dataSet = self.getOrCreateEventsDataSet()?.dataSet;
        if (dataSet) {
          const modelLabel = DEFAULT_MODELS.find(m => m.metadataUrl === self.selectedModelUrl)?.label ?? "";
          addCasesToDataSet(dataSet, self.detectedEvents.map(evt => ({
            windowStart: new Date(evt.windowStart).toISOString(),
            windowEnd: new Date(evt.windowEnd).toISOString(),
            eventType: evt.eventType,
            confidence: evt.confidence,
            modelLabel,
          })));
        }

        self.detectedEvents = [];
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
