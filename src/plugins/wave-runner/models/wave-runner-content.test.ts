import { DocumentContentModel } from "../../../models/document/document-content";
import { createDocumentModel } from "../../../models/document/document";
import { ProblemDocument } from "../../../models/document/document-types";
import "../../../models/shared/shared-data-set-registration";
import "../../shared-seismogram/shared-seismogram-registration";
import { registerTileContentInfo } from "../../../models/tiles/tile-content-info";
import { kWaveRunnerTileType } from "../wave-runner-types";
import { WaveRunnerContentModel, DEFAULT_MODELS, defaultWaveRunnerContent } from "./wave-runner-content";

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

  it("DEFAULT_MODELS contains at least the compact model", () => {
    expect(DEFAULT_MODELS.length).toBeGreaterThanOrEqual(1);
    expect(DEFAULT_MODELS[0].label).toBe("Compact Model");
    expect(DEFAULT_MODELS[0].metadataUrl).toContain("compact-v1");
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
  });
});
