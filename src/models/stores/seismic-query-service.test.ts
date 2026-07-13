import { DateTime } from "luxon";
import { SeismicQueryService, envelopeCacheKey } from "./seismic-query-service";
import { encodeEnvelopeTile } from "../../../shared/seismic/envelope-codec";
import { LEVEL_SPACINGS, NO_DATA_SENTINEL } from "../../../shared/seismic/envelope-config";
import { getTileTimeRange } from "../../../shared/seismic/tile-addressing";
import { SeismicViewportParams } from "../../../shared/seismic/seismic-types";

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock seisplotjs
jest.mock("seisplotjs", () => ({
  miniseed: {
    parseDataRecords: jest.fn(() => []),
    merge: jest.fn(() => null),
  },
}));

const stationData = { network: "AK", station: "K204", channel: "HNZ" };

describe("SeismicQueryService", () => {
  describe("selectLevel", () => {
    let service: SeismicQueryService;
    const t0 = DateTime.fromSeconds(0, { zone: "utc" });

    function selectLevelFromSecondsPerPixel(spp: number) {
      return service.selectLevel(t0, DateTime.fromSeconds(spp * 1000, { zone: "utc" }), 1000);
    }

    beforeEach(() => {
      service = new SeismicQueryService();
    });

    it("selects L0 when secondsPerPixel >= L0 spacing (15750)", () => {
      expect(selectLevelFromSecondsPerPixel(15750)).toBe(0);
      expect(selectLevelFromSecondsPerPixel(20000)).toBe(0);
    });

    it("selects L1 when secondsPerPixel >= L1 spacing (157.5)", () => {
      expect(selectLevelFromSecondsPerPixel(157.5)).toBe(1);
      expect(selectLevelFromSecondsPerPixel(1000)).toBe(1);
    });

    it("selects L2 when secondsPerPixel >= L2 spacing (1.575)", () => {
      expect(selectLevelFromSecondsPerPixel(1.575)).toBe(2);
      expect(selectLevelFromSecondsPerPixel(10)).toBe(2);
    });

    it("selects raw when secondsPerPixel < L2 spacing", () => {
      expect(selectLevelFromSecondsPerPixel(1)).toBe("raw");
      expect(selectLevelFromSecondsPerPixel(0.01)).toBe("raw");
    });
  });
});

describe("SeismicQueryService query", () => {
  let service: SeismicQueryService;

  const viewportParams = (overrides?: Partial<SeismicViewportParams>): SeismicViewportParams => ({
    stationData,
    startTime: DateTime.fromSeconds(0, { zone: "utc" }),
    endTime: DateTime.fromSeconds(LEVEL_SPACINGS[1] * 1000, { zone: "utc" }),
    pixelWidth: 1000,
    ...overrides,
  });

  beforeEach(() => {
    service = new SeismicQueryService();
    mockFetch.mockReset();
  });

  it("returns isLoading true when tiles are not yet cached", () => {
    const result = service.query(viewportParams());
    expect(result.isLoading).toBe(true);
  });

  it("returns envelope data from cached tiles", () => {
    const level = 1;
    const tileIndex = 0;
    const mins = new Int16Array([1000, 2000]);
    const maxs = new Int16Array([3000, 4000]);
    const key = envelopeCacheKey(stationData, level, tileIndex);
    service.envelopeCache.set(key, { mins, maxs });

    const range = getTileTimeRange(level, tileIndex);
    const result = service.query(viewportParams({
      startTime: DateTime.fromSeconds(range.start, { zone: "utc" }),
      endTime: DateTime.fromSeconds(range.start + LEVEL_SPACINGS[level] * 2, { zone: "utc" }),
      pixelWidth: 2,
    }));

    expect(result.level).toBe(1);
    expect(result.data[0].length).toBe(2);
    expect(result.data[1][0]).not.toBeNull();
    expect(result.data[2][0]).not.toBeNull();
  });

  it("inserts nulls for missing tiles", () => {
    const level = 1;
    const tileIndex = 0;
    const key = envelopeCacheKey(stationData, level, tileIndex);
    service.envelopeCache.set(key, "missing");

    const range = getTileTimeRange(level, tileIndex);
    const result = service.query(viewportParams({
      startTime: DateTime.fromSeconds(range.start, { zone: "utc" }),
      endTime: DateTime.fromSeconds(range.start + LEVEL_SPACINGS[level] * 2, { zone: "utc" }),
      pixelWidth: 2,
    }));

    expect(result.data[1][0]).toBeNull();
    expect(result.data[2][0]).toBeNull();
  });

  it("handles NO_DATA_SENTINEL as null", () => {
    const level = 1;
    const tileIndex = 0;
    const mins = new Int16Array([NO_DATA_SENTINEL]);
    const maxs = new Int16Array([NO_DATA_SENTINEL]);
    const key = envelopeCacheKey(stationData, level, tileIndex);
    service.envelopeCache.set(key, { mins, maxs });

    const range = getTileTimeRange(level, tileIndex);
    const result = service.query(viewportParams({
      startTime: DateTime.fromSeconds(range.start, { zone: "utc" }),
      endTime: DateTime.fromSeconds(range.start + LEVEL_SPACINGS[level], { zone: "utc" }),
      pixelWidth: 1,
    }));

    expect(result.data[1][0]).toBeNull();
    expect(result.data[2][0]).toBeNull();
  });
});

