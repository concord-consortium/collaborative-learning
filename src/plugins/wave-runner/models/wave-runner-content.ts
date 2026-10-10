import { DateTime } from "luxon";
import stringify from "json-stringify-pretty-compact";
import { cast, flow, getSnapshot, isAlive, types, Instance } from "mobx-state-tree";
import { EnvironmentName } from "@concord-consortium/token-service";
import { eventDocId } from "../../../../shared/seismic/models/event-database";
import { fetchModelMetadata, ModelListEntry } from "../../../../shared/seismic/models/model-metadata";
import { SECONDS_PER_DAY } from "../../../../shared/seismic/seismic-day";
import { EnvelopeTileData, TimeRange } from "../../../../shared/seismic/seismic-types";
import {
  createEnvelopeCredentialsProvider, createEnvelopeUploader, EnvelopeUploader
} from "../../../models/stores/seismic/envelope-uploader";
import { processUncoveredRanges } from "../../../models/stores/seismic/seismic-coverage-processor";
import { processEnvelopeCoverage } from "../../../models/stores/seismic/seismic-envelope-processor";
import { getUncoveredRanges, loadEvents } from "../../../models/stores/seismic/seismic-event-service";
import { ModelMetadata, SeismicEvent } from "../../../../shared/seismic/models/seismic-model-types";
import { addAttributeToDataSet, addCasesToDataSet, DataSet } from "../../../models/data/data-set";
import { SharedDataSet, SharedDataSetType } from "../../../models/shared/shared-data-set";
import { ITileContentModel, TileContentModel } from "../../../models/tiles/tile-content";
import { ITileExportOptions } from "../../../models/tiles/tile-content-info";
import { getAppConfig, getSharedModelManager } from "../../../models/tiles/tile-environment";
import { SharedSeismogram, SharedSeismogramType } from "../../shared-seismogram/shared-seismogram";
import { StationModel, StationSnapshot } from "../../shared-seismogram/station-model";
import { kWaveRunnerTileType } from "../wave-runner-types";

export function defaultWaveRunnerContent(): WaveRunnerContentModelType {
  return WaveRunnerContentModel.create();
}

