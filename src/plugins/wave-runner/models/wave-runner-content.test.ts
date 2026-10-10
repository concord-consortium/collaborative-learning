import { DocumentContentModel } from "../../../models/document/document-content";
import { createDocumentModel } from "../../../models/document/document";
import { ProblemDocument } from "../../../models/document/document-types";
import "../../../models/shared/shared-data-set-registration";
import "../../shared-seismogram/shared-seismogram-registration";
import { registerTileContentInfo } from "../../../models/tiles/tile-content-info";
import { kWaveRunnerTileType } from "../wave-runner-types";
import { ModelListEntry, PLACEHOLDER_MODEL_URL } from "../../../../shared/seismic/models/model-metadata";
import { WaveRunnerContentModel, defaultWaveRunnerContent } from "./wave-runner-content";
import appConfig from "../../../clue/app-config.json";
import { SeismicDownloadService, DONE } from "../../../models/stores/seismic/seismic-download-service";
import {
  getUncoveredRanges, loadEvents, markCovered, writeEvents
} from "../../../models/stores/seismic/seismic-event-service";
import { SeismicModelRunner } from "../../../../shared/seismic/models/seismic-model-runner";
import { SECONDS_PER_DAY } from "../../../../shared/seismic/seismic-day";
import { makeFakeDownloadService } from "../../../models/stores/seismic/seismic-coverage-test-fakes";
import { getSnapshot } from "mobx-state-tree";

jest.mock("../../../models/stores/seismic/seismic-download-service", () => ({
  ...jest.requireActual("../../../models/stores/seismic/seismic-download-service"),
  SeismicDownloadService: jest.fn(),
}));
jest.mock("../../../models/stores/seismic/seismic-event-service", () =>
  jest.requireActual("../../../models/stores/seismic/seismic-coverage-test-fakes").makeEventServiceMock());
jest.mock("seisplotjs", () => {
  const actual = jest.requireActual("seisplotjs");
  return {
    ...actual,
    miniseed: {
      ...actual.miniseed,
      parseDataRecords: jest.fn(() => []),
      merge: jest.fn(() => ({ segments: [] })),
    },
  };
});

registerTileContentInfo({
  type: kWaveRunnerTileType,
  displayName: "Wave Runner",
  modelClass: WaveRunnerContentModel,
  defaultContent: defaultWaveRunnerContent,
});

describe("default date range", () => {
  it("starts a new tile at 2026-09-01 through 2026-10-01", () => {
    const content = defaultWaveRunnerContent();
    expect(content.startDate).toBe("2026-09-01");
    expect(content.endDate).toBe("2026-10-01");
  });

  it("serializes the defaults into the document snapshot", () => {
    const snapshot = getSnapshot(defaultWaveRunnerContent()) as Record<string, unknown>;
    expect(snapshot.startDate).toBe("2026-09-01");
    expect(snapshot.endDate).toBe("2026-10-01");
  });
});

describe("startDateISO and endDateISO", () => {
  // The seismogram viewport (status-and-output.tsx) reads these two getters directly as
  // startTime/endTime. endDate is inclusive - run/loadEnvelopeData add SECONDS_PER_DAY to cover
  // the whole end day - so a single-day range (start === end, now a valid pick) must still span
  // a full day's worth of time, not collapse to a single zero-width instant.
  it("gives a single-day range a non-zero span, spanning the whole end day", () => {
    const content = WaveRunnerContentModel.create({ startDate: "2026-09-15", endDate: "2026-09-15" });
    const spanMs = content.endDateISO.toMillis() - content.startDateISO.toMillis();
    expect(spanMs).toBeGreaterThan(0);
    expect(spanMs).toBe(SECONDS_PER_DAY * 1000);
  });

  it("still spans correctly across a multi-day range", () => {
    const content = WaveRunnerContentModel.create({ startDate: "2026-09-01", endDate: "2026-09-04" });
    const spanMs = content.endDateISO.toMillis() - content.startDateISO.toMillis();
    // 3 full days between the two dates' starts, plus the inclusive end day itself.
    expect(spanMs).toBe(4 * SECONDS_PER_DAY * 1000);
  });
});

const mockCompactMetadata = {
  $schema: "https://collaborative-learning.concord.org/schemas/seismic-model/v1.json",
  id: "compact-v1",
  architecture: "compact",
  class_names: ["Noise", "Earthquake"],
  sampling_rate: 100,
  window_duration: 60,
  instrument_types: ["H", "L"],
  weightsUrl: "./weights.json"
};