describe("SeismicQueryService loadViewport", () => {
  let service: SeismicQueryService;

  beforeEach(() => {
    service = new SeismicQueryService();
    mockFetch.mockReset();
  });

  it("fetches missing envelope tiles", () => {
    const encoded = encodeEnvelopeTile(new Int16Array([100]), new Int16Array([200]));
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: () => Promise.resolve(encoded),
    });

    const level = 1;
    const range = getTileTimeRange(level, 0);
    service.loadViewport("caller1", {
      stationData,
      startTime: DateTime.fromSeconds(range.start, { zone: "utc" }),
      endTime: DateTime.fromSeconds(range.start + LEVEL_SPACINGS[level], { zone: "utc" }),
      pixelWidth: 1,
    });

    expect(service.envelopeCache.get(envelopeCacheKey(stationData, 1, 0))).toBe("loading");
    expect(mockFetch).toHaveBeenCalled();
  });

  it("does not re-fetch tiles already in cache", () => {
    const key = envelopeCacheKey(stationData, 1, 0);
    service.envelopeCache.set(key, { mins: new Int16Array([1]), maxs: new Int16Array([2]) });

    const level = 1;
    const range = getTileTimeRange(level, 0);
    service.loadViewport("caller1", {
      stationData,
      startTime: DateTime.fromSeconds(range.start, { zone: "utc" }),
      endTime: DateTime.fromSeconds(range.start + LEVEL_SPACINGS[level], { zone: "utc" }),
      pixelWidth: 1,
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("getMetadata", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  function metadataLine(location: string, scale: number) {
    const fields = new Array(17).fill("");
    fields[0] = "AK"; fields[1] = "K204"; fields[2] = location; fields[3] = "HNZ";
    fields[11] = String(scale); fields[12] = "1"; fields[13] = "M/S"; fields[14] = "100";
    fields[15] = "2020-01-01T00:00:00Z"; fields[16] = "";
    return fields.join("|");
  }

  it("matches metadata by channel and location", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => [metadataLine("", 100), metadataLine("00", 200)].join("\n"),
    });
    const service = new SeismicQueryService();
    const t = new Date("2021-01-01T00:00:00Z").getTime() / 1000;

    const meta00 = await service.getMetadata({ ...stationData, location: "00" }, t);
    expect(meta00?.scale).toBe(200);

    const metaBlank = await service.getMetadata(stationData, t);
    expect(metaBlank?.scale).toBe(100);

    const metaMissing = await service.getMetadata({ ...stationData, location: "10" }, t);
    expect(metaMissing).toBeUndefined();
  });
});
