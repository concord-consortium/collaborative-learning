import { DateTime } from "luxon";
import { IJsonPatch, applyPatch, getSnapshot, onPatch } from "mobx-state-tree";
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

  it("exports a JSON string including persisted fields", () => {
    const content = TimelineContentModel.create({
      viewStartTimeISO: "2026-02-01T00:00:00.000Z",
      viewEndTimeISO: "2026-02-02T00:00:00.000Z",
      selectedEventIndex: 3
    });
    const json = content.exportJson();
    expect(typeof json).toBe("string");
    expect(json.length).toBeGreaterThan(0);
    expect(JSON.parse(json)).toEqual({
      type: "Timeline",
      viewStartTimeISO: "2026-02-01T00:00:00.000Z",
      viewEndTimeISO: "2026-02-02T00:00:00.000Z",
      selectedEventIndex: 3
    });
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

  it("zoom(0.5, time) centers the halved range on the given time", () => {
    content.fitToData();
    content.zoom(0.5, dataStart.plus({ days: 2 }));
    // 3.5 days centered on day 2
    expect(content.viewStartTime?.toISO()).toBe(dataStart.plus({ hours: 6 }).toISO());
    expect(content.viewEndTime?.toISO()).toBe(dataStart.plus({ days: 3, hours: 18 }).toISO());
  });

  it("zoom(2, time) centers the doubled range on the given time", () => {
    content.setViewRange(dataStart.plus({ days: 1 }), dataStart.plus({ days: 2 }));
    content.zoom(2, dataStart.plus({ days: 4 }));
    expect(content.viewStartTime?.toISO()).toBe(dataStart.plus({ days: 3 }).toISO());
    expect(content.viewEndTime?.toISO()).toBe(dataStart.plus({ days: 5 }).toISO());
  });

  it("zoom(0.5, time) near an edge keeps the view within the data", () => {
    content.fitToData();
    content.zoom(0.5, dataStart.plus({ hours: 12 }));
    expect(content.viewStartTime?.toISO()).toBe(dataStart.toISO());
    expect(content.viewEndTime?.toISO()).toBe(dataStart.plus({ days: 3, hours: 12 }).toISO());
  });

  it("zoom(0.5, time) at the minimum range re-centers on the given time", () => {
    content.setViewRange(dataStart.plus({ days: 1 }), dataStart.plus({ days: 1, seconds: kMinViewRangeSeconds }));
    content.zoom(0.5, dataStart.plus({ days: 3 }));
    expect(content.viewRangeSeconds).toBeCloseTo(kMinViewRangeSeconds, 3);
    expect(content.viewStartTime?.toISO())
      .toBe(dataStart.plus({ days: 3, seconds: -kMinViewRangeSeconds / 2 }).toISO());
  });
});

describe("zoom with data shorter than the minimum view range", () => {
  const dataStart = DateTime.fromISO("2026-01-30T00:00:00.000Z");
  const dataEnd = dataStart.plus({ seconds: kMinViewRangeSeconds / 2 });

  beforeEach(() => {
    mockedGetSharedModelManager.mockReturnValue({
      isReady: true,
      getTileSharedModelsByType: (_self: any, type: any) => {
        if (type === SharedSeismogram) return [{ station: {}, startTime: dataStart, endTime: dataEnd }];
        return [];
      },
    } as any);
  });

  afterEach(() => {
    mockedGetSharedModelManager.mockReset();
  });

  it("keeps the view within the data", () => {
    const content = TimelineContentModel.create();
    content.fitToData();
    content.zoom(0.5, dataStart.plus({ milliseconds: 250 }));
    expect(content.viewStartTime?.toISO()).toBe(dataStart.toISO());
    expect(content.viewEndTime?.toISO()).toBe(dataEnd.toISO());
  });
});