// Shared across describe blocks below: a real shared model manager (via a document, not a bare
// WaveRunnerContentModel.create()) is needed for loadData/loadEnvelopeData/runModel.
function setupTileInDocument() {
  const docContent = DocumentContentModel.create({
    tileMap: {
      "tile1": {
        id: "tile1",
        content: { type: kWaveRunnerTileType },
      }
    }
  });
  const docModel = createDocumentModel({
    uid: "1", type: ProblemDocument, key: "test", content: docContent as any
  });
  docModel.treeMonitor!.enableMonitoring();

  return docContent.tileMap.get("tile1")!.content as any;
}

describe("WaveRunnerContent", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("can be created in a document through the tile registry", () => {
    const docContent = DocumentContentModel.create({});
    const result = docContent.addTile(kWaveRunnerTileType);
    const tile = result?.tileId ? docContent.getTile(result.tileId) : undefined;

    expect(tile).toBeDefined();
    expect(tile!.content.type).toBe(kWaveRunnerTileType);
    // The default content has to be usable straight away: the tile renders date pickers from
    // these before the student has touched anything.
    const content = tile!.content as any;
    expect(content.startDate).toBeTruthy();
    expect(content.endDate).toBeTruthy();
    expect(content.station).toBeUndefined();
  });

  it("reaches the seismogram data it displays through the shared model", async () => {
    const content = setupTileInDocument();
    expect(content.sharedSeismogram).toBeUndefined();
    expect(content.hasStationData).toBe(false);

    content.setStation({
      network: "AK", station: "K204", location: "", channel: "HNZ", label: "Anchorage Airport"
    });
    await content.loadData();

    // loadData attaches a SharedSeismogram and hands it the station and the tile's date range,
    // which is what the waveform display reads from.
    const shared = content.sharedSeismogram;
    expect(shared).toBeDefined();
    expect(content.hasStationData).toBe(true);
    expect(shared.station.station).toBe("K204");
    expect(shared.station.network).toBe("AK");
    // Compared as instants: the shared model normalizes to millisecond precision.
    expect(new Date(shared.startTime).toISOString())
      .toBe(new Date(`${content.startDate}T00:00:00Z`).toISOString());
    // endDate is inclusive, so the shared range ends at the close of that day.
    expect(new Date(shared.endTime).getTime())
      .toBe(Date.parse(`${content.endDate}T00:00:00Z`) + SECONDS_PER_DAY * 1000);
  });

  // Timeline It! copies the shared range, and the Timeline rejects a view whose start is not
  // before its end, so a single-day range must still reach it with a full day's span.
  it("gives the shared seismogram a full day for a single-day range", async () => {
    const content = setupTileInDocument();
    content.setStation({
      network: "AK", station: "K204", location: "", channel: "HNZ", label: "Anchorage Airport"
    });
    content.setStartDate("2026-09-15");
    content.setEndDate("2026-09-15");
    await content.loadData();

    const shared = content.sharedSeismogram!;
    expect(shared.endTime!.toMillis() - shared.startTime!.toMillis()).toBe(SECONDS_PER_DAY * 1000);
  });

  it("is always user resizable", () => {
    const content = WaveRunnerContentModel.create();
    expect(content.isUserResizable).toBe(true);
  });

  it("has the standard default start and end dates", () => {
    const content = WaveRunnerContentModel.create();
    expect(content.startDate).toBe("2026-09-01");
    expect(content.endDate).toBe("2026-10-01");
  });

  it("allows setting start and end dates", () => {
    const content = setupTileInDocument();
    content.getOrCreateEventsDataSet();
    expect(content.eventsDataSet).toBeTruthy();
    content.setStartDate("2026-02-01");
    content.setEndDate("2026-02-03");
    expect(content.startDate).toBe("2026-02-01");
    expect(content.endDate).toBe("2026-02-03");
    expect(content.eventsDataSet).toBeFalsy();
  });

  it("starts with no station", () => {
    const content = WaveRunnerContentModel.create();
    expect(content.station).toBeUndefined();
  });

  it("allows setting a station via snapshot", () => {
    const content = WaveRunnerContentModel.create();
    content.setStation({
      network: "AK", station: "K204", location: "", channel: "HNZ", label: "Anchorage Airport"
    });
    expect(content.station?.network).toBe("AK");
    expect(content.station?.station).toBe("K204");
    expect(content.station?.channel).toBe("HNZ");
    expect(content.station?.label).toBe("Anchorage Airport");
  });

  it("replaces station when setStation is called again", () => {
    const content = setupTileInDocument();
    content.setStation({
      network: "AK", station: "K204", location: "", channel: "HNZ", label: "Anchorage Airport"
    });
    content.getOrCreateEventsDataSet();
    expect(content.eventsDataSet).toBeTruthy();
    content.setStation({
      network: "AK", station: "DDM", location: "01", channel: "HNZ", label: "Dexter Display Mine"
    });
    expect(content.station?.station).toBe("DDM");
    expect(content.station?.location).toBe("01");
    expect(content.eventsDataSet).toBeFalsy();
  });

  it("has no model selected initially", () => {
    const content = WaveRunnerContentModel.create();
    expect(content.selectedModelUrl).toBeUndefined();
    expect(content.selectedModelMetadata).toBeNull();
  });

  it("exports a JSON string including persisted fields", () => {
    const content = WaveRunnerContentModel.create({
      startDate: "2026-02-01",
      endDate: "2026-02-03",
      station: { network: "AK", station: "K204", location: "", channel: "HNZ", label: "Anchorage Airport" },
      selectedModelUrl: "https://example.com/model/metadata.json"
    });
    const json = content.exportJson();
    expect(typeof json).toBe("string");
    expect(json.length).toBeGreaterThan(0);
    const parsed = JSON.parse(json);
    expect(parsed.type).toBe("WaveRunner");
    expect(parsed.startDate).toBe("2026-02-01");
    expect(parsed.endDate).toBe("2026-02-03");
    expect(parsed.station).toMatchObject({ network: "AK", station: "K204", channel: "HNZ" });
    expect(parsed.selectedModelUrl).toBe("https://example.com/model/metadata.json");
  });

  it("addDetectedEvents drops events duplicating an existing windowStart+eventType", () => {
    const content = WaveRunnerContentModel.create();
    const evt = { windowStart: 1710720000000, windowEnd: 1710720060000, eventType: "earthquake", confidence: 0.9 };
    content.addDetectedEvents([evt]);
    content.addDetectedEvents([{ ...evt, confidence: 0.8 }, { ...evt, eventType: "traffic" }]);
    expect(content.detectedEvents).toHaveLength(2);
    expect(content.detectedEvents.map((e: any) => e.eventType)).toEqual(["earthquake", "traffic"]);
  });

  it("configures the compact model in the wave-runner settings", () => {
    const models = appConfig.config.settings["wave-runner"].models as ModelListEntry[];
    expect(models.length).toBeGreaterThanOrEqual(1);
    expect(models[0].label).toBe("Compact Model");
    expect(models[0].metadataUrl).toContain("compact-v2");
  });

  describe("ensureModelMetadata", () => {
    it("fetches metadata and resolves relative weightsUrl", async () => {
      const content = WaveRunnerContentModel.create();
      jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ...mockCompactMetadata }),
      } as Response);

      await content.ensureModelMetadata("https://models.example.com/v1/compact-v1/metadata.json");

      expect(content.selectedModelUrl).toBe("https://models.example.com/v1/compact-v1/metadata.json");
      expect(content.selectedModelMetadata?.id).toBe("compact-v1");
      expect(content.selectedModelMetadata?.weightsUrl)
        .toBe("https://models.example.com/v1/compact-v1/weights.json");
      expect(content.modelLoadError).toBeNull();
    });

    it("sets error on fetch failure", async () => {
      const content = WaveRunnerContentModel.create();
      jest.spyOn(global, "fetch").mockResolvedValue({
        ok: false,
        status: 404,
      } as Response);

      await content.ensureModelMetadata("https://example.com/bad-url.json");

      expect(content.selectedModelMetadata).toBeNull();
      expect(content.modelLoadError).toContain("404");
    });

    it("rejects unsupported schema version", async () => {
      const content = WaveRunnerContentModel.create();
      const badMetadata = { ...mockCompactMetadata, $schema: "https://example.com/schemas/seismic-model/v99.json" };
      jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(badMetadata),
      } as Response);

      await content.ensureModelMetadata("https://example.com/metadata.json");

      expect(content.selectedModelMetadata).toBeNull();
      expect(content.modelLoadError).toContain("Unsupported model schema");
      expect(content.modelLoadError).toContain("v99");
    });

    it("sets error on network failure", async () => {
      const content = WaveRunnerContentModel.create();
      jest.spyOn(global, "fetch").mockRejectedValue(new Error("Network error"));

      await content.ensureModelMetadata("https://example.com/metadata.json");

      expect(content.selectedModelMetadata).toBeNull();
      expect(content.modelLoadError).toContain("Network error");
    });

    it("skips fetch if URL matches and metadata is already loaded", async () => {
      const content = WaveRunnerContentModel.create();
      let fetchCount = 0;
      jest.spyOn(global, "fetch").mockImplementation(() => {
        fetchCount++;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ...mockCompactMetadata }),
        } as Response);
      });

      const url = "https://models.example.com/v1/compact-v1/metadata.json";
      await content.ensureModelMetadata(url);
      expect(fetchCount).toBe(1);
      expect(content.selectedModelMetadata).not.toBeNull();

      // Second call with same URL — should not fetch again
      await content.ensureModelMetadata(url);
      expect(fetchCount).toBe(1);
    });
  });

  describe("runModel", () => {
    it("sets error when no model URL is set", async () => {
      const content = WaveRunnerContentModel.create();
      await content.runModel();
      expect(content.runError).toBe("No model selected");
      expect(content.isRunning).toBe(false);
    });

    it("fetches metadata automatically if URL is set but metadata is missing", async () => {
      const content = WaveRunnerContentModel.create({ selectedModelUrl: "https://example.com/metadata.json" });
      jest.spyOn(global, "fetch").mockResolvedValue({
        ok: false,
        status: 500,
      } as Response);

      await content.runModel();

      // runModel should have tried to fetch metadata and failed
      expect(content.runError).toContain("Failed to fetch model metadata");
      expect(content.isRunning).toBe(false);
    });

    it("downloads each ready day via the service and runs the model on it", async () => {
      const days = [100, 101];
      let i = 0;
      const fakeService = {
        ensureRange: jest.fn(),
        nextReadyDay: jest.fn(async () => (i < days.length ? days[i++] : DONE)),
        readDay: jest.fn(async () => new ArrayBuffer(8)),
        cancel: jest.fn(),
        erroredDays: [],
        emptyDays: [],
      };
      (SeismicDownloadService as jest.Mock).mockImplementation(() => fakeService);
      jest.spyOn(SeismicModelRunner.prototype, "loadModel").mockResolvedValue(undefined);
      const processChunk = jest.spyOn(SeismicModelRunner.prototype, "processChunk").mockResolvedValue([]);

      const content = setupTileInDocument();
      content.setStation({ network: "AK", station: "K204", location: "", channel: "HNZ", label: "x" });
      content.setStartDate("2026-02-01");
      content.setEndDate("2026-02-03");
      await content.ensureModelMetadata(PLACEHOLDER_MODEL_URL);

      await content.runModel();

      expect(fakeService.ensureRange).toHaveBeenCalledTimes(1);
      expect(fakeService.readDay).toHaveBeenCalledTimes(2);
      expect(processChunk).toHaveBeenCalledTimes(2);
      expect(content.runError).toBeNull();
      expect(content.isRunning).toBe(false);
    });

    // start === end must be accepted as one valid day, not rejected as an invalid range - and that
    // guard only lives in this one branch of runModel, reached after the model/metadata/station
    // guards pass, so the assertions below must come from an actual run rather than runError's
    // own default of null.
    it("treats start === end as one valid day, not an invalid range, when running the model", async () => {
      const singleDaySec = Date.UTC(2026, 8, 15) / 1000; // 2026-09-15
      const singleDay = singleDaySec / SECONDS_PER_DAY;
      const fakeService = makeFakeDownloadService([singleDay]);
      (SeismicDownloadService as jest.Mock).mockImplementation(() => fakeService);
      jest.spyOn(SeismicModelRunner.prototype, "loadModel").mockResolvedValue(undefined);
      const processChunk = jest.spyOn(SeismicModelRunner.prototype, "processChunk").mockResolvedValue([]);

      const content = setupTileInDocument();
      content.setStation({ network: "AK", station: "K204", location: "", channel: "HNZ", label: "x" });
      content.setStartDate("2026-09-15");
      content.setEndDate("2026-09-15");
      await content.ensureModelMetadata(PLACEHOLDER_MODEL_URL);

      await content.runModel();

      // runError being null is not proof by itself - it starts out null anyway. Proof the single
      // day was actually accepted and processed is that the model ran on it.
      expect(content.runError).not.toBe("Invalid date range. End date must not be before start date.");
      expect(content.runError).toBeNull();
      expect(fakeService.readDay).toHaveBeenCalledTimes(1);
      expect(processChunk).toHaveBeenCalledTimes(1);
    });

    describe("event database integration", () => {
      // startDate 2026-02-01, endDate 2026-02-03 inclusive: three full UTC days (Feb 1–3)
      const feb1Sec = Date.UTC(2026, 1, 1) / 1000;
      const feb1Day = feb1Sec / SECONDS_PER_DAY;

      // The shared fake serves only the ready days that fall within the most recent
      // ensureRange call, then DONE — see makeFakeDownloadService.
      function makeFakeService(days: number[]) {
        const fakeService = makeFakeDownloadService(days);
        (SeismicDownloadService as jest.Mock).mockImplementation(() => fakeService);
        return fakeService;
      }

      async function setupRunReadyContent() {
        jest.spyOn(SeismicModelRunner.prototype, "loadModel").mockResolvedValue(undefined);
        const content = setupTileInDocument();
        content.setStation({ network: "AK", station: "K204", location: "", channel: "HNZ", label: "x" });
        content.setStartDate("2026-02-01");
        content.setEndDate("2026-02-03");
        await content.ensureModelMetadata(PLACEHOLDER_MODEL_URL);
        return content;
      }

      const makeEvent = (windowStart: number, eventType = "earthquake") => ({
        windowStart, windowEnd: windowStart + 60000, eventType, confidence: 0.9
      });

      beforeEach(() => {
        (loadEvents as jest.Mock).mockClear();
        (getUncoveredRanges as jest.Mock).mockClear();
        (writeEvents as jest.Mock).mockClear();
        (markCovered as jest.Mock).mockClear();
      });

      it("loads prior events into the dataset even when the model finds nothing", async () => {
        const prior = [makeEvent(Date.UTC(2026, 1, 1, 1)), makeEvent(Date.UTC(2026, 1, 1, 2), "traffic")];
        (loadEvents as jest.Mock).mockResolvedValueOnce(prior);
        makeFakeService([feb1Day, feb1Day + 1, feb1Day + 2]);
        jest.spyOn(SeismicModelRunner.prototype, "processChunk").mockResolvedValue([]);

        const content = await setupRunReadyContent();
        await content.runModel();

        expect(loadEvents).toHaveBeenCalledTimes(1);
        expect(loadEvents).toHaveBeenCalledWith(expect.anything(), "placeholder-v1",
          { start: feb1Sec, end: feb1Sec + 3 * SECONDS_PER_DAY });
        expect(content.runError).toBeNull();
        expect(content.eventsDataSet?.dataSet.cases).toHaveLength(2);
      });

      it("only downloads days the event database reports as uncovered", async () => {
        // Only the middle day (Feb 2) of the three-day range is uncovered
        const feb2Sec = feb1Sec + SECONDS_PER_DAY;
        (getUncoveredRanges as jest.Mock).mockResolvedValueOnce(
          [{ start: feb2Sec, end: feb2Sec + SECONDS_PER_DAY }]);
        const fakeService = makeFakeService([feb1Day + 1]);
        const processChunk = jest.spyOn(SeismicModelRunner.prototype, "processChunk").mockResolvedValue([]);

        const content = await setupRunReadyContent();
        await content.runModel();

        expect(fakeService.ensureRange).toHaveBeenCalledTimes(1);
        expect(fakeService.ensureRange).toHaveBeenCalledWith(
          expect.objectContaining({ startSec: feb2Sec, endSec: feb2Sec }));
        expect(processChunk).toHaveBeenCalledTimes(1);
        expect(content.chunksProcessed).toBe(1);
        expect(content.chunksTotal).toBe(1);
        expect(content.runError).toBeNull();
      });

      it("skips downloading entirely when the range is fully covered", async () => {
        (loadEvents as jest.Mock).mockResolvedValueOnce([makeEvent(Date.UTC(2026, 1, 1, 1))]);
        (getUncoveredRanges as jest.Mock).mockResolvedValueOnce([]);
        const fakeService = makeFakeService([]);
        const processChunk = jest.spyOn(SeismicModelRunner.prototype, "processChunk").mockResolvedValue([]);

        const content = await setupRunReadyContent();
        await content.runModel();

        expect(fakeService.ensureRange).not.toHaveBeenCalled();
        expect(processChunk).not.toHaveBeenCalled();
        expect(content.runError).toBeNull();
        expect(content.eventsDataSet?.dataSet.cases).toHaveLength(1);
      });

      it("persists each processed day's events and coverage", async () => {
        makeFakeService([feb1Day]);
        const evt = makeEvent(Date.UTC(2026, 1, 1, 1));
        jest.spyOn(SeismicModelRunner.prototype, "processChunk")
          .mockImplementation(async (_seismogram: any, callbacks: any) => {
            callbacks.onEvents([evt]);
            return [];
          });

        const content = await setupRunReadyContent();
        await content.runModel();

        expect(writeEvents).toHaveBeenCalledTimes(1);
        expect(writeEvents).toHaveBeenCalledWith(expect.anything(), "placeholder-v1", [evt]);
        expect(markCovered).toHaveBeenCalledWith(expect.anything(), "placeholder-v1",
          { start: feb1Day * SECONDS_PER_DAY, end: (feb1Day + 1) * SECONDS_PER_DAY });
        expect(content.runError).toBeNull();
      });

      it("marks empty days covered but never errored days", async () => {
        // Feb 1 has data + events, Feb 2 is empty, Feb 3 errors
        const fakeService = makeFakeService([feb1Day]);
        fakeService.emptyDays.push(feb1Day + 1);
        fakeService.erroredDays.push(feb1Day + 2);
        const evt = makeEvent(Date.UTC(2026, 1, 1, 1));
        jest.spyOn(SeismicModelRunner.prototype, "processChunk")
          .mockImplementation(async (_seismogram: any, callbacks: any) => {
            callbacks.onEvents([evt]);
            return [];
          });

        const content = await setupRunReadyContent();
        await content.runModel();

        expect(writeEvents).toHaveBeenCalledTimes(1);
        expect(markCovered).toHaveBeenCalledTimes(2);
        expect(markCovered).toHaveBeenCalledWith(expect.anything(), "placeholder-v1",
          { start: feb1Day * SECONDS_PER_DAY, end: (feb1Day + 1) * SECONDS_PER_DAY });
        expect(markCovered).toHaveBeenCalledWith(expect.anything(), "placeholder-v1",
          { start: (feb1Day + 1) * SECONDS_PER_DAY, end: (feb1Day + 2) * SECONDS_PER_DAY });
        expect(markCovered).not.toHaveBeenCalledWith(expect.anything(), "placeholder-v1",
          { start: (feb1Day + 2) * SECONDS_PER_DAY, end: (feb1Day + 3) * SECONDS_PER_DAY });
        expect(content.chunksProcessed).toBe(3);
        expect(content.chunksTotal).toBe(3);
        expect(content.runError).toBeNull();
      });

      it("downloads each uncovered span separately", async () => {
        // Feb 1 and Feb 3 uncovered; Feb 2 covered
        const feb3Sec = feb1Sec + 2 * SECONDS_PER_DAY;
        (getUncoveredRanges as jest.Mock).mockResolvedValueOnce([
          { start: feb1Sec, end: feb1Sec + SECONDS_PER_DAY },
          { start: feb3Sec, end: feb3Sec + SECONDS_PER_DAY },
        ]);
        const fakeService = makeFakeService([feb1Day, feb1Day + 2]);
        const processChunk = jest.spyOn(SeismicModelRunner.prototype, "processChunk").mockResolvedValue([]);

        const content = await setupRunReadyContent();
        await content.runModel();

        expect(fakeService.ensureRange).toHaveBeenCalledTimes(2);
        expect(fakeService.ensureRange).toHaveBeenNthCalledWith(1,
          expect.objectContaining({ startSec: feb1Sec, endSec: feb1Sec }));
        expect(fakeService.ensureRange).toHaveBeenNthCalledWith(2,
          expect.objectContaining({ startSec: feb3Sec, endSec: feb3Sec }));
        expect(processChunk).toHaveBeenCalledTimes(2);
        expect(content.chunksProcessed).toBe(2);
        expect(content.chunksTotal).toBe(2);
        expect(content.runError).toBeNull();
      });

      it("still runs the full range when the event database is unavailable", async () => {
        (loadEvents as jest.Mock).mockRejectedValueOnce(new Error("offline"));
        const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
        const fakeService = makeFakeService([feb1Day, feb1Day + 1, feb1Day + 2]);
        const processChunk = jest.spyOn(SeismicModelRunner.prototype, "processChunk").mockResolvedValue([]);

        const content = await setupRunReadyContent();
        await content.runModel();

        expect(fakeService.ensureRange).toHaveBeenCalledTimes(1);
        expect(fakeService.ensureRange).toHaveBeenCalledWith(
          expect.objectContaining({ startSec: feb1Sec, endSec: feb1Sec + 2 * SECONDS_PER_DAY }));
        expect(processChunk).toHaveBeenCalledTimes(3);
        expect(content.chunksProcessed).toBe(3);
        expect(content.chunksTotal).toBe(3);
        expect(content.runError).toBeNull();
        expect(warn).toHaveBeenCalled();
      });
    });
  });
});

