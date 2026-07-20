import { DocumentContentModel } from "../../../models/document/document-content";
import { createDocumentModel } from "../../../models/document/document";
import { ProblemDocument } from "../../../models/document/document-types";
import "../../../models/shared/shared-data-set-registration";
import "../../shared-seismogram/shared-seismogram-registration";
import { registerTileContentInfo } from "../../../models/tiles/tile-content-info";
import { kWaveRunnerTileType } from "../wave-runner-types";
import { ModelListEntry, PLACEHOLDER_MODEL_URL } from "../../../../shared/seismic/model-metadata";
import { WaveRunnerContentModel, defaultWaveRunnerContent } from "./wave-runner-content";
import appConfig from "../../../clue/app-config.json";
import { SeismicDownloadService, DONE } from "../../../models/stores/seismic/seismic-download-service";
import {
  getUncoveredRanges, loadEvents, markCovered, writeEvents
} from "../../../models/stores/seismic/seismic-event-service";
import { SeismicModelRunner } from "../../../../shared/seismic/seismic-model-runner";
import { SECONDS_PER_DAY } from "../../../../shared/seismic/seismic-day";
import { makeFakeDownloadService } from "../../../models/stores/seismic/seismic-coverage-test-fakes";

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

describe("WaveRunnerContent", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

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

  it("is always user resizable", () => {
    const content = WaveRunnerContentModel.create();
    expect(content.isUserResizable).toBe(true);
  });

  it("has default start and end dates covering the mock data range", () => {
    const content = WaveRunnerContentModel.create();
    expect(content.startDate).toBe("2025-01-01");
    expect(content.endDate).toBe("2025-12-31");
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
