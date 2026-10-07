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
import { TileModelContext } from "../../../components/tiles/tile-api";
import { TileModel } from "../../../models/tiles/tile-model";
import { getSharedModelManager } from "../../../models/tiles/tile-environment";
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

  function renderPlot(viewStart: DateTime, viewEnd: DateTime) {
    const content = TimelineContentModel.create();
    content.setViewRange(viewStart, viewEnd);
    const model = TileModel.create({ content });
    const result = render(
      <TileModelContext.Provider value={model}>
        <TimelinePlot><div className="plot-content" /></TimelinePlot>
      </TileModelContext.Provider>
    );
    const plot = result.container.querySelector<HTMLElement>(".timeline-plot")!;
    plot.getBoundingClientRect = () => ({
      left: 0, right: kPlotWidth, width: kPlotWidth, top: 0, bottom: 100, height: 100, x: 0, y: 0,
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

  it("announces zooms and pans to screen readers", () => {
    const { container, plot } = renderPlot(day(1), day(2));
    const status = container.querySelector("[aria-live]")!;
    click(plot, 500);
    expect(status.textContent).toMatch(/^Zoomed in/);
    click(plot, 500, true);
    expect(status.textContent).toMatch(/^Zoomed out/);
    drag(plot, 500, 250);
    expect(status.textContent).toMatch(/^Panned/);
  });

  it("announces when a shift-click can't zoom out any further", () => {
    const { container, content, plot } = renderPlot(dataStart, dataEnd);
    const status = container.querySelector("[aria-live]")!;
    click(plot, 500, true);
    expect(status.textContent).toMatch(/^Already showing the full time range/);
    expect(content.viewStartTime?.toISO()).toBe(dataStart.toISO());
    expect(content.viewEndTime?.toISO()).toBe(dataEnd.toISO());
  });

  it("announces when a click at the closest zoom only re-centers", () => {
    const { container, plot } = renderPlot(day(1), day(1).plus({ seconds: kMinViewRangeSeconds }));
    const status = container.querySelector("[aria-live]")!;
    click(plot, 500);
    expect(status.textContent).toMatch(/^Already at the closest zoom, centered on/);
  });
});