// See runModel's and loadEnvelopeData's own comments in wave-runner-content.ts for why each must
// clear the other's error as it starts.
describe("cross-operation error clearing", () => {
  const testStation = { network: "AK", station: "K204", location: "", channel: "HNZ", label: "x" };

  it("clears a stale loadDataError once a run starts", async () => {
    const content = setupTileInDocument();
    content.setStation(testStation);
    content.setStartDate("2026-02-01");
    content.setEndDate("2026-02-01");

    await content.loadEnvelopeData({
      getJwt: async () => "jwt",
      uploader: { uploadTile: jest.fn().mockResolvedValue(undefined) },
      processEnvelopes: jest.fn().mockRejectedValue(new Error("offline")),
    });
    expect(content.loadDataError).toContain("offline");

    jest.spyOn(SeismicModelRunner.prototype, "loadModel").mockResolvedValue(undefined);
    jest.spyOn(SeismicModelRunner.prototype, "processChunk").mockResolvedValue([]);
    const feb1Sec = Date.UTC(2026, 1, 1) / 1000;
    const feb1Day = feb1Sec / SECONDS_PER_DAY;
    (SeismicDownloadService as jest.Mock).mockImplementation(() => makeFakeDownloadService([feb1Day]));
    await content.ensureModelMetadata(PLACEHOLDER_MODEL_URL);

    await content.runModel();

    expect(content.runError).toBeNull();
    expect(content.loadDataError).toBeNull();
  });

  it("clears a stale runError once loadEnvelopeData starts", async () => {
    const content = setupTileInDocument();
    await content.runModel();
    expect(content.runError).toBe("No model selected");

    content.setStation(testStation);
    const processEnvelopes = jest.fn().mockResolvedValue(
      { uploadedTiles: 0, processedDays: 0, skippedDays: 0, totalDays: 0 });
    await content.loadEnvelopeData({
      getJwt: async () => "jwt",
      uploader: { uploadTile: jest.fn().mockResolvedValue(undefined) },
      processEnvelopes,
    });

    expect(content.loadDataError).toBeNull();
    expect(content.runError).toBeNull();
  });

  // The cross-clear used to run only after the "no model selected" guard, so a bailed-out runModel
  // call - one that never gets far enough to do anything - left a previous load failure on screen
  // indefinitely. Clearing loadDataError must happen before that guard, not after it.
  it("clears a stale loadDataError even when runModel bails out on an early guard", async () => {
    const content = setupTileInDocument();
    content.setStation(testStation);

    await content.loadEnvelopeData({
      getJwt: async () => "jwt",
      uploader: { uploadTile: jest.fn().mockResolvedValue(undefined) },
      processEnvelopes: jest.fn().mockRejectedValue(new Error("offline")),
    });
    expect(content.loadDataError).toContain("offline");

    // No model selected, so this bails out on the very first guard in runModel.
    await content.runModel();

    expect(content.runError).toBe("No model selected");
    expect(content.loadDataError).toBeNull();
  });
});

