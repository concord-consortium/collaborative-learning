import {
  BYTES_PER_CHUNK, CHUNK_DURATION_S, COVERAGE_EPOCH, WINDOW_DURATION_S, WINDOWS_PER_CHUNK,
  classifyDayCoverage, coveragePath, eventDocId, eventsPath, findUncoveredRanges, getChunkEnd,
  getChunkIndex, getChunkStart, getWindowIndex, groupWindowsByChunk, isWindowCovered, modelPath,
  setWindowBits, uncoveredDaySpans
} from "./event-database";
import { SECONDS_PER_DAY } from "./seismic-day";
import { SeismicEvent } from "./seismic-model-types";
import { StationData, TimeRange } from "./seismic-types";

const stationData: StationData = { network: "AK", station: "K204", channel: "BHZ", location: "00" };
const blankLocation: StationData = { network: "AK", station: "K204", channel: "BHZ" };

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

describe("Firestore path builders", () => {
  it("builds the model container path", () => {
    expect(modelPath(stationData, "compact-v1"))
      .toBe("services/seismic/stations/AK_K204/locations/00/channels/BHZ/models/compact-v1");
  });

  it("encodes a blank location as --", () => {
    expect(modelPath(blankLocation, "compact-v1"))
      .toBe("services/seismic/stations/AK_K204/locations/--/channels/BHZ/models/compact-v1");
  });

  it("builds coverage and events paths from the model path", () => {
    expect(coveragePath(stationData, "compact-v1", 76))
      .toBe(`${modelPath(stationData, "compact-v1")}/coverage/76`);
    expect(eventsPath(stationData, "compact-v1"))
      .toBe(`${modelPath(stationData, "compact-v1")}/events`);
  });
});

describe("eventDocId", () => {
  it("combines windowStart (ms) and eventType", () => {
    const event: SeismicEvent = {
      windowStart: 1710720000000, windowEnd: 1710720060000, eventType: "earthquake", confidence: 0.9
    };
    expect(eventDocId(event)).toBe("1710720000000_earthquake");
  });
});

describe("groupWindowsByChunk", () => {
  it("groups a range within one chunk", () => {
    const range: TimeRange = { start: COVERAGE_EPOCH, end: COVERAGE_EPOCH + 3 * WINDOW_DURATION_S };
    const groups = groupWindowsByChunk(range);
    expect([...groups.keys()]).toEqual([0]);
    expect(groups.get(0)).toEqual([0, 1, 2]);
  });

  it("splits a range that crosses a chunk boundary", () => {
    const range: TimeRange = {
      start: COVERAGE_EPOCH + CHUNK_DURATION_S - WINDOW_DURATION_S,
      end: COVERAGE_EPOCH + CHUNK_DURATION_S + WINDOW_DURATION_S
    };
    const groups = groupWindowsByChunk(range);
    expect(groups.get(0)).toEqual([WINDOWS_PER_CHUNK - 1]);
    expect(groups.get(1)).toEqual([0]);
  });
});

describe("setWindowBits / isWindowCovered", () => {
  it("sets and reads bits", () => {
    const bitmap = new Uint8Array(BYTES_PER_CHUNK);
    setWindowBits(bitmap, [0, 7, 8, 4319]);
    expect(isWindowCovered(bitmap, 0)).toBe(true);
    expect(isWindowCovered(bitmap, 7)).toBe(true);
    expect(isWindowCovered(bitmap, 8)).toBe(true);
    expect(isWindowCovered(bitmap, 4319)).toBe(true);
    expect(isWindowCovered(bitmap, 1)).toBe(false);
    expect(isWindowCovered(bitmap, 4318)).toBe(false);
  });

  it("is idempotent", () => {
    const bitmap = new Uint8Array(BYTES_PER_CHUNK);
    setWindowBits(bitmap, [5]);
    const copy = new Uint8Array(bitmap);
    setWindowBits(bitmap, [5]);
    expect(bitmap).toEqual(copy);
  });
});

