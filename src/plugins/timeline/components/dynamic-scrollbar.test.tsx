import { render, fireEvent } from "@testing-library/react";
import React from "react";
import { DateTime } from "luxon";
import { DynamicScrollbar } from "./dynamic-scrollbar";

// jsdom doesn't support pointer capture or PointerEvent
beforeAll(() => {
  HTMLElement.prototype.setPointerCapture = jest.fn();
  HTMLElement.prototype.releasePointerCapture = jest.fn();
  // Polyfill PointerEvent so clientX is available in events
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

describe("DynamicScrollbar", () => {
  const dataStart = DateTime.fromISO("2025-01-01T00:00:00.000Z");
  const dataEnd = DateTime.fromISO("2025-01-01T00:01:40.000Z"); // 100 seconds

  function renderScrollbar(
    viewStart = dataStart,
    viewEnd = dataEnd,
    onViewChange = jest.fn()
  ) {
    return {
      onViewChange,
      ...render(
        <DynamicScrollbar
          dataStartTime={dataStart}
          dataEndTime={dataEnd}
          viewStartTime={viewStart}
          viewEndTime={viewEnd}
          onViewChange={onViewChange}
        />
      )
    };
  }

  it("renders track and thumb", () => {
    const { container } = renderScrollbar();
    expect(container.querySelector(".dynamic-scrollbar")).toBeInTheDocument();
    expect(container.querySelector(".dynamic-scrollbar-thumb")).toBeInTheDocument();
  });

  it("thumb fills full width when view equals data range", () => {
    const { container } = renderScrollbar();
    const thumb = container.querySelector(".dynamic-scrollbar-thumb") as HTMLElement;
    expect(thumb.style.left).toBe("0%");
    expect(thumb.style.width).toBe("100%");
  });

  it("thumb is positioned and sized correctly for partial view", () => {
    // View is the middle 50% of data range (25s to 75s)
    const viewStart = dataStart.plus({ seconds: 25 });
    const viewEnd = dataStart.plus({ seconds: 75 });
    const { container } = renderScrollbar(viewStart, viewEnd);
    const thumb = container.querySelector(".dynamic-scrollbar-thumb") as HTMLElement;
    expect(thumb.style.left).toBe("25%");
    expect(thumb.style.width).toBe("50%");
  });

  it("thumb at the end of the data range", () => {
    // View is the last 20% of data range (80s to 100s)
    const viewStart = dataStart.plus({ seconds: 80 });
    const viewEnd = dataEnd;
    const { container } = renderScrollbar(viewStart, viewEnd);
    const thumb = container.querySelector(".dynamic-scrollbar-thumb") as HTMLElement;
    expect(thumb.style.left).toBe("80%");
    expect(thumb.style.width).toBe("20%");
  });

  it("calls onViewChange when thumb is dragged", () => {
    const viewStart = dataStart.plus({ seconds: 25 });
    const viewEnd = dataStart.plus({ seconds: 75 });
    const onViewChange = jest.fn();
    const { container } = renderScrollbar(viewStart, viewEnd, onViewChange);
    const thumb = container.querySelector(".dynamic-scrollbar-thumb") as HTMLElement;
    const track = container.querySelector(".dynamic-scrollbar") as HTMLElement;

    // Mock getBoundingClientRect for the track to have a known width
    jest.spyOn(track, "getBoundingClientRect").mockReturnValue({
      width: 500, height: 17, top: 0, left: 0, right: 500, bottom: 17, x: 0, y: 0, toJSON: jest.fn()
    });

    // Pointer down at x=100
    fireEvent.pointerDown(thumb, { clientX: 100, pointerId: 1 });
    // Drag to x=200 (100px right on 500px track = 20% of 100s = 20s shift)
    fireEvent.pointerMove(thumb, { clientX: 200 });

    expect(onViewChange).toHaveBeenCalledTimes(1);
    const [newStart, newEnd] = onViewChange.mock.calls[0];
    // Original start was 25s, shifted by 20s = 45s
    expect(newStart.diff(dataStart, "seconds").seconds).toBeCloseTo(45);
    // View range stays 50s, so end = 95s
    expect(newEnd.diff(dataStart, "seconds").seconds).toBeCloseTo(95);
  });

  it("clamps drag so view does not exceed data start", () => {
    const viewStart = dataStart.plus({ seconds: 10 });
    const viewEnd = dataStart.plus({ seconds: 60 });
    const onViewChange = jest.fn();
    const { container } = renderScrollbar(viewStart, viewEnd, onViewChange);
    const thumb = container.querySelector(".dynamic-scrollbar-thumb") as HTMLElement;
    const track = container.querySelector(".dynamic-scrollbar") as HTMLElement;

    jest.spyOn(track, "getBoundingClientRect").mockReturnValue({
      width: 500, height: 17, top: 0, left: 0, right: 500, bottom: 17, x: 0, y: 0, toJSON: jest.fn()
    });

    // Drag far to the left (more than the 10s offset allows)
    fireEvent.pointerDown(thumb, { clientX: 200, pointerId: 1 });
    fireEvent.pointerMove(thumb, { clientX: 0 }); // -200px = -40s, but clamped to 0

    expect(onViewChange).toHaveBeenCalledTimes(1);
    const [newStart] = onViewChange.mock.calls[0];
    expect(newStart.diff(dataStart, "seconds").seconds).toBeCloseTo(0);
  });

  it("clamps drag so view does not exceed data end", () => {
    const viewStart = dataStart.plus({ seconds: 40 });
    const viewEnd = dataStart.plus({ seconds: 90 });
    const onViewChange = jest.fn();
    const { container } = renderScrollbar(viewStart, viewEnd, onViewChange);
    const thumb = container.querySelector(".dynamic-scrollbar-thumb") as HTMLElement;
    const track = container.querySelector(".dynamic-scrollbar") as HTMLElement;

    jest.spyOn(track, "getBoundingClientRect").mockReturnValue({
      width: 500, height: 17, top: 0, left: 0, right: 500, bottom: 17, x: 0, y: 0, toJSON: jest.fn()
    });

    // Drag far to the right (200px = +40s, start would be 80 but view is 50s so max start is 50)
    fireEvent.pointerDown(thumb, { clientX: 200, pointerId: 1 });
    fireEvent.pointerMove(thumb, { clientX: 400 });

    expect(onViewChange).toHaveBeenCalledTimes(1);
    const [newStart, newEnd] = onViewChange.mock.calls[0];
    expect(newEnd.diff(dataStart, "seconds").seconds).toBeCloseTo(100);
    expect(newStart.diff(dataStart, "seconds").seconds).toBeCloseTo(50);
  });

  it("does not call onViewChange on pointerMove without prior pointerDown", () => {
    const onViewChange = jest.fn();
    const { container } = renderScrollbar(dataStart, dataEnd, onViewChange);
    const thumb = container.querySelector(".dynamic-scrollbar-thumb") as HTMLElement;

    fireEvent.pointerMove(thumb, { clientX: 200 });
    expect(onViewChange).not.toHaveBeenCalled();
  });

  it("stops dragging on pointerUp", () => {
    const viewStart = dataStart.plus({ seconds: 25 });
    const viewEnd = dataStart.plus({ seconds: 75 });
    const onViewChange = jest.fn();
    const { container } = renderScrollbar(viewStart, viewEnd, onViewChange);
    const thumb = container.querySelector(".dynamic-scrollbar-thumb") as HTMLElement;
    const track = container.querySelector(".dynamic-scrollbar") as HTMLElement;

    jest.spyOn(track, "getBoundingClientRect").mockReturnValue({
      width: 500, height: 17, top: 0, left: 0, right: 500, bottom: 17, x: 0, y: 0, toJSON: jest.fn()
    });

    fireEvent.pointerDown(thumb, { clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(thumb, { clientX: 150 });
    expect(onViewChange).toHaveBeenCalledTimes(1);

    fireEvent.pointerUp(thumb);
    // Move after pointerUp should not trigger callback
    fireEvent.pointerMove(thumb, { clientX: 250 });
    expect(onViewChange).toHaveBeenCalledTimes(1);
  });
});
