import { DateTime } from "luxon";
import stringify from "json-stringify-pretty-compact";
import { cast, flow, getSnapshot, types, Instance } from "mobx-state-tree";
import { eventDocId } from "../../../../shared/seismic/event-database";
import { fetchModelMetadata, ModelListEntry } from "../../../../shared/seismic/model-metadata";
import { SECONDS_PER_DAY } from "../../../../shared/seismic/seismic-day";
import { TimeRange } from "../../../../shared/seismic/seismic-types";
import { processUncoveredRanges } from "../../../models/stores/seismic/seismic-coverage-processor";
import { getUncoveredRanges, loadEvents } from "../../../models/stores/seismic/seismic-event-service";
import { ModelMetadata, SeismicEvent } from "../../../../shared/seismic/seismic-model-types";
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

      try {
        self.selectedModelMetadata = yield fetchModelMetadata(metadataUrl);
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
      const station = self.station;

      self.clearEventsDataSet();
      self.runError = null;
      self.isRunning = true;

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
          self.addDetectedEvents(prior);
          uncovered = yield getUncoveredRanges(station, modelId, rangeSec);
        } catch (err) {
          console.warn("Seismic event database unavailable; processing the full range:", err);
        }

        yield processUncoveredRanges({
          stationData: station, metadata, range: rangeSec, uncovered,
          onEvents: events => self.addDetectedEvents(events),
          onProgress: (progress, total) => self.updateChunkProgress(progress, total),
        });

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
        const message = err instanceof Error ? err.message : String(err);
        self.runError = `Error running model: ${message}`;
        console.error("Wave Runner runModel error:", err);
      } finally {
        self.isRunning = false;
      }
    })
  }));

export interface WaveRunnerContentModelType extends Instance<typeof WaveRunnerContentModel> {}

export function isWaveRunnerContentModel(model?: ITileContentModel): model is WaveRunnerContentModelType {
  return model?.type === kWaveRunnerTileType;
}