describe("findUncoveredRanges", () => {
  const range = (startWindows: number, endWindows: number): TimeRange => ({
    start: COVERAGE_EPOCH + startWindows * WINDOW_DURATION_S,
    end: COVERAGE_EPOCH + endWindows * WINDOW_DURATION_S
  });

  it("returns the whole range when no bitmaps exist", () => {
    expect(findUncoveredRanges(new Map(), range(0, 6))).toEqual([range(0, 6)]);
  });

  it("returns nothing when the range is fully covered", () => {
    const bitmap = new Uint8Array(BYTES_PER_CHUNK);
    setWindowBits(bitmap, [0, 1, 2, 3, 4, 5]);
    expect(findUncoveredRanges(new Map([[0, bitmap]]), range(0, 6))).toEqual([]);
  });

  it("finds an interior gap", () => {
    const bitmap = new Uint8Array(BYTES_PER_CHUNK);
    setWindowBits(bitmap, [0, 1, 4, 5]);
    expect(findUncoveredRanges(new Map([[0, bitmap]]), range(0, 6))).toEqual([range(2, 4)]);
  });

  it("finds leading and trailing gaps", () => {
    const bitmap = new Uint8Array(BYTES_PER_CHUNK);
    setWindowBits(bitmap, [2, 3]);
    expect(findUncoveredRanges(new Map([[0, bitmap]]), range(0, 6)))
      .toEqual([range(0, 2), range(4, 6)]);
  });

  it("merges a gap spanning a chunk boundary", () => {
    const bitmap0 = new Uint8Array(BYTES_PER_CHUNK);
    setWindowBits(bitmap0, [WINDOWS_PER_CHUNK - 2]); // covered except the last window
    const start = COVERAGE_EPOCH + (WINDOWS_PER_CHUNK - 2) * WINDOW_DURATION_S;
    const end = COVERAGE_EPOCH + CHUNK_DURATION_S + 2 * WINDOW_DURATION_S;
    // chunk 1 has no bitmap: gap runs from last window of chunk 0 into chunk 1
    expect(findUncoveredRanges(new Map([[0, bitmap0]]), { start, end }))
      .toEqual([{ start: COVERAGE_EPOCH + (WINDOWS_PER_CHUNK - 1) * WINDOW_DURATION_S, end }]);
  });

  it("does not consult the chunk starting exactly at a chunk-aligned exclusive end", () => {
    const requested: number[] = [];
    const bitmaps = new Map<number, Uint8Array>();
    const mapGet = bitmaps.get.bind(bitmaps);
    bitmaps.get = (chunk: number) => { requested.push(chunk); return mapGet(chunk); };

    const fullChunk: TimeRange = { start: COVERAGE_EPOCH, end: COVERAGE_EPOCH + CHUNK_DURATION_S };
    expect(findUncoveredRanges(bitmaps, fullChunk)).toEqual([fullChunk]);
    // range.end is exclusive: chunk 1 (starting at range.end) contains no in-range windows
    expect(requested).toEqual([0]);
  });
});