export interface ILoadEnvelopeDataOptions {
  /** Exchanges the session's portal credentials for a token-service firebase JWT. */
  getJwt: () => Promise<string>;
  /** Token-service environment; "production" default. */
  env?: EnvironmentName;
  /** Called after a run that may have uploaded tiles so cached envelope data can be refreshed. */
  onEnvelopesUpdated?: () => void;
  /** Test seams; production defaults construct real ones. */
  processEnvelopes?: typeof processEnvelopeCoverage;
  uploader?: EnvelopeUploader;
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
    // Set by pauseModel. While isRunning is still true the run is stopping, after the day in
    // progress if there is one.
    isPaused: false,
    // True from when a day's data is ready until the model has processed it.
    isDayInProgress: false,
    runAbortController: null as AbortController | null,
    chunksProcessed: 0,
    chunksTotal: 0,
    runError: null as string | null,
    isLoadingData: false,
    loadDaysDone: 0,
    loadDaysTotal: 0,
    loadDataError: null as string | null,
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
      return self.isRunning || self.isPaused
        ? self.detectedEvents.length
        : self.eventsDataSet?.dataSet.cases.length;
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
    },
    /** Forget a paused run's progress, e.g. because the settings it ran with have changed. */
    clearPausedRun() {
      if (!self.isPaused || self.isRunning) return;
      self.isPaused = false;
      self.detectedEvents = [];
      self.chunksProcessed = 0;
      self.chunksTotal = 0;
    }
  }))
  .actions(self => ({
    setStartDate(date: string) {
      if (self.startDate === date) return;

      self.startDate = date;
      self.loadData();
      self.clearEventsDataSet();
      self.clearPausedRun();
    },
    setEndDate(date: string) {
      if (self.endDate === date) return;

      self.endDate = date;
      self.loadData();
      self.clearEventsDataSet();
      self.clearPausedRun();
    },
    setStation(station: StationSnapshot) {
      if (self.station?.equals(station)) return;

      self.station = cast(station);
      self.loadData();
      self.clearEventsDataSet();
      self.clearPausedRun();
    },
    updateChunkProgress(done: number, total: number) {
      self.chunksProcessed = done;
      self.chunksTotal = total;
      self.isDayInProgress = false;
    },
    startDay() {
      self.isDayInProgress = true;
    },
    updateLoadProgress(done: number, total: number) {
      self.loadDaysDone = done;
      self.loadDaysTotal = total;
    },
    addDetectedEvents(events: SeismicEvent[]) {
      const seen = new Set(self.detectedEvents.map(eventDocId));
      const fresh = events.filter(evt => {
        const key = eventDocId(evt);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      self.detectedEvents = [...self.detectedEvents, ...fresh];
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
      self.clearPausedRun();

      try {
        const metadata: ModelMetadata = yield fetchModelMetadata(metadataUrl);
        if (isAlive(self)) self.selectedModelMetadata = metadata;
      } catch (err: unknown) {
        console.error("Failed to load model metadata:", err);
        if (!isAlive(self)) return;
        const message = err instanceof Error ? err.message : String(err);
        self.modelLoadError = message;
      }
    }),
  }))
  .actions(self => ({
    runModel: flow(function* () {
      if (self.isRunning || self.isLoadingData) return;
      if (!self.selectedModelUrl) {
        self.runError = "No model selected";
        return;
      }

      // Fetch metadata if not already loaded (e.g., after page reload)
      yield self.ensureModelMetadata(self.selectedModelUrl);
      // The tile may have been deleted, or a second click may have started a run, while the
      // metadata was loading.
      if (!isAlive(self) || self.isRunning) return;
      if (!self.selectedModelMetadata) {
        self.runError = self.modelLoadError || "Failed to load model metadata";
        return;
      }

      if (!self.station) {
        self.runError = "No station selected";
        return;
      }
      const station = self.station;

      self.clearEventsDataSet();
      self.runError = null;
      self.isRunning = true;
      // Every run starts from empty progress. A resumed run gets the paused run's events back
      // from the database when it can reach it.
      self.isPaused = false;
      self.isDayInProgress = false;
      self.detectedEvents = [];
      self.chunksProcessed = 0;
      self.chunksTotal = 0;
      const abortController = new AbortController();
      self.runAbortController = abortController;

      const metadata = self.selectedModelMetadata;
      const modelId = metadata.id;

      try {
        const startDate = new Date(`${self.startDate}T00:00:00Z`);
        const endDate = new Date(`${self.endDate}T00:00:00Z`);
        const startMs = startDate.getTime();
        const endMs = endDate.getTime();

        if (isNaN(startMs) || isNaN(endMs) || endMs <= startMs) {
          self.runError = "Invalid date range. End date must be after start date.";
          self.isRunning = false;
          return;
        }

        // endDate is inclusive: the range extends through the end of that UTC day.
        const rangeSec: TimeRange = { start: startMs / 1000, end: endMs / 1000 + SECONDS_PER_DAY };

        // Load previously stored events and coverage; fall back to a full local run if unavailable.
        let uncovered: TimeRange[] = [rangeSec];
        try {
          const prior: SeismicEvent[] = yield loadEvents(station, modelId, rangeSec);
          if (!isAlive(self)) return;
          self.addDetectedEvents(prior);
          uncovered = yield getUncoveredRanges(station, modelId, rangeSec);
        } catch (err) {
          console.warn("Seismic event database unavailable; processing the full range:", err);
        }
        if (!isAlive(self)) return;

        // Count days already covered by earlier (e.g. paused) runs as done, so progress is
        // reported against the whole range.
        const rangeDays = (rangeSec.end - rangeSec.start) / SECONDS_PER_DAY;
        const days: Awaited<ReturnType<typeof processUncoveredRanges>> = yield processUncoveredRanges({
          stationData: station, metadata, range: rangeSec, uncovered,
          onEvents: events => isAlive(self) && self.addDetectedEvents(events),
          onProgress: (progress, total) =>
            isAlive(self) && self.updateChunkProgress(rangeDays - total + progress, rangeDays),
          onDayDownloaded: () => isAlive(self) && self.startDay(),
          signal: abortController.signal,
        });
        if (!isAlive(self)) return;
        // Keep the events found so far for display. An abort that left no day unprocessed (a
        // pause during the last day, or any pause on a fully covered range) falls through and
        // completes the run.
        if (abortController.signal.aborted) {
          if (days.processed + days.skipped < days.total) return;
          self.isPaused = false;
        }

        const dataSet = self.getOrCreateEventsDataSet()?.dataSet;
        if (dataSet) {
          const models = getAppConfig(self)?.getSetting("models", "wave-runner") as ModelListEntry[] | undefined;
          const modelLabel = models?.find(m => m.metadataUrl === self.selectedModelUrl)?.label ?? "";
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
        console.error("Wave Runner runModel error:", err);
        if (!isAlive(self)) return;
        const message = err instanceof Error ? err.message : String(err);
        self.runError = `Error running model: ${message}`;
        self.isPaused = false;
      } finally {
        if (isAlive(self)) {
          self.isRunning = false;
          self.isDayInProgress = false;
          self.runAbortController = null;
        }
      }
    }),
    /** Stops the run after the day in progress, if any, so Run can resume it. */
    pauseModel() {
      if (!self.isRunning || self.isPaused) return;
      self.isPaused = true;
      self.runAbortController?.abort();
    },
    beforeDestroy() {
      self.runAbortController?.abort();
    },
    /** Generate + upload any missing envelope tiles for the current station and date range
     *  so the waveform display has data. */
    loadEnvelopeData: flow(function* (options: ILoadEnvelopeDataOptions) {
      if (self.isRunning || self.isLoadingData) return;
      if (!self.station) return;
      const station = self.station;

      // Keep the shared seismogram in sync (the pre-upload behavior of Load Data).
      self.loadData();

      const startMs = new Date(`${self.startDate}T00:00:00Z`).getTime();
      const endMs = new Date(`${self.endDate}T00:00:00Z`).getTime();
      // endDate is inclusive, so equal dates are a valid single-day range.
      if (isNaN(startMs) || isNaN(endMs) || endMs < startMs) {
        self.loadDataError = "Invalid date range. End date must not be before start date.";
        return;
      }
      const range: TimeRange = { start: startMs / 1000, end: endMs / 1000 + SECONDS_PER_DAY };

      self.loadDataError = null;
      self.isLoadingData = true;
      self.loadDaysDone = 0;
      self.loadDaysTotal = 0;

      const uploader = options.uploader ?? createEnvelopeUploader({
        getCredentials: createEnvelopeCredentialsProvider({ getJwt: options.getJwt, env: options.env }),
      });

      // Assume tiles may have landed unless the run reports otherwise: a thrown error can
      // still have uploaded tiles first, so refresh conservatively.
      let uploadedTiles = 1;
      try {
        const run = options.processEnvelopes ?? processEnvelopeCoverage;
        const result = yield run({
          stationData: station, range,
          uploadTile: (level: number, tileIndex: number, tile: EnvelopeTileData) =>
            uploader.uploadTile(station, level, tileIndex, tile),
          onProgress: (done: number, total: number) => self.updateLoadProgress(done, total),
        });
        uploadedTiles = result.uploadedTiles;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        self.loadDataError = `Error loading data: ${message}`;
        console.error("Wave Runner loadEnvelopeData error:", err);
      } finally {
        self.isLoadingData = false;
        if (uploadedTiles > 0) options.onEnvelopesUpdated?.();
      }
    }),
  }));

export interface WaveRunnerContentModelType extends Instance<typeof WaveRunnerContentModel> {}

export function isWaveRunnerContentModel(model?: ITileContentModel): model is WaveRunnerContentModelType {
  return model?.type === kWaveRunnerTileType;
}
