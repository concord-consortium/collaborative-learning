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
