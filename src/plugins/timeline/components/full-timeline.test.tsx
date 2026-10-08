import { act, fireEvent, render } from "@testing-library/react";
import { DateTime } from "luxon";
import React from "react";
import { ReadOnlyContext } from "../../../components/document/read-only-context";
import { TileModelContext } from "../../../components/tiles/tile-api";
import { kAnnounceDelayMs } from "../../../hooks/use-live-announcer";
import { addAttributeToDataSet, addCasesToDataSet, DataSet } from "../../../models/data/data-set";
import { SharedDataSet } from "../../../models/shared/shared-data-set";
import { TileModel } from "../../../models/tiles/tile-model";
import { getSharedModelManager } from "../../../models/tiles/tile-environment";
import { SharedSeismogram } from "../../shared-seismogram/shared-seismogram";
import { TimelineContentModel, TimelineContentModelType } from "../models/timeline-content";
import { FullTimeline } from "./full-timeline";

// The timeline tile needs to be registered so TileModel.create
// knows it is a supported tile type
import "../timeline-registration";

jest.mock("../../../models/tiles/tile-environment", () => ({
  ...jest.requireActual("../../../models/tiles/tile-environment"),
  getSharedModelManager: jest.fn()
}));

// The waveform draws on a canvas, which jsdom doesn't support
jest.mock("../../shared-seismogram/components/waveform-panel", () => ({
  WaveformPanel: () => <div className="mock-waveform" />
}));

const mockedGetSharedModelManager = getSharedModelManager as jest.MockedFunction<typeof getSharedModelManager>;

// jsdom doesn't support pointer capture or PointerEvent
beforeAll(() => {
  HTMLElement.prototype.setPointerCapture = jest.fn();
  HTMLElement.prototype.releasePointerCapture = jest.fn();
  if (typeof PointerEvent === "undefined") {
    (global as any).PointerEvent = class PointerEvent extends MouseEvent {
      pointerId: number;
      constructor(type: string, params: PointerEventInit = {}) {
        super(type, params);
        this.pointerId = params.pointerId ?? 0;
      }
    };
  }
});

