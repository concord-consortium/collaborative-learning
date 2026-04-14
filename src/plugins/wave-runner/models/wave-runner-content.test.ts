import { WaveRunnerContentModel, DEFAULT_MODELS } from "./wave-runner-content";

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
    const content = WaveRunnerContentModel.create();
    content.setStartDate("2026-02-01");
    content.setEndDate("2026-02-03");
    expect(content.startDate).toBe("2026-02-01");
    expect(content.endDate).toBe("2026-02-03");
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
    const content = WaveRunnerContentModel.create();
    content.setStation({
      network: "AK", station: "K204", location: "", channel: "HNZ", label: "Anchorage Airport"
    });
    content.setStation({
      network: "AK", station: "DDM", location: "01", channel: "HNZ", label: "Dexter Display Mine"
    });
    expect(content.station?.station).toBe("DDM");
    expect(content.station?.location).toBe("01");
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
