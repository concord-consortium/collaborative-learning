import { quantize } from "../../../../shared/seismic/envelope-codec";
import {
  AMPLITUDE_RANGES, FINEST_LEVEL, LEVEL_SPACINGS, NO_DATA_SENTINEL, POINTS_PER_TILE
} from "../../../../shared/seismic/envelope-config";
import { SECONDS_PER_DAY } from "../../../../shared/seismic/seismic-day";
import { ChannelMetadata, EnvelopeTileData, RawSegment, StationData, TimeRange }
  from "../../../../shared/seismic/seismic-types";
import { getPointIndexInTile, getTileDuration, getTileIndex, getTileIndicesForViewport }
  from "../../../../shared/seismic/tile-addressing";
import { makeFakeDownloadService } from "./seismic-coverage-test-fakes";
import { processEnvelopeCoverage } from "./seismic-envelope-processor";

describe("processEnvelopeCoverage", () => {
  const station: StationData = { network: "AK", station: "K204", location: "", channel: "HNZ" };

  // A day index divisible by 35 makes the day start an exact multiple of the L2 tile
  // duration (31500s) and of the L2 spacing (1.575s), so tile/point indices are exact.
  const day = 19950;
  const dayStart = day * SECONDS_PER_DAY;
  const oneDayRange: TimeRange = { start: dayStart, end: dayStart + SECONDS_PER_DAY };

  const H_RANGE = AMPLITUDE_RANGES.H;
  const L2_SPACING = LEVEL_SPACINGS[FINEST_LEVEL]; // 1.575s
  // At 40 Hz each L2 window holds exactly 63 samples, so window boundaries align with samples.
  const SAMPLE_RATE = 40;
  const SAMPLES_PER_WINDOW = Math.round(L2_SPACING * SAMPLE_RATE); // 63

  function makeMetadata(overrides: Partial<ChannelMetadata> = {}): ChannelMetadata[] {
    return [{
      ...station,
      startTime: "1970-01-01T00:00:00Z",
      endTime: "",
      scale: 1,
      scaleFreq: 1,
      scaleUnits: "m/s",
      sampleRate: SAMPLE_RATE,
      instrumentCode: "H",
      ...overrides,
    }];
  }

  /** A segment with one constant value per L2 window (63 samples each). */
  function constantSegment(startTime: number, windowValues: number[]): RawSegment {
    const samples = new Float64Array(windowValues.length * SAMPLES_PER_WINDOW);
    windowValues.forEach((value, w) => samples.fill(value, w * SAMPLES_PER_WINDOW, (w + 1) * SAMPLES_PER_WINDOW));
    return { startTime, sampleRate: SAMPLE_RATE, samples };
  }

  function makeOptions() {
    return {
      stationData: station,
      range: oneDayRange,
      uploadTile: jest.fn(async (level: number, tileIndex: number, tile: EnvelopeTileData) => {}),
      listTiles: jest.fn(async () => new Set<number>()),
      fetchMetadata: jest.fn(async () => makeMetadata()),
      downloadService: makeFakeDownloadService([day]),
      parseDay: jest.fn((): RawSegment[] => []),
    };
  }

  it("does nothing when the range is fully covered", async () => {
    const options = makeOptions();
    const covered = new Set(getTileIndicesForViewport(oneDayRange.start, oneDayRange.end, FINEST_LEVEL));
    options.listTiles.mockResolvedValue(covered);
    const onProgress = jest.fn();

    const result = await processEnvelopeCoverage({ ...options, onProgress });

    expect(result).toEqual({ uploadedTiles: 0, processedDays: 0, skippedDays: 0, totalDays: 0 });
    expect(options.fetchMetadata).not.toHaveBeenCalled();
    expect(options.downloadService.ensureRange).not.toHaveBeenCalled();
    expect(options.uploadTile).not.toHaveBeenCalled();
    expect(onProgress).toHaveBeenCalledWith(0, 0);
  });

  it("processes a missing day and uploads its tiles with correct contents", async () => {
    const options = makeOptions();
    // Four L2 windows at the start of the day: 0.01, spike window, 0.02, 0.02 ...
    const segA = constantSegment(dayStart, [0.01, 0.01, 0.02, 0.02]);
    segA.samples[70] = 0.05;   // in window 1 (samples 63..125)
    segA.samples[71] = -0.05;
    // ... plus one window at the start of the day's second L2 tile (31500s in).
    const l2TileDuration = getTileDuration(FINEST_LEVEL);
    const segB = constantSegment(dayStart + l2TileDuration, [0.03]);
    options.parseDay.mockReturnValue([segA, segB]);
    const onProgress = jest.fn();
    const onTileUploaded = jest.fn();

    const result = await processEnvelopeCoverage({ ...options, onProgress, onTileUploaded });

    const q001 = quantize(0.01, H_RANGE);
    const q002 = quantize(0.02, H_RANGE);
    const q003 = quantize(0.03, H_RANGE);
    const l2Tile0 = getTileIndex(dayStart, 2);
    const l1Tile = getTileIndex(dayStart, 1);
    const l0Tile = getTileIndex(dayStart, 0);

    // Every tile — both L2s plus the still-open L1/L0 — uploads with the day's forced flush.
    const uploads = options.uploadTile.mock.calls;
    expect(uploads.map(call => call.slice(0, 2)).sort()).toEqual([
      [0, l0Tile], [1, l1Tile], [2, l2Tile0], [2, l2Tile0 + 1],
    ]);

    // Quantized data round-trips into the right points of the right tiles.
    const tileData = (level: number, tileIndex: number) =>
      uploads.find(call => call[0] === level && call[1] === tileIndex)![2];
    const tile0 = tileData(2, l2Tile0);
    expect(tile0.mins.length).toBe(POINTS_PER_TILE[2]);
    expect(Array.from(tile0.mins.slice(0, 5))).toEqual([q001, -32767, q002, q002, NO_DATA_SENTINEL]);
    expect(Array.from(tile0.maxs.slice(0, 5))).toEqual([q001, 32767, q002, q002, NO_DATA_SENTINEL]);
    const tile1 = tileData(2, l2Tile0 + 1);
    expect(tile1.mins[0]).toBe(q003);
    expect(tile1.maxs[0]).toBe(q003);
    // L1 point 0 accumulates the day's first 100 L2 points; point 200 holds segB's window.
    const l1Data = tileData(1, l1Tile);
    expect(l1Data.mins[0]).toBe(-32767);
    expect(l1Data.maxs[0]).toBe(32767);
    expect(l1Data.mins[200]).toBe(q003);

    expect(onProgress).toHaveBeenNthCalledWith(1, 0, 1);
    expect(onProgress).toHaveBeenLastCalledWith(1, 1);
    expect(onTileUploaded.mock.calls).toEqual(uploads.map(call => call.slice(0, 2)));
    expect(result).toEqual({ uploadedTiles: uploads.length, processedDays: 1, skippedDays: 0, totalDays: 1 });
  });

  it("skips a day whose raw file cannot be read back", async () => {
    const options = makeOptions();
    options.downloadService.readDay.mockResolvedValue(null);
    const onProgress = jest.fn();

    const result = await processEnvelopeCoverage({ ...options, onProgress });

    expect(result).toEqual({ uploadedTiles: 0, processedDays: 0, skippedDays: 1, totalDays: 1 });
    expect(options.parseDay).not.toHaveBeenCalled();
    expect(options.uploadTile).not.toHaveBeenCalled();
    expect(onProgress).toHaveBeenLastCalledWith(1, 1);
  });

  it("processes segments in time order even when parseDay returns them out of order", async () => {
    const options = makeOptions();
    const early = constantSegment(dayStart, [0.01]);
    // Starts one sample later and overlaps the same L2 window; when segments are processed
    // in time order the later segment's point value wins (last write per point).
    const late: RawSegment = {
      startTime: dayStart + 1 / SAMPLE_RATE,
      sampleRate: SAMPLE_RATE,
      samples: new Float64Array(SAMPLES_PER_WINDOW - 1).fill(0.04),
    };
    options.parseDay.mockReturnValue([late, early]);

    await processEnvelopeCoverage(options);

    const l2Upload = options.uploadTile.mock.calls.find(call => call[0] === 2)!;
    expect(l2Upload[1]).toBe(getTileIndex(dayStart, 2));
    expect(l2Upload[2].mins[0]).toBe(quantize(0.04, H_RANGE));
  });

  it("uploads a day-boundary L2 tile once per adjacent day, leaving the merge to the uploader", async () => {
    const options = { ...makeOptions(), downloadService: makeFakeDownloadService([day, day + 1]) };
    const twoDayRange: TimeRange = { start: dayStart, end: dayStart + 2 * SECONDS_PER_DAY };
    // The L2 grid does not align with midnight, so one window straddles the day boundary.
    const midnight = dayStart + SECONDS_PER_DAY;
    const windowStart = Math.floor(midnight / L2_SPACING) * L2_SPACING;
    const day1Seg: RawSegment = {
      startTime: windowStart,
      sampleRate: SAMPLE_RATE,
      samples: new Float64Array(Math.round((midnight - windowStart) * SAMPLE_RATE)).fill(0.01),
    };
    const day2Seg: RawSegment = {
      startTime: midnight,
      sampleRate: SAMPLE_RATE,
      samples: new Float64Array(54).fill(0.02), // 1.35s: exactly the rest of the straddling window
    };
    options.parseDay.mockReturnValueOnce([day1Seg]).mockReturnValueOnce([day2Seg]);

    const result = await processEnvelopeCoverage({ ...options, range: twoDayRange });

    // Each day force-flushes its own contribution to the shared tile; the S3 uploader's
    // union-merge combines them, so twice-uploaded is the observable here.
    const boundaryTile = getTileIndex(windowStart, 2);
    const point = getPointIndexInTile(windowStart, 2, boundaryTile);
    const boundaryUploads = options.uploadTile.mock.calls.filter(
      call => call[0] === 2 && call[1] === boundaryTile);
    expect(boundaryUploads).toHaveLength(2);
    expect(boundaryUploads[0][2].mins[point]).toBe(quantize(0.01, H_RANGE));
    expect(boundaryUploads[1][2].mins[point]).toBe(quantize(0.02, H_RANGE));
    expect(result.processedDays).toBe(2);
  });

  it("stops uploading and rejects when uploadTile rejects", async () => {
    const options = makeOptions();
    // One L2 window queues three tiles (L2, L1, L0) in the day's forced flush.
    options.parseDay.mockReturnValue([constantSegment(dayStart, [0.01])]);
    options.uploadTile
      .mockImplementationOnce(async () => {})
      .mockImplementationOnce(async () => { throw new Error("upload failed"); });
    const onTileUploaded = jest.fn();

    await expect(processEnvelopeCoverage({ ...options, onTileUploaded })).rejects.toThrow("upload failed");

    expect(options.uploadTile).toHaveBeenCalledTimes(2);
    expect(onTileUploaded).toHaveBeenCalledTimes(1);
    expect(options.downloadService.cancel).toHaveBeenCalled();
  });

  it("rejects before starting a download when channel metadata is missing", async () => {
    const options = makeOptions();
    options.fetchMetadata.mockResolvedValue(makeMetadata({ channel: "BHZ" }));

    await expect(processEnvelopeCoverage(options)).rejects.toThrow("No metadata for channel HNZ");
    expect(options.downloadService.ensureRange).not.toHaveBeenCalled();
    expect(options.uploadTile).not.toHaveBeenCalled();
  });

  it("rejects before starting a download when the instrument code is unknown", async () => {
    const options = makeOptions();
    options.fetchMetadata.mockResolvedValue(makeMetadata({ instrumentCode: "X" }));

    await expect(processEnvelopeCoverage(options)).rejects.toThrow('Unknown instrument code "X"');
    expect(options.downloadService.ensureRange).not.toHaveBeenCalled();
    expect(options.uploadTile).not.toHaveBeenCalled();
  });

  it("downloads each missing span separately with exact inclusive bounds, forwarding proxy", async () => {
    const options = makeOptions();
    const threeDayRange: TimeRange = { start: dayStart, end: dayStart + 3 * SECONDS_PER_DAY };
    // Middle day fully covered; days 1 and 3 remain missing, forming two one-day spans.
    const covered = new Set(getTileIndicesForViewport(
      dayStart + SECONDS_PER_DAY, dayStart + 2 * SECONDS_PER_DAY, FINEST_LEVEL));
    options.listTiles.mockResolvedValue(covered);

    await processEnvelopeCoverage({ ...options, range: threeDayRange, proxy: true });

    const { ensureRange } = options.downloadService;
    expect(ensureRange).toHaveBeenCalledTimes(2);
    expect(ensureRange).toHaveBeenNthCalledWith(1, expect.objectContaining({
      network: "AK", station: "K204", channel: "HNZ",
      startSec: dayStart, endSec: dayStart, proxy: true,
    }));
    expect(ensureRange).toHaveBeenNthCalledWith(2, expect.objectContaining({
      startSec: dayStart + 2 * SECONDS_PER_DAY, endSec: dayStart + 2 * SECONDS_PER_DAY, proxy: true,
    }));
  });

  it("counts empty and errored days as skipped without parsing them", async () => {
    const options = { ...makeOptions(), downloadService: makeFakeDownloadService([]) };
    options.range = { start: dayStart, end: dayStart + 2 * SECONDS_PER_DAY };
    options.downloadService.emptyDays.push(day);
    options.downloadService.erroredDays.push(day + 1);
    const onProgress = jest.fn();

    const result = await processEnvelopeCoverage({ ...options, onProgress });

    expect(result).toEqual({ uploadedTiles: 0, processedDays: 0, skippedDays: 2, totalDays: 2 });
    expect(options.parseDay).not.toHaveBeenCalled();
    expect(onProgress).toHaveBeenLastCalledWith(2, 2);
  });

  it("reports each landed day through onDayDownloaded with its byte count", async () => {
    const options = makeOptions();
    options.downloadService.bytesForDay.mockReturnValue(123);
    const onDayDownloaded = jest.fn();

    await processEnvelopeCoverage({ ...options, onDayDownloaded });

    expect(onDayDownloaded.mock.calls).toEqual([[day, 123]]);
  });

  it("cancels the download service when processing completes", async () => {
    const options = makeOptions();
    await processEnvelopeCoverage(options);
    expect(options.downloadService.cancel).toHaveBeenCalled();
  });
});