describe("pan functionality", () => {
  const dataStart = DateTime.fromISO("2026-01-30T00:00:00.000Z");
  const dataEnd = DateTime.fromISO("2026-02-06T00:00:00.000Z");

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

  it("panBy shifts the view by the given number of seconds", () => {
    content.setViewRange(dataStart.plus({ days: 2 }), dataStart.plus({ days: 3 }));
    content.panBy(-3600);
    expect(content.viewStartTime?.toISO()).toBe(dataStart.plus({ days: 2, hours: -1 }).toISO());
    expect(content.viewEndTime?.toISO()).toBe(dataStart.plus({ days: 3, hours: -1 }).toISO());
  });

  it("panBy stops at the start of the data without shrinking the view", () => {
    content.setViewRange(dataStart.plus({ hours: 1 }), dataStart.plus({ days: 1, hours: 1 }));
    content.panBy(-5 * 3600);
    expect(content.viewStartTime?.toISO()).toBe(dataStart.toISO());
    expect(content.viewEndTime?.toISO()).toBe(dataStart.plus({ days: 1 }).toISO());
  });

  it("panBy stops at the end of the data without shrinking the view", () => {
    content.setViewRange(dataEnd.minus({ days: 1, hours: 1 }), dataEnd.minus({ hours: 1 }));
    content.panBy(5 * 3600);
    expect(content.viewStartTime?.toISO()).toBe(dataEnd.minus({ days: 1 }).toISO());
    expect(content.viewEndTime?.toISO()).toBe(dataEnd.toISO());
  });

  it("panLeft moves the view left by a quarter of its range", () => {
    content.setViewRange(dataStart.plus({ days: 2 }), dataStart.plus({ days: 3 }));
    content.panLeft();
    expect(content.viewStartTime?.toISO()).toBe(dataStart.plus({ days: 1, hours: 18 }).toISO());
    expect(content.viewEndTime?.toISO()).toBe(dataStart.plus({ days: 2, hours: 18 }).toISO());
  });

  it("panRight moves the view right by a quarter of its range", () => {
    content.setViewRange(dataStart.plus({ days: 2 }), dataStart.plus({ days: 3 }));
    content.panRight();
    expect(content.viewStartTime?.toISO()).toBe(dataStart.plus({ days: 2, hours: 6 }).toISO());
    expect(content.viewEndTime?.toISO()).toBe(dataStart.plus({ days: 3, hours: 6 }).toISO());
  });

  it("canPanLeft and canPanRight are false when there is no view", () => {
    expect(content.canPanLeft).toBe(false);
    expect(content.canPanRight).toBe(false);
  });

  it("canPanLeft and canPanRight are false at full range", () => {
    content.fitToData();
    expect(content.canPanLeft).toBe(false);
    expect(content.canPanRight).toBe(false);
  });

  it("canPanLeft is false at the start of the data and canPanRight is true", () => {
    content.setViewRange(dataStart, dataStart.plus({ days: 1 }));
    expect(content.canPanLeft).toBe(false);
    expect(content.canPanRight).toBe(true);
  });

  it("canPanRight is false at the end of the data and canPanLeft is true", () => {
    content.setViewRange(dataEnd.minus({ days: 1 }), dataEnd);
    expect(content.canPanLeft).toBe(true);
    expect(content.canPanRight).toBe(false);
  });

  it("canPanLeft and canPanRight are false once panning reaches each edge", () => {
    content.setViewRange(dataStart.plus({ days: 2 }), dataStart.plus({ days: 3 }));
    content.panBy(-10 * 24 * 3600);
    expect(content.canPanLeft).toBe(false);
    content.panBy(10 * 24 * 3600);
    expect(content.canPanRight).toBe(false);
  });
});

