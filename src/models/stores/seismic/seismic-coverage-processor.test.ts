import { dayRange, SECONDS_PER_DAY } from "../../../../shared/seismic/seismic-day";
import { SeismicModelRunner } from "../../../../shared/seismic/seismic-model-runner";
import { ModelMetadata } from "../../../../shared/seismic/seismic-model-types";
import { StationData, TimeRange } from "../../../../shared/seismic/seismic-types";
import { DETECTION_THRESHOLD, processUncoveredRanges } from "./seismic-coverage-processor";
import { FakeDownloadService, makeFakeDownloadService, makeFakeModelRunner } from "./seismic-coverage-test-fakes";
import { getUncoveredRanges, markCovered, writeEvents } from "./seismic-event-service";

jest.mock("./seismic-event-service", () =>
  jest.requireActual("./seismic-coverage-test-fakes").makeEventServiceMock());
jest.mock("seisplotjs", () => {
  const actual = jest.requireActual("seisplotjs");
  return {
    ...actual,
    miniseed: {
      ...actual.miniseed,
      parseDataRecords: jest.fn(() => []),
      merge: jest.fn(() => ({ segments: [] })),
    },
  };
});

describe("processUncoveredRanges", () => {
  const feb1Sec = Date.UTC(2026, 1, 1) / 1000;
  const feb1Day = feb1Sec / SECONDS_PER_DAY;
  // Three full UTC days: Feb 1–3
  const threeDayRange: TimeRange = { start: feb1Sec, end: feb1Sec + 3 * SECONDS_PER_DAY };

  const station: StationData = { network: "AK", station: "K204", location: "", channel: "HNZ" };

  const metadata: ModelMetadata = {
    $schema: "https://collaborative-learning.concord.org/schemas/seismic-model/v1.json",
    id: "compact-v1",
    architecture: "compact",
    class_names: ["Noise", "Earthquake"],
    sampling_rate: 100,
    window_duration: 60,
    instrument_types: ["H"],
    weightsUrl: "",
  };

  const makeEvent = (windowStart: number, eventType = "earthquake") => ({
    windowStart, windowEnd: windowStart + 60000, eventType, confidence: 0.9
  });

  function makeOptions(fakeService: FakeDownloadService, runner = makeFakeModelRunner()) {
    return {
      stationData: station,
      metadata,
      range: threeDayRange,
      downloadService: fakeService,
      createRunner: () => runner as unknown as SeismicModelRunner,
    };
  }

  beforeEach(() => {
    (getUncoveredRanges as jest.Mock).mockClear();
    (writeEvents as jest.Mock).mockClear();
    (markCovered as jest.Mock).mockClear();
  });

  it("passes the exact span bounds to ensureRange for a single span (inclusive endSec)", async () => {
    const fakeService = makeFakeDownloadService([feb1Day, feb1Day + 1, feb1Day + 2]);
    const runner = makeFakeModelRunner();
    const result = await processUncoveredRanges({
      ...makeOptions(fakeService, runner),
      uncovered: [threeDayRange],
    });

    expect(fakeService.ensureRange).toHaveBeenCalledTimes(1);
    expect(fakeService.ensureRange).toHaveBeenCalledWith(
      expect.objectContaining({ startSec: feb1Sec, endSec: feb1Sec + 2 * SECONDS_PER_DAY }));
    expect(runner.processChunk).toHaveBeenCalledTimes(3);
    expect(runner.processChunk).toHaveBeenCalledWith(
      expect.anything(), expect.anything(), DETECTION_THRESHOLD);
    expect(result).toEqual({ processed: 3, skipped: 0, total: 3 });
  });

  it("downloads each uncovered span separately with its own exact bounds", async () => {
    // Feb 1 and Feb 3 uncovered; Feb 2 covered
    const feb3Sec = feb1Sec + 2 * SECONDS_PER_DAY;
    const fakeService = makeFakeDownloadService([feb1Day, feb1Day + 2]);
    const runner = makeFakeModelRunner();
    const result = await processUncoveredRanges({
      ...makeOptions(fakeService, runner),
      uncovered: [
        { start: feb1Sec, end: feb1Sec + SECONDS_PER_DAY },
        { start: feb3Sec, end: feb3Sec + SECONDS_PER_DAY },
      ],
    });

    expect(fakeService.ensureRange).toHaveBeenCalledTimes(2);
    expect(fakeService.ensureRange).toHaveBeenNthCalledWith(1,
      expect.objectContaining({ startSec: feb1Sec, endSec: feb1Sec }));
    expect(fakeService.ensureRange).toHaveBeenNthCalledWith(2,
      expect.objectContaining({ startSec: feb3Sec, endSec: feb3Sec }));
    expect(runner.processChunk).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ processed: 2, skipped: 0, total: 2 });
  });

  it("persists each processed day's events before marking it covered, and forwards them", async () => {
    const fakeService = makeFakeDownloadService([feb1Day]);
    const runner = makeFakeModelRunner();
    const evt = makeEvent(Date.UTC(2026, 1, 1, 1));
    runner.processChunk.mockImplementation(async (_seismogram: any, callbacks: any) => {
      callbacks.onEvents([evt]);
      return [];
    });
    const onEvents = jest.fn();
    await processUncoveredRanges({
      ...makeOptions(fakeService, runner),
      uncovered: [{ start: feb1Sec, end: feb1Sec + SECONDS_PER_DAY }],
      onEvents,
    });

    expect(onEvents).toHaveBeenCalledWith([evt]);
    expect(writeEvents).toHaveBeenCalledTimes(1);
    expect(writeEvents).toHaveBeenCalledWith(station, "compact-v1", [evt]);
    expect(markCovered).toHaveBeenCalledTimes(1);
    expect(markCovered).toHaveBeenCalledWith(station, "compact-v1", dayRange(feb1Day));
    expect((writeEvents as jest.Mock).mock.invocationCallOrder[0])
      .toBeLessThan((markCovered as jest.Mock).mock.invocationCallOrder[0]);
  });

  it("marks empty days covered without writing events, and skips errored days entirely", async () => {
    // Feb 1 has data, Feb 2 is empty, Feb 3 errors
    const fakeService = makeFakeDownloadService([feb1Day]);
    fakeService.emptyDays.push(feb1Day + 1);
    fakeService.erroredDays.push(feb1Day + 2);
    const runner = makeFakeModelRunner();
    const result = await processUncoveredRanges({
      ...makeOptions(fakeService, runner),
      uncovered: [threeDayRange],
    });

    expect(writeEvents).not.toHaveBeenCalled();
    expect(markCovered).toHaveBeenCalledTimes(2);
    expect(markCovered).toHaveBeenCalledWith(station, "compact-v1", dayRange(feb1Day));
    expect(markCovered).toHaveBeenCalledWith(station, "compact-v1", dayRange(feb1Day + 1));
    expect(markCovered).not.toHaveBeenCalledWith(station, "compact-v1", dayRange(feb1Day + 2));
    expect(result).toEqual({ processed: 1, skipped: 2, total: 3 });
  });

  it("never calls getUncoveredRanges when uncovered ranges are provided", async () => {
    const fakeService = makeFakeDownloadService([feb1Day]);
    await processUncoveredRanges({
      ...makeOptions(fakeService),
      uncovered: [{ start: feb1Sec, end: feb1Sec + SECONDS_PER_DAY }],
    });

    expect(getUncoveredRanges).not.toHaveBeenCalled();
  });

  it("fetches uncovered ranges itself when none are provided", async () => {
    (getUncoveredRanges as jest.Mock).mockResolvedValueOnce(
      [{ start: feb1Sec, end: feb1Sec + SECONDS_PER_DAY }]);
    const fakeService = makeFakeDownloadService([feb1Day]);
    const runner = makeFakeModelRunner();
    const result = await processUncoveredRanges(makeOptions(fakeService, runner));

    expect(getUncoveredRanges).toHaveBeenCalledTimes(1);
    expect(getUncoveredRanges).toHaveBeenCalledWith(station, "compact-v1", threeDayRange);
    expect(result).toEqual({ processed: 1, skipped: 0, total: 1 });
  });

  it("rejects when fetching uncovered ranges fails and none were provided", async () => {
    (getUncoveredRanges as jest.Mock).mockRejectedValueOnce(new Error("offline"));
    const fakeService = makeFakeDownloadService([feb1Day]);

    await expect(processUncoveredRanges(makeOptions(fakeService))).rejects.toThrow("offline");
    expect(fakeService.ensureRange).not.toHaveBeenCalled();
  });

  it("reports progress through onProgress, ending at (total, total)", async () => {
    // Two processed days and one empty day → total 3
    const fakeService = makeFakeDownloadService([feb1Day, feb1Day + 1]);
    fakeService.emptyDays.push(feb1Day + 2);
    const onProgress = jest.fn();
    const result = await processUncoveredRanges({
      ...makeOptions(fakeService),
      uncovered: [threeDayRange],
      onProgress,
    });

    expect(onProgress).toHaveBeenCalledWith(0, 3);
    expect(onProgress).toHaveBeenLastCalledWith(3, 3);
    expect(result).toEqual({ processed: 2, skipped: 1, total: 3 });
  });

  it("disposes the runner on success", async () => {
    const fakeService = makeFakeDownloadService([feb1Day]);
    const runner = makeFakeModelRunner();
    await processUncoveredRanges({
      ...makeOptions(fakeService, runner),
      uncovered: [{ start: feb1Sec, end: feb1Sec + SECONDS_PER_DAY }],
    });

    expect(runner.loadModel).toHaveBeenCalledWith(metadata);
    expect(runner.dispose).toHaveBeenCalledTimes(1);
  });

  it("cancels the download service when processChunk throws mid-span", async () => {
    const fakeService = makeFakeDownloadService([feb1Day]);
    const runner = makeFakeModelRunner();
    runner.processChunk.mockRejectedValueOnce(new Error("boom"));

    await expect(processUncoveredRanges({
      ...makeOptions(fakeService, runner),
      uncovered: [{ start: feb1Sec, end: feb1Sec + SECONDS_PER_DAY }],
    })).rejects.toThrow("boom");
    expect(fakeService.cancel).toHaveBeenCalled();
  });

  it("returns without creating a runner when there are no uncovered spans", async () => {
    const fakeService = makeFakeDownloadService([]);
    const createRunner = jest.fn();
    const onProgress = jest.fn();
    const result = await processUncoveredRanges({
      ...makeOptions(fakeService),
      uncovered: [],
      createRunner,
      onProgress,
    });

    expect(createRunner).not.toHaveBeenCalled();
    expect(fakeService.ensureRange).not.toHaveBeenCalled();
    expect(onProgress).toHaveBeenCalledWith(0, 0);
    expect(result).toEqual({ processed: 0, skipped: 0, total: 0 });
  });

  it("disposes the runner and propagates the error when processChunk throws", async () => {
    const fakeService = makeFakeDownloadService([feb1Day]);
    const runner = makeFakeModelRunner();
    runner.processChunk.mockRejectedValueOnce(new Error("boom"));

    await expect(processUncoveredRanges({
      ...makeOptions(fakeService, runner),
      uncovered: [{ start: feb1Sec, end: feb1Sec + SECONDS_PER_DAY }],
    })).rejects.toThrow("boom");
    expect(runner.dispose).toHaveBeenCalledTimes(1);
  });
});
