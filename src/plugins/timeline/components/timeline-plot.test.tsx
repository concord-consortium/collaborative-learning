// Mock uPlot — canvas won't work in jsdom
jest.mock("uplot", () => {
  return jest.fn().mockImplementation(() => ({
    setData: jest.fn(),
    setSize: jest.fn(),
    destroy: jest.fn(),
  }));
});

import { act, fireEvent, render } from "@testing-library/react";
import { DateTime } from "luxon";
import React from "react";
import { ReadOnlyContext } from "../../../components/document/read-only-context";
import { TileModelContext } from "../../../components/tiles/tile-api";
import { kAnnounceDelayMs } from "../../../hooks/use-live-announcer";
import { TileModel } from "../../../models/tiles/tile-model";
import { getSharedModelManager } from "../../../models/tiles/tile-environment";
import { mockPointerEvents } from "../../../test/pointer-events";
import { SharedSeismogram } from "../../shared-seismogram/shared-seismogram";
import { kMinViewRangeSeconds, TimelineContentModel, TimelineContentModelType } from "../models/timeline-content";
import { TimelinePlot } from "./timeline-plot";

// The timeline tile needs to be registered so TileModel.create
// knows it is a supported tile type
import "../timeline-registration";

jest.mock("../../../models/tiles/tile-environment", () => ({
  ...jest.requireActual("../../../models/tiles/tile-environment"),
  getSharedModelManager: jest.fn()
}));

const mockedGetSharedModelManager = getSharedModelManager as jest.MockedFunction<typeof getSharedModelManager>;

beforeAll(mockPointerEvents);