describe("view preview", () => {
  const dataStart = DateTime.fromISO("2026-01-30T00:00:00.000Z");
  const dataEnd = DateTime.fromISO("2026-02-06T00:00:00.000Z");
  const day = (n: number) => dataStart.plus({ days: n });

  let content: ReturnType<typeof TimelineContentModel.create>;
  let patches: IJsonPatch[];

  beforeEach(() => {
    mockedGetSharedModelManager.mockReturnValue({
      isReady: true,
      getTileSharedModelsByType: (_self: any, type: any) =>
        type === SharedSeismogram ? [{ startTime: dataStart, endTime: dataEnd }] : [],
    } as any);
    content = TimelineContentModel.create();
    content.setViewRange(day(2), day(3));
    patches = [];
    onPatch(content, patch => patches.push(patch));
  });

  afterEach(() => {
    mockedGetSharedModelManager.mockReset();
  });

  it("shows view changes without saving them until the preview ends", () => {
    content.beginViewPreview();
    content.panBy(3600);
    content.panBy(3600);
    expect(content.viewStartTime?.toISO()).toBe(day(2).plus({ hours: 2 }).toISO());
    expect(content.viewStartTimeISO).toBe(day(2).toISO());
    expect(patches).toEqual([]);

    content.endViewPreview();
    expect(content.viewStartTimeISO).toBe(day(2).plus({ hours: 2 }).toISO());
    expect(content.viewEndTimeISO).toBe(day(3).plus({ hours: 2 }).toISO());
    expect(content.viewStartTime?.toISO()).toBe(day(2).plus({ hours: 2 }).toISO());
    expect(patches).toHaveLength(2);
  });

  it("saves nothing when a preview ends without a change", () => {
    content.beginViewPreview();
    content.panBy(3600);
    content.panBy(-3600);
    content.endViewPreview();
    expect(patches).toEqual([]);
  });

  it("saves overlapping previews together when the last one ends", () => {
    content.beginViewPreview();
    content.panBy(3600);
    content.beginViewPreview();
    expect(content.viewStartTime?.toISO()).toBe(day(2).plus({ hours: 1 }).toISO());
    content.panBy(3600);
    content.endViewPreview();
    content.panBy(3600);
    expect(patches).toEqual([]);

    content.endViewPreview();
    expect(content.viewStartTimeISO).toBe(day(2).plus({ hours: 3 }).toISO());
    expect(patches).toHaveLength(2);
  });

  it("ignores an end without a matching begin, and warns about it outside production", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => null);
    content.endViewPreview();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("endViewPreview"));
    warn.mockRestore();
    content.beginViewPreview();
    content.panBy(3600);
    expect(patches).toEqual([]);
    content.endViewPreview();
    expect(patches).toHaveLength(2);
  });

  it("discards the preview when the saved view changes before it ends", () => {
    content.beginViewPreview();
    content.panBy(3600);
    // e.g. an undo while dragging
    applyPatch(content, { op: "replace", path: "/viewStartTimeISO", value: day(1).toISO() });
    applyPatch(content, { op: "replace", path: "/viewEndTimeISO", value: day(2).toISO() });
    patches = [];

    content.endViewPreview();
    expect(patches).toEqual([]);
    expect(content.viewStartTime?.toISO()).toBe(day(1).toISO());
    expect(content.viewEndTime?.toISO()).toBe(day(2).toISO());
  });

  it("discards overlapping previews when the saved view changes before the last one ends", () => {
    content.beginViewPreview();
    content.panBy(3600);
    content.beginViewPreview();
    applyPatch(content, { op: "replace", path: "/viewStartTimeISO", value: day(1).toISO() });
    applyPatch(content, { op: "replace", path: "/viewEndTimeISO", value: day(2).toISO() });
    patches = [];
    content.endViewPreview();
    content.panBy(3600);

    content.endViewPreview();
    expect(patches).toEqual([]);
    expect(content.viewStartTime?.toISO()).toBe(day(1).toISO());
    expect(content.viewEndTime?.toISO()).toBe(day(2).toISO());
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

  it("selectedEventIndex defaults to 0", () => {
    expect(content.selectedEventIndex).toBe(0);
  });

  it("selectedEventLabel shows 'Event' when no events", () => {
    expect(content.selectedEventLabel).toBe("Event");
  });

  it("selectedEventLabel shows 'Event 1' when events exist", () => {
    mockSharedDataSet = createEventsDataSet([
      { windowStart: "2026-01-31T00:00:00.000Z", windowEnd: "2026-01-31T01:00:00.000Z", eventType: "Earthquake" },
    ]);
    expect(content.selectedEventLabel).toBe("Event 1");
  });

  it("canSelectPrev is false when at first event", () => {
    mockSharedDataSet = createEventsDataSet([
      { windowStart: "2026-01-31T00:00:00.000Z", windowEnd: "2026-01-31T01:00:00.000Z", eventType: "Earthquake" },
    ]);
    expect(content.canSelectPrev).toBe(false);
  });

  it("canSelectNext is true when more events exist", () => {
    mockSharedDataSet = createEventsDataSet([
      { windowStart: "2026-01-31T00:00:00.000Z", windowEnd: "2026-01-31T01:00:00.000Z", eventType: "Earthquake" },
      { windowStart: "2026-02-01T00:00:00.000Z", windowEnd: "2026-02-01T01:00:00.000Z", eventType: "Noise" },
    ]);
    expect(content.canSelectNext).toBe(true);
  });

  it("selectNextEvent increments selectedEventIndex", () => {
    mockSharedDataSet = createEventsDataSet([
      { windowStart: "2026-01-31T00:00:00.000Z", windowEnd: "2026-01-31T01:00:00.000Z", eventType: "Earthquake" },
      { windowStart: "2026-02-01T00:00:00.000Z", windowEnd: "2026-02-01T01:00:00.000Z", eventType: "Noise" },
    ]);
    content.fitToData();
    content.selectNextEvent();
    expect(content.selectedEventIndex).toBe(1);
    expect(content.selectedEventLabel).toBe("Event 2");
  });

  it("selectPrevEvent decrements selectedEventIndex", () => {
    mockSharedDataSet = createEventsDataSet([
      { windowStart: "2026-01-31T00:00:00.000Z", windowEnd: "2026-01-31T01:00:00.000Z", eventType: "Earthquake" },
      { windowStart: "2026-02-01T00:00:00.000Z", windowEnd: "2026-02-01T01:00:00.000Z", eventType: "Noise" },
    ]);
    content.fitToData();
    content.selectNextEvent();
    content.selectPrevEvent();
    expect(content.selectedEventIndex).toBe(0);
  });

  it("selectEvent adjusts view to show event with 25% padding", () => {
    mockSharedDataSet = createEventsDataSet([
      { windowStart: "2026-02-01T00:00:00.000Z", windowEnd: "2026-02-01T01:00:00.000Z", eventType: "Earthquake" },
    ]);
    content.fitToData();
    content.selectEvent(0);
    // Event is 1 hour = 3600 seconds. Padding = 900 seconds on each side.
    // View should be 3600 + 900 + 900 = 5400 seconds
    expect(content.viewRangeSeconds).toBeCloseTo(5400, 0);
  });

  it("selectNextEvent adjusts view to show selected event", () => {
    mockSharedDataSet = createEventsDataSet([
      { windowStart: "2026-01-31T00:00:00.000Z", windowEnd: "2026-01-31T01:00:00.000Z", eventType: "Earthquake" },
      { windowStart: "2026-02-01T00:00:00.000Z", windowEnd: "2026-02-01T01:00:00.000Z", eventType: "Noise" },
    ]);
    content.fitToData();
    content.selectNextEvent();
    // Should adjust view to second event with padding
    const event = content.events[1];
    const duration = event.windowEnd.diff(event.windowStart, "seconds").seconds;
    const padding = duration * 0.25;
    expect(content.viewRangeSeconds).toBeCloseTo(duration + padding * 2, 0);
  });

  it("selectEvent clamps view to data bounds", () => {
    mockSharedDataSet = createEventsDataSet([
      // Event near the very start of data
      { windowStart: "2026-01-30T00:00:00.000Z", windowEnd: "2026-01-30T00:10:00.000Z", eventType: "Earthquake" },
    ]);
    content.fitToData();
    content.selectEvent(0);
    // Padding would push viewStart before dataStart — should clamp
    expect(content.viewStartTime!.toMillis()).toBeGreaterThanOrEqual(dataStart.toMillis());
  });

  it("selectEvent clamps index to valid range", () => {
    mockSharedDataSet = createEventsDataSet([
      { windowStart: "2026-01-31T00:00:00.000Z", windowEnd: "2026-01-31T01:00:00.000Z", eventType: "Earthquake" },
    ]);
    content.selectEvent(5);
    expect(content.selectedEventIndex).toBe(0);
    content.selectEvent(-1);
    expect(content.selectedEventIndex).toBe(0);
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

describe("time markers", () => {
  const viewStart = DateTime.fromISO("2026-02-01T00:00:00.000Z");
  const viewEnd = DateTime.fromISO("2026-02-02T00:00:00.000Z");

  it("hoverTime and markerTime default to undefined", () => {
    const content = TimelineContentModel.create();
    expect(content.hoverTime).toBeUndefined();
    expect(content.markerTime).toBeUndefined();
  });

  it("setHoverTime and clearHoverTime update hoverTime", () => {
    const content = TimelineContentModel.create();
    const time = DateTime.fromISO("2026-02-01T12:00:00.000Z");
    content.setHoverTime(time);
    expect(content.hoverTime?.toISO()).toBe(time.toISO());
    content.clearHoverTime();
    expect(content.hoverTime).toBeUndefined();
  });

  it("setMarkerTime and clearMarkerTime update markerTime", () => {
    const content = TimelineContentModel.create();
    const time = DateTime.fromISO("2026-02-01T12:00:00.000Z");
    content.setMarkerTime(time);
    expect(content.markerTime?.toISO()).toBe(time.toISO());
    content.clearMarkerTime();
    expect(content.markerTime).toBeUndefined();
  });

  it("timeToViewPct returns undefined when there is no view range", () => {
    const content = TimelineContentModel.create();
    expect(content.timeToViewPct(viewStart)).toBeUndefined();
  });

  it("timeToViewPct maps times within the view range to 0-100", () => {
    const content = TimelineContentModel.create();
    content.setViewRange(viewStart, viewEnd);
    expect(content.timeToViewPct(viewStart)).toBe(0);
    expect(content.timeToViewPct(viewEnd)).toBe(100);
    expect(content.timeToViewPct(viewStart.plus({ hours: 6 }))).toBe(25);
  });

  it("timeToViewPct maps times outside the view range to <0 or >100", () => {
    const content = TimelineContentModel.create();
    content.setViewRange(viewStart, viewEnd);
    expect(content.timeToViewPct(viewStart.minus({ hours: 6 }))).toBe(-25);
    expect(content.timeToViewPct(viewEnd.plus({ hours: 12 }))).toBe(150);
  });
});

describe("marker placement mode", () => {
  it("starts off and toggles on", () => {
    const content = TimelineContentModel.create({});
    expect(content.isPlacingMarker).toBe(false);

    content.startPlacingMarker();
    expect(content.isPlacingMarker).toBe(true);

    content.stopPlacingMarker();
    expect(content.isPlacingMarker).toBe(false);
  });

  // A half-finished placement is not something to reload into.
  it("is not saved in the document", () => {
    const content = TimelineContentModel.create({});
    content.startPlacingMarker();

    expect(JSON.parse(content.exportJson())).not.toHaveProperty("isPlacingMarker");
  });

  // Placing is one gesture, not a mode the student then has to turn off.
  it("stops placing once a marker is set", () => {
    const content = TimelineContentModel.create({});
    content.startPlacingMarker();
    content.setMarkerTime(DateTime.fromISO("2026-02-01T12:00:00.000Z"));

    expect(content.isPlacingMarker).toBe(false);
  });

  it("drops the hover preview when the mode ends", () => {
    const content = TimelineContentModel.create({});
    content.startPlacingMarker();
    content.setHoverTime(DateTime.fromISO("2026-02-01T12:00:00.000Z"));

    content.stopPlacingMarker();
    expect(content.hoverTime).toBeUndefined();
  });
});

describe("marker persistence", () => {
  const markerISO = "2026-02-01T12:00:00.000Z";

  it("round-trips the marker through a snapshot", () => {
    const content = TimelineContentModel.create({});
    content.setMarkerTime(DateTime.fromISO(markerISO, { zone: "utc" }));

    const reloaded = TimelineContentModel.create(getSnapshot(content));
    expect(reloaded.markerTime?.toISO()).toBe(content.markerTime?.toISO());
  });

  // The inverse of the assertion it replaces: the marker used to be a transient pin and was
  // deliberately kept out of the exported document. It is now the student's own work.
  it("includes the marker in the exported document", () => {
    const content = TimelineContentModel.create({});
    content.setMarkerTime(DateTime.fromISO(markerISO, { zone: "utc" }));

    expect(JSON.parse(content.exportJson())).toHaveProperty("markerTimeISO", markerISO);
  });

  it("clears the marker out of the exported document", () => {
    const content = TimelineContentModel.create({});
    content.setMarkerTime(DateTime.fromISO(markerISO, { zone: "utc" }));
    content.clearMarkerTime();

    expect(JSON.parse(content.exportJson())).not.toHaveProperty("markerTimeISO");
  });
});
