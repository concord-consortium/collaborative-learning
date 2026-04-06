import { DateTime } from "luxon";
import { TimelineContentModel, kMinViewRangeSeconds } from "./timeline-content";
import { getSharedModelManager } from "../../../models/tiles/tile-environment";

// Mock getSharedModelManager to return a fake shared model manager
jest.mock("../../../models/tiles/tile-environment", () => ({
  getSharedModelManager: jest.fn()
}));

const mockedGetSharedModelManager = getSharedModelManager as jest.MockedFunction<typeof getSharedModelManager>;

describe("TimelineContent", () => {
  it("is always user resizable", () => {
    const content = TimelineContentModel.create();
    expect(content.isUserResizable).toBe(true);
  });
});

describe("zoom functionality", () => {
  const dataStart = DateTime.fromISO("2026-01-30T00:00:00.000Z");
  const dataEnd = DateTime.fromISO("2026-02-06T00:00:00.000Z");
  // 7 days = 604800 seconds
  const dataRangeSeconds = 604800;

  let content: ReturnType<typeof TimelineContentModel.create>;

  beforeEach(() => {
    const mockSharedSeismogram = {
      startTime: dataStart,
      endTime: dataEnd,
      seismogram: {},
    };

    mockedGetSharedModelManager.mockReturnValue({
      isReady: true,
      getTileSharedModelsByType: () => [mockSharedSeismogram],
    } as any);

    content = TimelineContentModel.create();
  });

  afterEach(() => {
    mockedGetSharedModelManager.mockReset();
  });

  it("fitToData sets view range to shared seismogram range", () => {
    content.fitToData();
    expect(content.viewStartTime?.toISO()).toBe(dataStart.toISO());
    expect(content.viewEndTime?.toISO()).toBe(dataEnd.toISO());
  });

  it("zoom(0.5) halves the time range around center", () => {
    content.fitToData();
    content.zoom(0.5);
    const range = content.viewRangeSeconds!;
    expect(range).toBeCloseTo(dataRangeSeconds * 0.5, 0);
    // Should be centered
    const center = content.viewStartTime!.plus({ seconds: range / 2 });
    const expectedCenter = dataStart.plus({ seconds: dataRangeSeconds / 2 });
    expect(Math.abs(center.diff(expectedCenter, "seconds").seconds)).toBeLessThan(1);
  });

  it("zoom(2) doubles the time range around center", () => {
    content.fitToData();
    content.zoom(0.5); // zoom in first
    const rangeAfterZoomIn = content.viewRangeSeconds!;
    content.zoom(2); // zoom back out
    const rangeAfterZoomOut = content.viewRangeSeconds!;
    expect(rangeAfterZoomOut).toBeCloseTo(rangeAfterZoomIn * 2, 0);
  });

  it("zoom(2) clamps to shared model range", () => {
    content.fitToData();
    content.zoom(2); // already at full range, should clamp
    expect(content.viewRangeSeconds).toBeCloseTo(dataRangeSeconds, 0);
    expect(content.viewStartTime?.toISO()).toBe(dataStart.toISO());
    expect(content.viewEndTime?.toISO()).toBe(dataEnd.toISO());
  });

  it("zoom(2) shifts from edge when clamped", () => {
    // Set view near the start edge
    const nearStart = dataStart;
    const nearStartEnd = dataStart.plus({ seconds: 1000 });
    content.setViewRange(nearStart, nearStartEnd);
    // Zoom out by 2x: target range = 2000s, centered at 500s from start
    // But center - 1000 = -500 which is before dataStart, so should shift right
    content.zoom(2);
    const range = content.viewRangeSeconds!;
    expect(range).toBeCloseTo(2000, 0);
    // Should be shifted so start is at dataStart
    expect(content.viewStartTime?.toISO()).toBe(dataStart.toISO());
    expect(content.viewEndTime?.toISO()).toBe(dataStart.plus({ seconds: 2000 }).toISO());
  });

  it("zoom(2) shifts from end edge when clamped", () => {
    const nearEnd = dataEnd.minus({ seconds: 1000 });
    content.setViewRange(nearEnd, dataEnd);
    content.zoom(2);
    expect(content.viewRangeSeconds!).toBeCloseTo(2000, 0);
    expect(content.viewEndTime?.toISO()).toBe(dataEnd.toISO());
    expect(content.viewStartTime?.toISO()).toBe(dataEnd.minus({ seconds: 2000 }).toISO());
  });

  it("zoom(0.5) respects minimum view range", () => {
    // Set a very small range, just above minimum
    content.setViewRange(dataStart, dataStart.plus({ seconds: kMinViewRangeSeconds + 1 }));
    // Zoom in repeatedly
    for (let i = 0; i < 20; i++) {
      content.zoom(0.5);
    }
    expect(content.viewRangeSeconds!).toBeCloseTo(kMinViewRangeSeconds, 0);
  });

  it("canZoomIn is false at minimum range", () => {
    content.setViewRange(dataStart, dataStart.plus({ seconds: kMinViewRangeSeconds }));
    expect(content.canZoomIn).toBe(false);
  });

  it("canZoomOut is false at full range", () => {
    content.fitToData();
    expect(content.canZoomOut).toBe(false);
  });

  it("fitToData resets to full range", () => {
    content.fitToData();
    content.zoom(0.5);
    expect(content.viewRangeSeconds).not.toBeCloseTo(dataRangeSeconds, 0);
    content.fitToData();
    expect(content.viewStartTime?.toISO()).toBe(dataStart.toISO());
    expect(content.viewEndTime?.toISO()).toBe(dataEnd.toISO());
  });

  it("canFitToData is false when already at full range", () => {
    content.fitToData();
    expect(content.canFitToData).toBe(false);
  });

  it("canFitToData is true when zoomed in", () => {
    content.fitToData();
    content.zoom(0.5);
    expect(content.canFitToData).toBe(true);
  });

  it("viewStartTime and viewEndTime are undefined when not set", () => {
    expect(content.viewStartTime).toBeUndefined();
    expect(content.viewEndTime).toBeUndefined();
  });

  it("persists view range as ISO strings", () => {
    content.setViewRange(dataStart, dataEnd);
    expect(content.viewStartTimeISO).toBe(dataStart.toISO());
    expect(content.viewEndTimeISO).toBe(dataEnd.toISO());
  });

  it("setViewRange ignores call when start is later than end", () => {
    content.setViewRange(dataStart, dataEnd);
    content.setViewRange(dataEnd, dataStart);
    // View range should remain unchanged
    expect(content.viewStartTime?.toISO()).toBe(dataStart.toISO());
    expect(content.viewEndTime?.toISO()).toBe(dataEnd.toISO());
  });
});