describe("TimelinePlot", () => {
  const dataStart = DateTime.fromISO("2026-02-01T00:00:00.000Z");
  const dataEnd = DateTime.fromISO("2026-02-05T00:00:00.000Z");
  const day = (n: number) => dataStart.plus({ days: n });
  const kPlotWidth = 1000;

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
  });

  afterEach(() => {
    mockedGetSharedModelManager.mockReset();
  });

  function renderPlot(viewStart: DateTime, viewEnd: DateTime, { left = 0, readOnly = false } = {}) {
    const content = TimelineContentModel.create();
    content.setViewRange(viewStart, viewEnd);
    const model = TileModel.create({ content });
    const result = render(
      <ReadOnlyContext.Provider value={readOnly}>
        <TileModelContext.Provider value={model}>
          <TimelinePlot><div className="plot-content" /></TimelinePlot>
        </TileModelContext.Provider>
      </ReadOnlyContext.Provider>
    );
    const plot = result.container.querySelector<HTMLElement>(".timeline-plot")!;
    plot.getBoundingClientRect = () => ({
      left, right: left + kPlotWidth, width: kPlotWidth, top: 0, bottom: 100, height: 100, x: left, y: 0,
      toJSON: () => ({})
    });
    return { content: content as TimelineContentModelType, plot, ...result };
  }

  function click(plot: HTMLElement, clientX: number, shiftKey = false) {
    fireEvent.pointerDown(plot, { button: 0, clientX, shiftKey });
    fireEvent.pointerUp(plot, { button: 0, clientX, shiftKey });
  }

  function drag(plot: HTMLElement, fromX: number, toX: number) {
    fireEvent.pointerDown(plot, { button: 0, clientX: fromX });
    fireEvent.pointerMove(plot, { button: 0, clientX: (fromX + toX) / 2 });
    fireEvent.pointerMove(plot, { button: 0, clientX: toX });
    fireEvent.pointerUp(plot, { button: 0, clientX: toX });
  }

  it("renders its children", () => {
    const { container } = renderPlot(dataStart, dataEnd);
    expect(container.querySelector(".timeline-plot .plot-content")).toBeInTheDocument();
  });

  it("zooms in on a click, centered on the clicked time", () => {
    const { content, plot } = renderPlot(dataStart, dataEnd);
    click(plot, 500);
    expect(content.viewStartTime?.toISO()).toBe(day(1).toISO());
    expect(content.viewEndTime?.toISO()).toBe(day(3).toISO());
  });

  it("zooms out on a shift-click, centered on the clicked time", () => {
    const { content, plot } = renderPlot(day(2), day(3));
    click(plot, 0, true);
    expect(content.viewStartTime?.toISO()).toBe(day(1).toISO());
    expect(content.viewEndTime?.toISO()).toBe(day(3).toISO());
  });

  it("measures the clicked time from the plot's left edge", () => {
    const { content, plot } = renderPlot(dataStart, dataEnd, { left: 100 });
    click(plot, 600);
    expect(content.viewStartTime?.toISO()).toBe(day(1).toISO());
    expect(content.viewEndTime?.toISO()).toBe(day(3).toISO());
  });

  it("ignores buttons other than the primary button", () => {
    const { content, plot } = renderPlot(dataStart, dataEnd);
    fireEvent.pointerDown(plot, { button: 2, clientX: 500 });
    fireEvent.pointerUp(plot, { button: 2, clientX: 500 });
    expect(content.viewStartTime?.toISO()).toBe(dataStart.toISO());
    expect(content.viewEndTime?.toISO()).toBe(dataEnd.toISO());
  });

  it("pans on a drag, moving the view opposite to the pointer", () => {
    const { content, plot } = renderPlot(day(1), day(2));
    drag(plot, 500, 250);
    expect(content.viewStartTime?.toISO()).toBe(day(1).plus({ hours: 6 }).toISO());
    expect(content.viewEndTime?.toISO()).toBe(day(2).plus({ hours: 6 }).toISO());
  });

  it("pans by the horizontal part of a diagonal drag", () => {
    const { content, plot } = renderPlot(day(1), day(2));
    fireEvent.pointerDown(plot, { button: 0, clientX: 500, clientY: 10 });
    fireEvent.pointerMove(plot, { button: 0, clientX: 250, clientY: 90 });
    fireEvent.pointerUp(plot, { button: 0, clientX: 250, clientY: 90 });
    expect(content.viewStartTime?.toISO()).toBe(day(1).plus({ hours: 6 }).toISO());
  });

  it("saves a drag only when it ends", () => {
    const { content, plot } = renderPlot(day(1), day(2));
    fireEvent.pointerDown(plot, { button: 0, clientX: 500 });
    fireEvent.pointerMove(plot, { button: 0, clientX: 250 });
    expect(content.viewStartTime?.toISO()).toBe(day(1).plus({ hours: 6 }).toISO());
    expect(content.viewStartTimeISO).toBe(day(1).toISO());
    fireEvent.pointerUp(plot, { button: 0, clientX: 250 });
    expect(content.viewStartTimeISO).toBe(day(1).plus({ hours: 6 }).toISO());
  });

  it("ends a drag when pointer capture is lost", () => {
    const { content, plot } = renderPlot(day(1), day(2));
    fireEvent.pointerDown(plot, { button: 0, clientX: 500 });
    fireEvent.pointerMove(plot, { button: 0, clientX: 250 });
    fireEvent(plot, new PointerEvent("lostpointercapture", { bubbles: true }));
    expect(plot).not.toHaveClass("grabbing");
    expect(content.viewStartTimeISO).toBe(day(1).plus({ hours: 6 }).toISO());
    fireEvent.pointerMove(plot, { button: 0, clientX: 0 });
    expect(content.viewStartTime?.toISO()).toBe(day(1).plus({ hours: 6 }).toISO());
  });

  it("does not zoom when a drag is released", () => {
    const { content, plot } = renderPlot(day(1), day(2));
    drag(plot, 500, 750);
    expect(content.viewRangeSeconds).toBeCloseTo(24 * 3600, 3);
  });

  it("treats a press that moves only a few pixels as a click", () => {
    const { content, plot } = renderPlot(dataStart, dataEnd);
    fireEvent.pointerDown(plot, { button: 0, clientX: 500 });
    fireEvent.pointerMove(plot, { button: 0, clientX: 503 });
    fireEvent.pointerUp(plot, { button: 0, clientX: 503 });
    expect(content.viewRangeSeconds).toBeCloseTo(2 * 24 * 3600, 0);
  });

  it("treats a mostly vertical drag as a drag rather than a click", () => {
    const { content, plot } = renderPlot(day(1), day(2));
    fireEvent.pointerDown(plot, { button: 0, clientX: 500, clientY: 20 });
    fireEvent.pointerMove(plot, { button: 0, clientX: 502, clientY: 60 });
    fireEvent.pointerUp(plot, { button: 0, clientX: 502, clientY: 60 });
    expect(content.viewRangeSeconds).toBeCloseTo(24 * 3600, 3);
  });

  it("ignores a second pointer while dragging", () => {
    const { content, plot } = renderPlot(day(1), day(2));
    fireEvent.pointerDown(plot, { button: 0, clientX: 500, pointerId: 1 });
    fireEvent.pointerDown(plot, { button: 0, clientX: 100, pointerId: 2 });
    fireEvent.pointerMove(plot, { button: 0, clientX: 150, pointerId: 2 });
    expect(content.viewStartTime?.toISO()).toBe(day(1).toISO());
    fireEvent.pointerCancel(plot, { pointerId: 2 });
    fireEvent.pointerMove(plot, { button: 0, clientX: 250, pointerId: 1 });
    expect(content.viewStartTime?.toISO()).toBe(day(1).plus({ hours: 6 }).toISO());
  });

  it("ignores the release of a second pointer", () => {
    const { content, plot } = renderPlot(day(1), day(2));
    fireEvent.pointerDown(plot, { button: 0, clientX: 500, pointerId: 1 });
    fireEvent.pointerDown(plot, { button: 0, clientX: 100, pointerId: 2 });
    fireEvent.pointerUp(plot, { button: 0, clientX: 100, pointerId: 2 });
    expect(content.viewRangeSeconds).toBeCloseTo(24 * 3600, 3);
    fireEvent.pointerUp(plot, { button: 0, clientX: 500, pointerId: 1 });
    expect(content.viewRangeSeconds).toBeCloseTo(12 * 3600, 3);
  });

  it("neither zooms nor pans when read-only", () => {
    const { container, content, plot } = renderPlot(day(1), day(2), { readOnly: true });
    click(plot, 500);
    drag(plot, 500, 250);
    expect(content.viewStartTime?.toISO()).toBe(day(1).toISO());
    expect(content.viewEndTime?.toISO()).toBe(day(2).toISO());
    expect(plot).not.toHaveClass("zoom-in");
    expect(container.querySelector("[aria-live]")).toBeNull();
  });

  it("shows the zoom-in cursor, switching to zoom-out while Shift is held", () => {
    const { plot } = renderPlot(dataStart, dataEnd);
    expect(plot).toHaveClass("zoom-in");
    act(() => { fireEvent.keyDown(window, { key: "Shift", shiftKey: true }); });
    expect(plot).toHaveClass("zoom-out");
    act(() => { fireEvent.keyUp(window, { key: "Shift" }); });
    expect(plot).toHaveClass("zoom-in");
  });

  it("follows the Shift state reported by pointer moves", () => {
    const { plot } = renderPlot(dataStart, dataEnd);
    fireEvent.pointerMove(plot, { clientX: 100, shiftKey: true });
    expect(plot).toHaveClass("zoom-out");
    fireEvent.pointerMove(plot, { clientX: 100, shiftKey: false });
    expect(plot).toHaveClass("zoom-in");
  });

  it("shows the grabbing cursor while dragging", () => {
    const { plot } = renderPlot(day(1), day(2));
    fireEvent.pointerDown(plot, { button: 0, clientX: 500 });
    expect(plot).not.toHaveClass("grabbing");
    fireEvent.pointerMove(plot, { button: 0, clientX: 400 });
    expect(plot).toHaveClass("grabbing");
    fireEvent.pointerUp(plot, { button: 0, clientX: 400 });
    expect(plot).not.toHaveClass("grabbing");
  });

  it("does not show a hover time marker", () => {
    const { content, plot } = renderPlot(day(1), day(2));
    fireEvent.pointerMove(plot, { clientX: 250 });
    expect(content.hoverTime).toBeUndefined();
  });

  it("does not pin a time marker on a click", () => {
    const { content, plot } = renderPlot(dataStart, dataEnd);
    click(plot, 500);
    expect(content.pinnedTime).toBeUndefined();
  });

  describe("announcements", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    function announced(container: HTMLElement) {
      act(() => { jest.advanceTimersByTime(kAnnounceDelayMs); });
      return container.querySelector("[aria-live]")!.textContent;
    }

    const format = (time: DateTime) => time.toUTC().toLocaleString(DateTime.DATETIME_MED_WITH_SECONDS);

    it("announces zooms and pans to screen readers", () => {
      const { container, plot } = renderPlot(day(1), day(2));
      const noon = day(1).plus({ hours: 12 });
      click(plot, 500);
      expect(announced(container)).toBe(
        `Zoomed in, centered on ${format(noon)}. ` +
        `Showing ${format(day(1).plus({ hours: 6 }))} to ${format(day(1).plus({ hours: 18 }))}.`);
      click(plot, 500, true);
      expect(announced(container)).toBe(
        `Zoomed out, centered on ${format(noon)}. Showing ${format(day(1))} to ${format(day(2))}.`);
      drag(plot, 500, 250);
      expect(announced(container)).toBe(
        `Panned. Showing ${format(day(1).plus({ hours: 6 }))} to ${format(day(2).plus({ hours: 6 }))}.`);
    });

    it("doesn't claim a zoom is centered when the data edge shifted it", () => {
      const { container, plot } = renderPlot(dataStart, dataEnd);
      click(plot, 0);
      expect(announced(container)).toBe(`Zoomed in. Showing ${format(dataStart)} to ${format(day(2))}.`);
    });

    it("announces when a drag can't pan any further", () => {
      const { container, content, plot } = renderPlot(dataStart, day(1));
      drag(plot, 250, 500);
      expect(announced(container)).toMatch(/^Already at the edge of the data\./);
      expect(content.viewStartTime?.toISO()).toBe(dataStart.toISO());
    });

    it("announces a drag that doesn't pan without blaming an edge", () => {
      const { container, plot } = renderPlot(day(1), day(2));
      fireEvent.pointerDown(plot, { button: 0, clientX: 500, clientY: 10 });
      fireEvent.pointerMove(plot, { button: 0, clientX: 500, clientY: 90 });
      fireEvent.pointerUp(plot, { button: 0, clientX: 500, clientY: 90 });
      expect(announced(container)).toMatch(/^View unchanged\./);
    });

    it("announces when a shift-click can't zoom out any further", () => {
      const { container, content, plot } = renderPlot(dataStart, dataEnd);
      click(plot, 500, true);
      expect(announced(container)).toMatch(/^Already showing the full time range/);
      expect(content.viewStartTime?.toISO()).toBe(dataStart.toISO());
      expect(content.viewEndTime?.toISO()).toBe(dataEnd.toISO());
    });

    it("announces when a click at the closest zoom only re-centers", () => {
      const { container, plot } = renderPlot(day(1), day(1).plus({ seconds: kMinViewRangeSeconds }));
      click(plot, 500);
      expect(announced(container)).toMatch(/^Already at the closest zoom, centered on/);
    });

    it("clears the announcement before repeating an identical one", () => {
      const { container, plot } = renderPlot(dataStart, dataEnd);
      const status = container.querySelector("[aria-live]")!;
      click(plot, 500, true);
      const first = announced(container);
      click(plot, 500, true);
      expect(status.textContent).toBe("");
      expect(announced(container)).toBe(first);
    });
  });
});
