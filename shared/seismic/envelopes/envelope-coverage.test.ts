import { classifyEnvelopeDayCoverage, listEnvelopeTileIndices, missingEnvelopeDaySpans }
  from "./envelope-coverage";
import { dayRange } from "../seismic-day";
import { getTileIndicesForViewport } from "./tile-addressing";

// Helper: fake ListObjectsV2 XML response
function listXml(keys: string[], nextToken?: string) {
  const contents = keys.map(k => `<Contents><Key>${k}</Key></Contents>`).join("");
  const truncated = nextToken
    ? `<IsTruncated>true</IsTruncated><NextContinuationToken>${nextToken}</NextContinuationToken>`
    : `<IsTruncated>false</IsTruncated>`;
  return `<?xml version="1.0"?><ListBucketResult>${truncated}${contents}</ListBucketResult>`;
}
const okResponse = (text: string) => ({ ok: true, status: 200, text: async () => text });

describe("listEnvelopeTileIndices", () => {
  const station = { network: "AK", station: "K204", location: "00", channel: "HNZ" };

  it("extracts tile indices from listed keys", async () => {
    const fetchFn = jest.fn().mockResolvedValue(okResponse(listXml([
      "collaborative-learning/envelopes/v2/AK_K204/00/HNZ/L2/56123",
      "collaborative-learning/envelopes/v2/AK_K204/00/HNZ/L2/56124",
    ])));
    expect(await listEnvelopeTileIndices(station, fetchFn as any)).toEqual(new Set([56123, 56124]));
    // Request uses the station's L2 prefix
    expect(fetchFn.mock.calls[0][0]).toContain(encodeURIComponent("v2/AK_K204/00/HNZ/L2/"));
  });

  it("follows continuation tokens", async () => {
    const fetchFn = jest.fn()
      .mockResolvedValueOnce(okResponse(listXml([".../L2/1"], "tok/en+1")))
      .mockResolvedValueOnce(okResponse(listXml([".../L2/2"])));
    expect(await listEnvelopeTileIndices(station, fetchFn as any)).toEqual(new Set([1, 2]));
    expect(fetchFn.mock.calls[1][0]).toContain(`continuation-token=${encodeURIComponent("tok/en+1")}`);
  });

  it("ignores keys without a strictly numeric final segment", async () => {
    const fetchFn = jest.fn().mockResolvedValue(okResponse(listXml([
      "collaborative-learning/envelopes/v2/AK_K204/00/HNZ/L2/",       // directory marker
      "collaborative-learning/envelopes/v2/AK_K204/00/HNZ/L2/56125",
    ])));
    expect(await listEnvelopeTileIndices(station, fetchFn as any)).toEqual(new Set([56125]));
  });

  it("throws on a non-OK response", async () => {
    const fetchFn = jest.fn().mockResolvedValue({ ok: false, status: 403, text: async () => "" });
    await expect(listEnvelopeTileIndices(station, fetchFn as any)).rejects.toThrow("403");
  });
});

describe("classifyEnvelopeDayCoverage", () => {
  // Use real tile math: day N is covered iff all L2 tiles overlapping it are present.
  const day = 20500;                       // arbitrary day index
  const { start, end } = dayRange(day);
  const dayTiles = getTileIndicesForViewport(start, end, 2);   // 3-4 indices
  const range = { start, end };

  it("classifies covered / partial / uncovered", () => {
    expect(classifyEnvelopeDayCoverage(new Set(dayTiles), range).get(day)).toBe("covered");
    expect(classifyEnvelopeDayCoverage(new Set([dayTiles[0]]), range).get(day)).toBe("partial");
    expect(classifyEnvelopeDayCoverage(new Set<number>(), range).get(day)).toBe("uncovered");
  });
});

describe("missingEnvelopeDaySpans", () => {
  it("returns contiguous runs of not-fully-covered days", () => {
    const day = 20500;
    const { start } = dayRange(day);
    const range = { start, end: start + 3 * 86400 };       // 3 days
    const middleDayTiles = getTileIndicesForViewport(...Object.values(dayRange(day + 1)) as [number, number], 2);
    // middle day fully covered -> two single-day spans
    expect(missingEnvelopeDaySpans(new Set(middleDayTiles), range))
      .toEqual([{ startDay: day, endDay: day }, { startDay: day + 2, endDay: day + 2 }]);
  });
});