describe("loadEnvelopeData", () => {
  const station = { network: "AK", station: "K204", location: "", channel: "HNZ", label: "Anchorage Airport" };
  const fakeUploader = { uploadTile: jest.fn().mockResolvedValue(undefined) };
  const getJwt = jest.fn().mockResolvedValue("jwt");

  function createContent() {
    return WaveRunnerContentModel.create({ station, startDate: "2025-01-01", endDate: "2025-01-02" });
  }

  beforeEach(() => {
    fakeUploader.uploadTile.mockClear();
    getJwt.mockClear();
  });

  it("runs the envelope service over the day-aligned inclusive range", async () => {
    const content = createContent();
    const processEnvelopes = jest.fn().mockImplementation(async (callOpts: any) => {
      callOpts.onProgress?.(1, 2);
      return { uploadedTiles: 3, processedDays: 2, skippedDays: 0, totalDays: 2 };
    });
    const onEnvelopesUpdated = jest.fn();
    await content.loadEnvelopeData({ getJwt, uploader: fakeUploader, processEnvelopes, onEnvelopesUpdated });

    expect(processEnvelopes).toHaveBeenCalledTimes(1);
    const opts = processEnvelopes.mock.calls[0][0];
    // 2025-01-01 through the end of 2025-01-02 (endDate is inclusive)
    expect(opts.range).toEqual({ start: Date.UTC(2025, 0, 1) / 1000, end: Date.UTC(2025, 0, 3) / 1000 });
    expect(content.loadDaysDone).toBe(1);
    expect(content.loadDaysTotal).toBe(2);
    expect(content.isLoadingData).toBe(false);
    expect(content.loadDataError).toBeNull();
    expect(onEnvelopesUpdated).toHaveBeenCalled();
  });

  it("routes tile uploads through the uploader with the station", async () => {
    const content = createContent();
    const tile = { mins: new Int16Array(0), maxs: new Int16Array(0) };
    const processEnvelopes = jest.fn().mockImplementation(async (opts: any) => {
      await opts.uploadTile(2, 7, tile);
      return { uploadedTiles: 1, processedDays: 1, skippedDays: 0, totalDays: 1 };
    });
    await content.loadEnvelopeData({ getJwt, uploader: fakeUploader, processEnvelopes });
    expect(fakeUploader.uploadTile).toHaveBeenCalledWith(content.station, 2, 7, tile);
  });

  it("skips the refresh callback when nothing was uploaded", async () => {
    const content = createContent();
    const processEnvelopes = jest.fn().mockResolvedValue(
      { uploadedTiles: 0, processedDays: 0, skippedDays: 0, totalDays: 0 });
    const onEnvelopesUpdated = jest.fn();
    await content.loadEnvelopeData({ getJwt, uploader: fakeUploader, processEnvelopes, onEnvelopesUpdated });
    expect(onEnvelopesUpdated).not.toHaveBeenCalled();
  });

  it("reports errors and still refreshes since tiles may have uploaded before the failure", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const content = createContent();
      const processEnvelopes = jest.fn().mockRejectedValue(new Error("upload failed"));
      const onEnvelopesUpdated = jest.fn();
      await content.loadEnvelopeData({ getJwt, uploader: fakeUploader, processEnvelopes, onEnvelopesUpdated });
      expect(content.loadDataError).toBe("Error loading data: upload failed");
      expect(content.isLoadingData).toBe(false);
      expect(onEnvelopesUpdated).toHaveBeenCalled();
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("rejects an end date before the start date", async () => {
    const content = WaveRunnerContentModel.create({ station, startDate: "2025-02-01", endDate: "2025-01-01" });
    const processEnvelopes = jest.fn();
    await content.loadEnvelopeData({ getJwt, uploader: fakeUploader, processEnvelopes });
    expect(processEnvelopes).not.toHaveBeenCalled();
    expect(content.loadDataError).toMatch(/Invalid date range/);
  });

  it("ignores a second call while a load is in flight", async () => {
    const content = createContent();
    let resolveRun: (v: unknown) => void = () => undefined;
    const processEnvelopes = jest.fn(() => new Promise(res => { resolveRun = res; }));
    const options = { getJwt, uploader: fakeUploader, processEnvelopes: processEnvelopes as any };
    const first = content.loadEnvelopeData(options);
    const second = content.loadEnvelopeData(options);
    await second;
    expect(processEnvelopes).toHaveBeenCalledTimes(1);
    resolveRun({ uploadedTiles: 0, processedDays: 0, skippedDays: 0, totalDays: 0 });
    await first;
    expect(content.isLoadingData).toBe(false);
  });

  it("does nothing without a station", async () => {
    const content = WaveRunnerContentModel.create({});
    const processEnvelopes = jest.fn();
    await content.loadEnvelopeData({ getJwt, uploader: fakeUploader, processEnvelopes });
    expect(processEnvelopes).not.toHaveBeenCalled();
  });
});
