import {
  BYTES_PER_CHUNK, CHUNK_DURATION_S, COVERAGE_EPOCH, WINDOW_DURATION_S, WINDOWS_PER_CHUNK,
  getChunkEnd, getChunkIndex, getChunkStart, getWindowIndex
} from "./event-database";

describe("event-database constants", () => {
  it("has the values from the design doc", () => {
    expect(COVERAGE_EPOCH).toBe(Date.UTC(2020, 0, 1) / 1000);
    expect(CHUNK_DURATION_S).toBe(30 * 24 * 60 * 60);
    expect(WINDOW_DURATION_S).toBe(600);
    expect(WINDOWS_PER_CHUNK).toBe(4320);
    expect(BYTES_PER_CHUNK).toBe(540);
  });
});

describe("chunk and window index math", () => {
  it("maps the epoch to chunk 0, window 0", () => {
    expect(getChunkIndex(COVERAGE_EPOCH)).toBe(0);
    expect(getWindowIndex(COVERAGE_EPOCH)).toBe(0);
  });

  it("maps a time just before the second chunk to chunk 0, last window", () => {
    const t = COVERAGE_EPOCH + CHUNK_DURATION_S - 1;
    expect(getChunkIndex(t)).toBe(0);
    expect(getWindowIndex(t)).toBe(WINDOWS_PER_CHUNK - 1);
  });

  it("maps the start of the second chunk to chunk 1, window 0", () => {
    const t = COVERAGE_EPOCH + CHUNK_DURATION_S;
    expect(getChunkIndex(t)).toBe(1);
    expect(getWindowIndex(t)).toBe(0);
  });

  it("chunk start/end invert chunk index", () => {
    expect(getChunkStart(0)).toBe(COVERAGE_EPOCH);
    expect(getChunkEnd(0)).toBe(COVERAGE_EPOCH + CHUNK_DURATION_S);
    expect(getChunkStart(13)).toBe(COVERAGE_EPOCH + 13 * CHUNK_DURATION_S);
    expect(getChunkIndex(getChunkStart(7))).toBe(7);
  });

  it("a mid-2024 timestamp lands in the expected chunk", () => {
    const t = Date.UTC(2024, 2, 18) / 1000; // 2024-03-18
    const expectedChunk = Math.floor((t - COVERAGE_EPOCH) / CHUNK_DURATION_S);
    expect(getChunkIndex(t)).toBe(expectedChunk);
    expect(getChunkStart(expectedChunk)).toBeLessThanOrEqual(t);
    expect(getChunkEnd(expectedChunk)).toBeGreaterThan(t);
  });
});
