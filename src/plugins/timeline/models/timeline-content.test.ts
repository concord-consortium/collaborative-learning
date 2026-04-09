import { DateTime } from "luxon";
import { TimelineContentModel, kMinViewRangeSeconds } from "./timeline-content";
import { getSharedModelManager } from "../../../models/tiles/tile-environment";
import { SharedDataSet } from "../../../models/shared/shared-data-set";
import { SharedSeismogram } from "../../shared-seismogram/shared-seismogram";
import { DataSet, addAttributeToDataSet, addCasesToDataSet } from "../../../models/data/data-set";

// Mock getSharedModelManager to return a fake shared model manager
jest.mock("../../../models/tiles/tile-environment", () => ({
  getSharedModelManager: jest.fn()
}));

const mockedGetSharedModelManager = getSharedModelManager as jest.MockedFunction<typeof getSharedModelManager>;

// Helper to create a SharedDataSet with events
function createEventsDataSet(events: Array<{ windowStart: string; windowEnd: string; eventType: string }>) {
  const dataSet = DataSet.create();
  addAttributeToDataSet(dataSet, { name: "windowStart" });
  addAttributeToDataSet(dataSet, { name: "windowEnd" });
  addAttributeToDataSet(dataSet, { name: "eventType" });
  addAttributeToDataSet(dataSet, { name: "confidence" });
  addCasesToDataSet(dataSet, events.map(e => ({ ...e, confidence: "0.9" })));
  return SharedDataSet.create({ dataSet });
}

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
      station: { network: "AK", station: "K204", location: "", channel: "HNZ" },
      startTime: dataStart,
      endTime: dataEnd,
    };

    mockedGetSharedModelManager.mockReturnValue({
      isReady: true,
      getTileSharedModelsByType: (_self: any, type: any) => {
        if (type === SharedSeismogram) return [mockSharedSeismogram];
        return [];
      },
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

describe("event views", () => {
  const dataStart = DateTime.fromISO("2026-01-30T00:00:00.000Z");
  const dataEnd = DateTime.fromISO("2026-02-06T00:00:00.000Z");

  let content: ReturnType<typeof TimelineContentModel.create>;
  let mockSharedDataSet: any;

  beforeEach(() => {
    const mockSharedSeismogram = {
      station: { network: "AK", station: "K204", location: "", channel: "HNZ" },
      startTime: dataStart,
      endTime: dataEnd,
    };
    mockSharedDataSet = undefined;

    mockedGetSharedModelManager.mockReturnValue({
      isReady: true,
      getTileSharedModelsByType: (_self: any, type: any) => {
        if (type === SharedSeismogram) return [mockSharedSeismogram];
        if (type === SharedDataSet) return mockSharedDataSet ? [mockSharedDataSet] : [];
        return [];
      },
    } as any);

    content = TimelineContentModel.create();
  });

  afterEach(() => {
    mockedGetSharedModelManager.mockReset();
  });

  it("returns empty events when no shared dataset", () => {
    expect(content.events).toEqual([]);
  });

  it("parses events from shared dataset sorted by windowStart", () => {
    mockSharedDataSet = createEventsDataSet([
      { windowStart: "2026-01-31T00:00:00.000Z", windowEnd: "2026-01-31T01:00:00.000Z", eventType: "Earthquake" },
      { windowStart: "2026-01-30T12:00:00.000Z", windowEnd: "2026-01-30T13:00:00.000Z", eventType: "Noise" },
    ]);
    const events = content.events;
    expect(events).toHaveLength(2);
    // Should be sorted by windowStart
    expect(events[0].eventType).toBe("Noise");
    expect(events[1].eventType).toBe("Earthquake");
  });

  it("assigns color words by order of first appearance in dataset", () => {
    mockSharedDataSet = createEventsDataSet([
      { windowStart: "2026-01-30T12:00:00.000Z", windowEnd: "2026-01-30T13:00:00.000Z", eventType: "Earthquake" },
      { windowStart: "2026-01-31T00:00:00.000Z", windowEnd: "2026-01-31T01:00:00.000Z", eventType: "Noise" },
      { windowStart: "2026-02-01T00:00:00.000Z", windowEnd: "2026-02-01T01:00:00.000Z", eventType: "Earthquake" },
    ]);
    const colors = content.eventTypeColorWords;
    expect(colors.get("Earthquake")).toBe("blue");
    expect(colors.get("Noise")).toBe("orange");
  });

  it("returns visible events that overlap the view window", () => {
    mockSharedDataSet = createEventsDataSet([
      { windowStart: "2026-01-30T06:00:00.000Z", windowEnd: "2026-01-30T07:00:00.000Z", eventType: "Earthquake" },
      { windowStart: "2026-02-01T23:00:00.000Z", windowEnd: "2026-02-02T01:00:00.000Z", eventType: "Noise" },
      { windowStart: "2026-02-03T00:00:00.000Z", windowEnd: "2026-02-03T01:00:00.000Z", eventType: "Earthquake" },
      { windowStart: "2026-02-03T23:00:00.000Z", windowEnd: "2026-02-04T01:00:00.000Z", eventType: "Noise" },
      { windowStart: "2026-02-05T00:00:00.000Z", windowEnd: "2026-02-05T01:00:00.000Z", eventType: "Earthquake" },
    ]);
    // Set view to middle of data range
    content.setViewRange(
      DateTime.fromISO("2026-02-02T00:00:00.000Z"),
      DateTime.fromISO("2026-02-04T00:00:00.000Z")
    );
    const visible = content.visibleEvents;
    // Should include: event overlapping start edge, fully contained event, event overlapping end edge
    expect(visible).toHaveLength(3);
    expect(visible[0].windowStart.toUTC().toISO()).toBe("2026-02-01T23:00:00.000Z");
    expect(visible[1].windowStart.toUTC().toISO()).toBe("2026-02-03T00:00:00.000Z");
    expect(visible[2].windowStart.toUTC().toISO()).toBe("2026-02-03T23:00:00.000Z");
  });
});