describe("FullTimeline", () => {
  const dataStart = DateTime.fromISO("2026-02-01T00:00:00.000Z");
  const dataEnd = DateTime.fromISO("2026-02-05T00:00:00.000Z");
  const day = (n: number) => dataStart.plus({ hours: n * 24 });
  // 250px per day across the four days of data
  const kWidth = 1000;
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
  });

  afterEach(() => {
    mockedGetSharedModelManager.mockReset();
  });

  function mockWidth(el: HTMLElement) {
    el.getBoundingClientRect = () => ({
      left: 0, right: kWidth, width: kWidth, top: 0, bottom: 40, height: 40, x: 0, y: 0, toJSON: () => ({})
    });
  }

  function renderFullTimeline(viewStart: DateTime, viewEnd: DateTime, { readOnly = false } = {}) {
    const content = TimelineContentModel.create();
    content.setViewRange(viewStart, viewEnd);
    const model = TileModel.create({ content });
    const result = render(
      <ReadOnlyContext.Provider value={readOnly}>
        <TileModelContext.Provider value={model}>
          <FullTimeline />
        </TileModelContext.Provider>
      </ReadOnlyContext.Provider>
    );
    const strip = result.container.querySelector<HTMLElement>(".full-timeline")!;
    const track = result.container.querySelector<HTMLElement>(".dynamic-scrollbar")!;
    const thumb = result.container.querySelector<HTMLElement>(".dynamic-scrollbar-thumb")!;
    mockWidth(strip);
    mockWidth(track);
    return { content: content as TimelineContentModelType, strip, track, thumb, ...result };
  }

  function drag(el: HTMLElement, fromX: number, toX: number) {
    fireEvent.pointerDown(el, { button: 0, clientX: fromX, pointerId: 1 });
    fireEvent.pointerMove(el, { button: 0, clientX: toX, pointerId: 1 });
    fireEvent.pointerUp(el, { button: 0, clientX: toX, pointerId: 1 });
  }

  it("labels the strip", () => {
    const { strip } = renderFullTimeline(day(1), day(2));
    expect(strip).toHaveTextContent("Full Timeline");
  });

  it("shows the view as an overlay on the whole data range", () => {
    const { container } = renderFullTimeline(day(1), day(2));
    const overlay = container.querySelector<HTMLElement>(".full-timeline-overlay")!;
    expect(overlay.style.left).toBe("25%");
    expect(overlay.style.width).toBe("25%");
  });

  it("shows every event, including those outside the view, positioned on the whole data range", () => {
    const dataSet = DataSet.create();
    addAttributeToDataSet(dataSet, { name: "windowStart" });
    addAttributeToDataSet(dataSet, { name: "windowEnd" });
    addAttributeToDataSet(dataSet, { name: "eventType" });
    addCasesToDataSet(dataSet, [
      { windowStart: day(1.5).toISO()!, windowEnd: day(1.75).toISO()!, eventType: "Earthquake" },
      { windowStart: day(3).toISO()!, windowEnd: day(3.5).toISO()!, eventType: "Noise" }
    ]);
    mockSharedDataSet = SharedDataSet.create({ dataSet });

    const { container } = renderFullTimeline(day(1), day(2));
    const events = container.querySelectorAll<HTMLElement>(".full-timeline-event");
    expect(events).toHaveLength(2);
    expect(events[0]).toHaveClass("blue-event");
    expect(events[1]).toHaveClass("orange-event");
    expect(events[1].style.left).toBe("75%");
    expect(events[1].style.width).toBe("12.5%");

    // Each event's shape sits above the strip, centered on the event
    const shapes = container.querySelectorAll<HTMLElement>(".full-timeline-shape");
    expect(shapes).toHaveLength(2);
    expect(shapes[1].style.left).toBe("81.25%");
    expect(shapes[1].querySelector(".event-shape")).toHaveClass("orange-event");
  });

  it("centers the view on a press outside the overlay", () => {
    const { content, strip } = renderFullTimeline(day(1), day(2));
    drag(strip, 750, 750);
    expect(content.viewStartTime?.toISO()).toBe(day(2.5).toISO());
    expect(content.viewEndTime?.toISO()).toBe(day(3.5).toISO());
  });

  it("keeps the grabbed point of the overlay under the pointer while dragging", () => {
    const { content, strip } = renderFullTimeline(day(1), day(2));
    drag(strip, 300, 550);
    expect(content.viewStartTime?.toISO()).toBe(day(2).toISO());
    expect(content.viewEndTime?.toISO()).toBe(day(3).toISO());
  });

  it("saves a drag of the overlay only when it ends", () => {
    const { content, strip } = renderFullTimeline(day(1), day(2));
    fireEvent.pointerDown(strip, { button: 0, clientX: 300, pointerId: 1 });
    fireEvent.pointerMove(strip, { button: 0, clientX: 550, pointerId: 1 });
    expect(content.viewStartTime?.toISO()).toBe(day(2).toISO());
    expect(content.viewStartTimeISO).toBe(day(1).toISO());
    fireEvent.pointerUp(strip, { button: 0, clientX: 550, pointerId: 1 });
    expect(content.viewStartTimeISO).toBe(day(2).toISO());
  });

  it("saves a drag of the scrollbar only when it ends", () => {
    const { content, track } = renderFullTimeline(day(1), day(2));
    fireEvent.pointerDown(track, { button: 0, clientX: 300, pointerId: 1 });
    fireEvent.pointerMove(track, { button: 0, clientX: 550, pointerId: 1 });
    expect(content.viewStartTime?.toISO()).toBe(day(2).toISO());
    expect(content.viewStartTimeISO).toBe(day(1).toISO());
    fireEvent.pointerUp(track, { button: 0, clientX: 550, pointerId: 1 });
    expect(content.viewStartTimeISO).toBe(day(2).toISO());
  });

  it("neither the strip nor the scrollbar changes the view when read-only", () => {
    const { content, strip, track, thumb } = renderFullTimeline(day(1), day(2), { readOnly: true });
    drag(strip, 750, 750);
    drag(track, 750, 750);
    expect(content.viewStartTime?.toISO()).toBe(day(1).toISO());
    expect(thumb).toHaveAttribute("tabindex", "-1");
  });

  it("announces the view when a scrub ends", () => {
    jest.useFakeTimers();
    try {
      const { container, strip } = renderFullTimeline(day(1), day(2));
      drag(strip, 750, 750);
      act(() => { jest.advanceTimersByTime(kAnnounceDelayMs); });
      const format = (time: DateTime) => time.toUTC().toLocaleString(DateTime.DATETIME_MED_WITH_SECONDS);
      expect(container.querySelector("[aria-live]")!.textContent).toBe(
        `Showing ${format(day(2.5))} to ${format(day(3.5))}.`);
    } finally {
      jest.useRealTimers();
    }
  });
});
