import { fetchModelMetadata, PLACEHOLDER_METADATA, PLACEHOLDER_MODEL_URL, SUPPORTED_SCHEMA }
  from "./model-metadata";

const validMetadata = () => ({
  $schema: SUPPORTED_SCHEMA, id: "test-v1", architecture: "compact",
  class_names: ["Noise", "Earthquake"], sampling_rate: 100, window_duration: 60,
  instrument_types: ["H"], weightsUrl: "weights.json",
});

describe("fetchModelMetadata", () => {
  const mockFetch = jest.fn();
  beforeEach(() => { mockFetch.mockReset(); global.fetch = mockFetch; });

  it("fetches, validates, and resolves weightsUrl relative to the metadata URL", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => validMetadata() });
    const metadata = await fetchModelMetadata("https://models.example.com/compact/metadata.json");
    expect(mockFetch).toHaveBeenCalledWith("https://models.example.com/compact/metadata.json");
    expect(metadata.weightsUrl).toBe("https://models.example.com/compact/weights.json");
  });

  it("short-circuits the placeholder URL without fetching, returning a fresh copy", async () => {
    const a = await fetchModelMetadata(PLACEHOLDER_MODEL_URL);
    const b = await fetchModelMetadata(PLACEHOLDER_MODEL_URL);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(a).toEqual(PLACEHOLDER_METADATA);
    expect(a).not.toBe(b);
  });

  it("throws on a non-ok response", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 });
    await expect(fetchModelMetadata("https://x/metadata.json")).rejects.toThrow("404");
  });

  it("throws on an unsupported schema, naming it", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ...validMetadata(), $schema: "bogus" }) });
    await expect(fetchModelMetadata("https://x/metadata.json")).rejects.toThrow('"bogus"');
  });
});
