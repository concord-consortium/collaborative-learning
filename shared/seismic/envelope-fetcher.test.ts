import { fetchEnvelopeTile } from "./envelope-fetcher";
import { encodeEnvelopeTile } from "./envelope-codec";
import { FetchEnvelopeTileParams } from "./seismic-types";

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

const baseParams: FetchEnvelopeTileParams = {
  network: "AK",
  station: "K204",
  channel: "HNZ",
  level: 1,
  tileIndex: 42,
  s3BaseUrl: "https://test-bucket.s3.amazonaws.com/tiles/",
};

describe("fetchEnvelopeTile", () => {
  afterEach(() => {
    mockFetch.mockReset();
  });

  it("fetches and decodes a tile from S3", async () => {
    const mins = new Int16Array([100, -200, 300]);
    const maxs = new Int16Array([400, -100, 600]);
    const encoded = encodeEnvelopeTile(mins, maxs);

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: () => Promise.resolve(encoded),
    });

    const result = await fetchEnvelopeTile(baseParams);
    expect(result).not.toBeNull();
    expect(result!.mins).toEqual(mins);
    expect(result!.maxs).toEqual(maxs);

    // Verify the URL was constructed correctly
    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain("AK_K204");
    expect(calledUrl).toContain("HNZ");
    expect(calledUrl).toContain("L1");
    expect(calledUrl).toContain("42");
  });

  it("returns null on 404", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 });
    const result = await fetchEnvelopeTile(baseParams);
    expect(result).toBeNull();
  });

  it("throws on non-404 errors", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: "Server Error" });
    await expect(fetchEnvelopeTile(baseParams)).rejects.toThrow("500");
  });

  it("passes signal to fetch", async () => {
    const controller = new AbortController();
    mockFetch.mockResolvedValue({ ok: false, status: 404 });

    await fetchEnvelopeTile({ ...baseParams, signal: controller.signal });
    expect(mockFetch.mock.calls[0][1]?.signal).toBe(controller.signal);
  });

  it("uses default s3BaseUrl when none provided", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 });
    const { s3BaseUrl, ...paramsWithoutBase } = baseParams;
    await fetchEnvelopeTile(paramsWithoutBase);

    const calledUrl = mockFetch.mock.calls[0][0];
    // Should use some default URL, not undefined
    expect(calledUrl).toMatch(/^https?:\/\//);
  });
});