describe("uncoveredDaySpans", () => {
  const day0 = COVERAGE_EPOCH; // COVERAGE_EPOCH is midnight UTC, so day-aligned
  const dayIdx = day0 / SECONDS_PER_DAY;

  it("returns no spans when there are no gaps", () => {
    expect(uncoveredDaySpans([], { start: day0, end: day0 + 3 * SECONDS_PER_DAY })).toEqual([]);
  });

  it("maps a sub-day gap to its containing day", () => {
    const gaps: TimeRange[] = [{ start: day0 + 600, end: day0 + 1200 }];
    expect(uncoveredDaySpans(gaps, { start: day0, end: day0 + 3 * SECONDS_PER_DAY }))
      .toEqual([{ startDay: dayIdx, endDay: dayIdx }]);
  });

  it("merges gaps on adjacent days into one span", () => {
    const gaps: TimeRange[] = [
      { start: day0 + 600, end: day0 + 1200 },
      { start: day0 + SECONDS_PER_DAY + 600, end: day0 + SECONDS_PER_DAY + 1200 }
    ];
    expect(uncoveredDaySpans(gaps, { start: day0, end: day0 + 3 * SECONDS_PER_DAY }))
      .toEqual([{ startDay: dayIdx, endDay: dayIdx + 1 }]);
  });

  it("keeps non-adjacent days as separate spans", () => {
    const gaps: TimeRange[] = [
      { start: day0, end: day0 + 600 },
      { start: day0 + 2 * SECONDS_PER_DAY, end: day0 + 2 * SECONDS_PER_DAY + 600 }
    ];
    expect(uncoveredDaySpans(gaps, { start: day0, end: day0 + 3 * SECONDS_PER_DAY }))
      .toEqual([{ startDay: dayIdx, endDay: dayIdx }, { startDay: dayIdx + 2, endDay: dayIdx + 2 }]);
  });

  it("clamps a gap ending exactly on a day boundary to the previous day", () => {
    const gaps: TimeRange[] = [{ start: day0, end: day0 + SECONDS_PER_DAY }];
    expect(uncoveredDaySpans(gaps, { start: day0, end: day0 + 3 * SECONDS_PER_DAY }))
      .toEqual([{ startDay: dayIdx, endDay: dayIdx }]);
  });
});

describe("classifyDayCoverage", () => {
  const day0 = COVERAGE_EPOCH;
  const dayIdx = day0 / SECONDS_PER_DAY;
  const threeDays: TimeRange = { start: day0, end: day0 + 3 * SECONDS_PER_DAY };

  it("classifies all days covered when there are no gaps", () => {
    expect(classifyDayCoverage([], threeDays)).toEqual(new Map([
      [dayIdx, "covered"], [dayIdx + 1, "covered"], [dayIdx + 2, "covered"],
    ]));
  });

  it("classifies all days uncovered when one gap spans the range", () => {
    expect(classifyDayCoverage([threeDays], threeDays)).toEqual(new Map([
      [dayIdx, "uncovered"], [dayIdx + 1, "uncovered"], [dayIdx + 2, "uncovered"],
    ]));
  });

  it("classifies a day with a sub-day gap as partial", () => {
    const gaps: TimeRange[] = [{ start: day0 + 600, end: day0 + 1200 }];
    expect(classifyDayCoverage(gaps, threeDays)).toEqual(new Map([
      [dayIdx, "partial"], [dayIdx + 1, "covered"], [dayIdx + 2, "covered"],
    ]));
  });

  it("classifies a whole-day gap as uncovered", () => {
    const gaps: TimeRange[] = [{ start: day0 + SECONDS_PER_DAY, end: day0 + 2 * SECONDS_PER_DAY }];
    expect(classifyDayCoverage(gaps, threeDays)).toEqual(new Map([
      [dayIdx, "covered"], [dayIdx + 1, "uncovered"], [dayIdx + 2, "covered"],
    ]));
  });

  it("classifies a gap straddling a day boundary as partial on both days", () => {
    const gaps: TimeRange[] = [
      { start: day0 + SECONDS_PER_DAY - 600, end: day0 + SECONDS_PER_DAY + 600 },
    ];
    expect(classifyDayCoverage(gaps, threeDays)).toEqual(new Map([
      [dayIdx, "partial"], [dayIdx + 1, "partial"], [dayIdx + 2, "covered"],
    ]));
  });

  it("marks a day uncovered when a longer gap fully spans it and partial where it doesn't", () => {
    const gaps: TimeRange[] = [{ start: day0 + 600, end: day0 + 2 * SECONDS_PER_DAY }];
    expect(classifyDayCoverage(gaps, threeDays)).toEqual(new Map([
      [dayIdx, "partial"], [dayIdx + 1, "uncovered"], [dayIdx + 2, "covered"],
    ]));
  });
});
