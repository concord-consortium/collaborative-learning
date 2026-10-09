import { act, fireEvent, render } from "@testing-library/react";
import { DateTime } from "luxon";
import { observable, runInAction } from "mobx";
import { IJsonPatch, onPatch } from "mobx-state-tree";
import React from "react";
import { ReadOnlyContext } from "../../../components/document/read-only-context";
import { TileModelContext } from "../../../components/tiles/tile-api";
import { kAnnounceDelayMs } from "../../../hooks/use-live-announcer";
import { addAttributeToDataSet, addCasesToDataSet, DataSet } from "../../../models/data/data-set";
import { SharedDataSet } from "../../../models/shared/shared-data-set";
import { TileModel } from "../../../models/tiles/tile-model";
import { getSharedModelManager } from "../../../models/tiles/tile-environment";
import { mockPointerEvents } from "../../../test/pointer-events";
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

beforeAll(mockPointerEvents);

describe("FullTimeline", () => {
  const dataStart = DateTime.fromISO("2026-02-01T00:00:00.000Z");
  const dataEnd = DateTime.fromISO("2026-02-05T00:00:00.000Z");
  const day = (n: number) => dataStart.plus({ hours: n * 24 });
  // 250px per day across the four days of data
  const kWidth = 1000;
  let mockSharedDataSet: any;
  let mockSharedSeismogram: { station: any, startTime?: DateTime, endTime?: DateTime };

  beforeEach(() => {
    mockSharedSeismogram = observable({
      station: { network: "AK", station: "K204", location: "", channel: "HNZ" },
      startTime: dataStart as DateTime | undefined,
      endTime: dataEnd as DateTime | undefined,
    }, { startTime: observable.ref, endTime: observable.ref });
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
    expect(overlay.style.getPropertyValue("--overlay-left")).toBe("25%");
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

    // Each event's shape is centered on the event
    const shapes = container.querySelectorAll<HTMLElement>(".full-timeline-shape");
    expect(shapes).toHaveLength(2);
    expect(shapes[1].style.left).toBe("81.25%");
    expect(shapes[1].querySelector(".event-shape")).toHaveClass("orange-event");
  });

  it("keeps events within the strip, leaving out those that don't overlap the data", () => {
    const dataSet = DataSet.create();
    addAttributeToDataSet(dataSet, { name: "windowStart" });
    addAttributeToDataSet(dataSet, { name: "windowEnd" });
    addAttributeToDataSet(dataSet, { name: "eventType" });
    addCasesToDataSet(dataSet, [
      { windowStart: day(-1).toISO()!, windowEnd: day(-0.5).toISO()!, eventType: "Earthquake" },
      { windowStart: day(-1).toISO()!, windowEnd: day(0).toISO()!, eventType: "Earthquake" },
      { windowStart: day(4).toISO()!, windowEnd: day(5).toISO()!, eventType: "Earthquake" },
      { windowStart: day(3.5).toISO()!, windowEnd: day(4.5).toISO()!, eventType: "Earthquake" }
    ]);
    mockSharedDataSet = SharedDataSet.create({ dataSet });

    const { container } = renderFullTimeline(day(1), day(2));
    const events = container.querySelectorAll<HTMLElement>(".full-timeline-event");
    expect(events).toHaveLength(1);
    expect(events[0].style.left).toBe("87.5%");
    expect(events[0].style.width).toBe("12.5%");
  });

  it("shows a placed marker", () => {
    const { content, container } = renderFullTimeline(day(1), day(2));
    act(() => { content.setMarkerTime(day(3)); });
    const marker = container.querySelector<HTMLElement>(".full-timeline-marker")!;
    expect(marker).toBeInTheDocument();
    expect(marker).not.toHaveClass("placing");
    expect(marker.style.left).toBe("75%");
  });

  // Dashed on the strip too, so the two views agree about what is settled and what is not.
  it("shows the preview dashed while placing", () => {
    const { content, container } = renderFullTimeline(day(1), day(2));
    act(() => {
      content.startPlacingMarker();
      content.setHoverTime(day(0.5));
    });
    const marker = container.querySelector<HTMLElement>(".full-timeline-marker")!;
    expect(marker).toHaveClass("placing");
    expect(marker.style.left).toBe("12.5%");
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

  it("grabs the overlay on a press on it, even beyond the view, as at its minimum width", () => {
    const { content, container } = renderFullTimeline(day(1), day(2));
    const overlay = container.querySelector<HTMLElement>(".full-timeline-overlay")!;
    // 20px past the view's end; a press on the strip there would center the view instead
    drag(overlay, 520, 620);
    expect(content.viewStartTime?.toISO()).toBe(day(1.48).toISO());
  });

  it("ends a scrub in progress, and saves it, when the data goes away", () => {
    const { content, strip } = renderFullTimeline(day(1), day(2));
    fireEvent.pointerDown(strip, { button: 0, clientX: 300, pointerId: 1 });
    fireEvent.pointerMove(strip, { button: 0, clientX: 550, pointerId: 1 });
    act(() => runInAction(() => { mockSharedSeismogram.endTime = undefined; }));
    expect(content.viewStartTimeISO).toBe(day(2).toISO());

    // Later changes are saved as they happen
    content.setViewRange(day(0), day(1));
    expect(content.viewStartTimeISO).toBe(day(0).toISO());
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

  it("saves overlapping drags of the strip and the scrollbar as a single change", () => {
    const { content, strip, track } = renderFullTimeline(day(1), day(2));
    const patches: IJsonPatch[] = [];
    onPatch(content, patch => patches.push(patch));

    fireEvent.pointerDown(strip, { button: 0, clientX: 300, pointerId: 1 });
    fireEvent.pointerMove(strip, { button: 0, clientX: 400, pointerId: 1 });
    fireEvent.pointerDown(track, { button: 0, clientX: 400, pointerId: 2 });
    fireEvent.pointerMove(track, { button: 0, clientX: 550, pointerId: 2 });
    fireEvent.pointerUp(strip, { button: 0, clientX: 400, pointerId: 1 });
    expect(patches).toEqual([]);

    fireEvent.pointerUp(track, { button: 0, clientX: 550, pointerId: 2 });
    expect(content.viewStartTimeISO).toBe(day(2).toISO());
    expect(patches.map(p => p.path)).toEqual(["/viewStartTimeISO", "/viewEndTimeISO"]);
  });

  it("saves a scrollbar key press right away", () => {
    const { content, thumb } = renderFullTimeline(day(1), day(2));
    fireEvent.keyDown(thumb, { key: "End" });
    expect(content.viewStartTimeISO).toBe(day(3).toISO());
    expect(content.viewEndTimeISO).toBe(day(4).toISO());
  });

  it("ignores a right-button press on the strip and the scrollbar", () => {
    const { content, strip, track } = renderFullTimeline(day(1), day(2));
    fireEvent.pointerDown(strip, { button: 2, clientX: 750, pointerId: 1 });
    fireEvent.pointerDown(track, { button: 2, clientX: 750, pointerId: 2 });
    expect(content.viewStartTime?.toISO()).toBe(day(1).toISO());
  });

  it("keeps the view within a record shorter than the shortest view", () => {
    mockSharedSeismogram.endTime = dataStart.plus({ seconds: 1 });
    const { content, track, thumb } = renderFullTimeline(dataStart, dataStart.plus({ seconds: 1 }));
    expect(thumb.style.width).toBe("100%");
    fireEvent.keyDown(thumb, { key: "End" });
    drag(track, 900, 900);
    expect(content.viewStartTime?.toISO()).toBe(dataStart.toISO());
    expect(content.viewEndTime?.toISO()).toBe(dataStart.plus({ seconds: 1 }).toISO());
  });

  it("labels the scrollbar and names the range in view as its value", () => {
    const { thumb } = renderFullTimeline(day(1), day(2));
    const format = (time: DateTime) => time.toUTC().toLocaleString(DateTime.DATETIME_MED_WITH_SECONDS);
    expect(thumb).toHaveAttribute("aria-label", "Timeline scroll position");
    expect(thumb).toHaveAttribute("aria-valuetext", `Showing ${format(day(1))} to ${format(day(2))}.`);
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

  it("announces overlapping scrubs once, when the last ends, if either moved the view", () => {
    jest.useFakeTimers();
    try {
      const { container, strip, track } = renderFullTimeline(day(1), day(2));
      const live = container.querySelector("[aria-live]")!;
      fireEvent.pointerDown(strip, { button: 0, clientX: 300, pointerId: 1 });
      fireEvent.pointerMove(strip, { button: 0, clientX: 550, pointerId: 1 });
      // A press within the moved view grabs it without moving it
      fireEvent.pointerDown(track, { button: 0, clientX: 600, pointerId: 2 });
      fireEvent.pointerUp(strip, { button: 0, clientX: 550, pointerId: 1 });
      act(() => { jest.advanceTimersByTime(kAnnounceDelayMs); });
      expect(live.textContent).toBe("");

      fireEvent.pointerUp(track, { button: 0, clientX: 600, pointerId: 2 });
      act(() => { jest.advanceTimersByTime(kAnnounceDelayMs); });
      const format = (time: DateTime) => time.toUTC().toLocaleString(DateTime.DATETIME_MED_WITH_SECONDS);
      expect(live.textContent).toBe(`Showing ${format(day(2))} to ${format(day(3))}.`);
    } finally {
      jest.useRealTimers();
    }
  });

  it("announces nothing when a press leaves the view where it was", () => {
    jest.useFakeTimers();
    try {
      const { container, strip } = renderFullTimeline(day(1), day(2));
      drag(strip, 300, 300);
      act(() => { jest.advanceTimersByTime(kAnnounceDelayMs); });
      expect(container.querySelector("[aria-live]")!.textContent).toBe("");
    } finally {
      jest.useRealTimers();
    }
  });
});
