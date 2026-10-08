import { render, fireEvent } from "@testing-library/react";
import React from "react";
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
  const totalStart = 0;
  const totalEnd = 100;

  function renderScrollbar(
    viewStart = totalStart,
    viewEnd = totalEnd,
    onViewChange = jest.fn(),
    props: Partial<React.ComponentProps<typeof DynamicScrollbar>> = {}
  ) {
    return {
      onViewChange,
      ...render(
        <DynamicScrollbar
          totalStart={totalStart}
          totalEnd={totalEnd}
          viewStart={viewStart}
          viewEnd={viewEnd}
          onViewChange={onViewChange}
          {...props}
        />
      )
    };
  }

  // Gives the track a known width: 5px per unit of the 0-100 range.
  function mockTrackWidth(container: HTMLElement) {
    const track = container.querySelector(".dynamic-scrollbar") as HTMLElement;
    jest.spyOn(track, "getBoundingClientRect").mockReturnValue({
      width: 500, height: 17, top: 0, left: 0, right: 500, bottom: 17, x: 0, y: 0, toJSON: jest.fn()
    });
    return track;
  }

  it("renders track and thumb", () => {
    const { container } = renderScrollbar();
    expect(container.querySelector(".dynamic-scrollbar")).toBeInTheDocument();
    expect(container.querySelector(".dynamic-scrollbar-thumb")).toBeInTheDocument();
  });

  it("thumb has correct ARIA attributes", () => {
    const { container } = renderScrollbar(25, 75);
    const thumb = container.querySelector(".dynamic-scrollbar-thumb") as HTMLElement;
    expect(thumb).toHaveAttribute("role", "slider");
    expect(thumb).toHaveAttribute("aria-label", "Scroll position");
    expect(thumb).toHaveAttribute("aria-valuemin", "0");
    expect(thumb).toHaveAttribute("aria-valuemax", "100");
    expect(thumb).toHaveAttribute("aria-valuenow", "50");
    expect(thumb).toHaveAttribute("tabindex", "0");
  });

  it("thumb fills full width when view equals data range", () => {
    const { container } = renderScrollbar();
    const thumb = container.querySelector(".dynamic-scrollbar-thumb") as HTMLElement;
    expect(thumb.style.getPropertyValue("--thumb-left")).toBe("0%");
    expect(thumb.style.width).toBe("100%");
  });

  it("thumb is positioned and sized correctly for partial view", () => {
    // View is the middle 50% of data range (25 to 75)
    const { container } = renderScrollbar(25, 75);
    const thumb = container.querySelector(".dynamic-scrollbar-thumb") as HTMLElement;
    expect(thumb.style.getPropertyValue("--thumb-left")).toBe("25%");
    expect(thumb.style.width).toBe("50%");
  });

  it("thumb at the end of the data range", () => {
    // View is the last 20% of data range (80 to 100)
    const { container } = renderScrollbar(80, 100);
    const thumb = container.querySelector(".dynamic-scrollbar-thumb") as HTMLElement;
    expect(thumb.style.getPropertyValue("--thumb-left")).toBe("80%");
    expect(thumb.style.width).toBe("20%");
  });

  it("calls onViewChange when thumb is dragged", () => {
    const onViewChange = jest.fn();
    const { container } = renderScrollbar(25, 75, onViewChange);
    const thumb = container.querySelector(".dynamic-scrollbar-thumb") as HTMLElement;
    const track = container.querySelector(".dynamic-scrollbar") as HTMLElement;

    // Mock getBoundingClientRect for the track to have a known width
    jest.spyOn(track, "getBoundingClientRect").mockReturnValue({
      width: 500, height: 17, top: 0, left: 0, right: 500, bottom: 17, x: 0, y: 0, toJSON: jest.fn()
    });

    // Pointer down at x=100
    fireEvent.pointerDown(thumb, { clientX: 100, pointerId: 1 });
    // Drag to x=200 (100px right on 500px track = 20% of 100 = 20 shift)
    fireEvent.pointerMove(thumb, { clientX: 200, pointerId: 1 });

    expect(onViewChange).toHaveBeenCalledTimes(1);
    const [newStart, newEnd] = onViewChange.mock.calls[0];
    // Original start was 25, shifted by 20 = 45
    expect(newStart).toBeCloseTo(45);
    // View range stays 50, so end = 95
    expect(newEnd).toBeCloseTo(95);
  });

  it("clamps drag so view does not exceed data start", () => {
    const onViewChange = jest.fn();
    const { container } = renderScrollbar(10, 60, onViewChange);
    const thumb = container.querySelector(".dynamic-scrollbar-thumb") as HTMLElement;
    const track = container.querySelector(".dynamic-scrollbar") as HTMLElement;

    jest.spyOn(track, "getBoundingClientRect").mockReturnValue({
      width: 500, height: 17, top: 0, left: 0, right: 500, bottom: 17, x: 0, y: 0, toJSON: jest.fn()
    });

    // Drag far to the left (more than the 10 offset allows)
    fireEvent.pointerDown(thumb, { clientX: 200, pointerId: 1 });
    fireEvent.pointerMove(thumb, { clientX: 0, pointerId: 1 }); // -200px = -40, but clamped to 0

    expect(onViewChange).toHaveBeenCalledTimes(1);
    const [newStart] = onViewChange.mock.calls[0];
    expect(newStart).toBeCloseTo(0);
  });

  it("clamps drag so view does not exceed data end", () => {
    const onViewChange = jest.fn();
    const { container } = renderScrollbar(40, 90, onViewChange);
    const thumb = container.querySelector(".dynamic-scrollbar-thumb") as HTMLElement;
    const track = container.querySelector(".dynamic-scrollbar") as HTMLElement;

    jest.spyOn(track, "getBoundingClientRect").mockReturnValue({
      width: 500, height: 17, top: 0, left: 0, right: 500, bottom: 17, x: 0, y: 0, toJSON: jest.fn()
    });

    // Drag far to the right (200px = +40, start would be 80 but view is 50 so max start is 50)
    fireEvent.pointerDown(thumb, { clientX: 200, pointerId: 1 });
    fireEvent.pointerMove(thumb, { clientX: 400, pointerId: 1 });

    expect(onViewChange).toHaveBeenCalledTimes(1);
    const [newStart, newEnd] = onViewChange.mock.calls[0];
    expect(newEnd).toBeCloseTo(100);
    expect(newStart).toBeCloseTo(50);
  });

  it("does not call onViewChange on pointerMove without prior pointerDown", () => {
    const onViewChange = jest.fn();
    const { container } = renderScrollbar(totalStart, totalEnd, onViewChange);
    const thumb = container.querySelector(".dynamic-scrollbar-thumb") as HTMLElement;

    fireEvent.pointerMove(thumb, { clientX: 200, pointerId: 1 });
    expect(onViewChange).not.toHaveBeenCalled();
  });

  it("ArrowRight moves view forward by 5% of data range", () => {
    const onViewChange = jest.fn();
    const { container } = renderScrollbar(25, 75, onViewChange);
    const thumb = container.querySelector(".dynamic-scrollbar-thumb") as HTMLElement;

    fireEvent.keyDown(thumb, { key: "ArrowRight" });
    expect(onViewChange).toHaveBeenCalledTimes(1);
    const [newStart, newEnd] = onViewChange.mock.calls[0];
    // 5% of 100 = 5 shift right, so start=30, end=80
    expect(newStart).toBeCloseTo(30);
    expect(newEnd).toBeCloseTo(80);
  });

  it("ArrowLeft moves view backward by 5% of data range", () => {
    const onViewChange = jest.fn();
    const { container } = renderScrollbar(25, 75, onViewChange);
    const thumb = container.querySelector(".dynamic-scrollbar-thumb") as HTMLElement;

    fireEvent.keyDown(thumb, { key: "ArrowLeft" });
    expect(onViewChange).toHaveBeenCalledTimes(1);
    const [newStart] = onViewChange.mock.calls[0];
    // 5% of 100 = 5 shift left, so start=20
    expect(newStart).toBeCloseTo(20);
  });

  it("Home moves view to the start", () => {
    const onViewChange = jest.fn();
    const { container } = renderScrollbar(40, 90, onViewChange);
    const thumb = container.querySelector(".dynamic-scrollbar-thumb") as HTMLElement;

    fireEvent.keyDown(thumb, { key: "Home" });
    expect(onViewChange).toHaveBeenCalledTimes(1);
    const [newStart] = onViewChange.mock.calls[0];
    expect(newStart).toBeCloseTo(0);
  });

  it("End moves view to the end", () => {
    const onViewChange = jest.fn();
    const { container } = renderScrollbar(10, 60, onViewChange);
    const thumb = container.querySelector(".dynamic-scrollbar-thumb") as HTMLElement;

    fireEvent.keyDown(thumb, { key: "End" });
    expect(onViewChange).toHaveBeenCalledTimes(1);
    const [newStart, newEnd] = onViewChange.mock.calls[0];
    expect(newEnd).toBeCloseTo(100);
    expect(newStart).toBeCloseTo(50);
  });

  it("keyboard clamps at data boundaries", () => {
    // View near the start, ArrowLeft should clamp to 0
    const onViewChange = jest.fn();
    const { container } = renderScrollbar(2, 52, onViewChange);
    const thumb = container.querySelector(".dynamic-scrollbar-thumb") as HTMLElement;

    fireEvent.keyDown(thumb, { key: "ArrowLeft" });
    expect(onViewChange).toHaveBeenCalledTimes(1);
    const [newStart] = onViewChange.mock.calls[0];
    expect(newStart).toBeCloseTo(0);
  });

  it("stops dragging on pointerUp", () => {
    const onViewChange = jest.fn();
    const { container } = renderScrollbar(25, 75, onViewChange);
    const thumb = container.querySelector(".dynamic-scrollbar-thumb") as HTMLElement;
    const track = container.querySelector(".dynamic-scrollbar") as HTMLElement;

    jest.spyOn(track, "getBoundingClientRect").mockReturnValue({
      width: 500, height: 17, top: 0, left: 0, right: 500, bottom: 17, x: 0, y: 0, toJSON: jest.fn()
    });

    fireEvent.pointerDown(thumb, { clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(thumb, { clientX: 150, pointerId: 1 });
    expect(onViewChange).toHaveBeenCalledTimes(1);

    fireEvent.pointerUp(thumb, { pointerId: 1 });
    // Move after pointerUp should not trigger callback
    fireEvent.pointerMove(thumb, { clientX: 250, pointerId: 1 });
    expect(onViewChange).toHaveBeenCalledTimes(1);
  });

  it("pressing the track outside the thumb centers the view on that point", () => {
    const { container, onViewChange } = renderScrollbar(0, 20);
    const track = mockTrackWidth(container);

    fireEvent.pointerDown(track, { clientX: 300, pointerId: 1 });
    expect(onViewChange).toHaveBeenCalledTimes(1);
    const [newStart, newEnd] = onViewChange.mock.calls[0];
    expect(newStart).toBeCloseTo(50);
    expect(newEnd).toBeCloseTo(70);
  });

  it("pressing the track near an end centers the view as far as the data allows", () => {
    const { container, onViewChange } = renderScrollbar(0, 20);
    const track = mockTrackWidth(container);

    fireEvent.pointerDown(track, { clientX: 495, pointerId: 1 });
    const [newStart, newEnd] = onViewChange.mock.calls[0];
    expect(newStart).toBeCloseTo(80);
    expect(newEnd).toBeCloseTo(100);
  });

  it("dragging after a track press keeps the view centered under the pointer", () => {
    const { container, onViewChange } = renderScrollbar(0, 20);
    const track = mockTrackWidth(container);

    fireEvent.pointerDown(track, { clientX: 300, pointerId: 1 });
    fireEvent.pointerMove(track, { clientX: 250, pointerId: 1 });
    const [newStart, newEnd] = onViewChange.mock.calls[1];
    expect(newStart).toBeCloseTo(40);
    expect(newEnd).toBeCloseTo(60);
  });

  it("pressing within the view grabs it rather than centering it", () => {
    const { container, onViewChange } = renderScrollbar(25, 75);
    const track = mockTrackWidth(container);

    // Grab the view 25 units from its start
    fireEvent.pointerDown(track, { clientX: 250, pointerId: 1 });
    expect(onViewChange).not.toHaveBeenCalled();

    fireEvent.pointerMove(track, { clientX: 300, pointerId: 1 });
    const [newStart, newEnd] = onViewChange.mock.calls[0];
    expect(newStart).toBeCloseTo(35);
    expect(newEnd).toBeCloseTo(85);
  });

  it("ignores moves from a different pointer", () => {
    const { container, onViewChange } = renderScrollbar(25, 75);
    const track = mockTrackWidth(container);

    fireEvent.pointerDown(track, { clientX: 250, pointerId: 1 });
    fireEvent.pointerMove(track, { clientX: 300, pointerId: 2 });
    expect(onViewChange).not.toHaveBeenCalled();
  });

  it("reports the start and end of a scrub", () => {
    const onScrubStart = jest.fn();
    const onScrubEnd = jest.fn();
    const { container } = renderScrollbar(25, 75, jest.fn(), { onScrubStart, onScrubEnd });
    const track = mockTrackWidth(container);

    fireEvent.pointerDown(track, { clientX: 250, pointerId: 1 });
    expect(onScrubStart).toHaveBeenCalledTimes(1);
    expect(track).toHaveClass("is-scrubbing");
    fireEvent.pointerMove(track, { clientX: 300, pointerId: 1 });
    expect(onScrubEnd).not.toHaveBeenCalled();

    fireEvent.pointerUp(track, { pointerId: 1 });
    expect(onScrubEnd).toHaveBeenCalledTimes(1);
    expect(track).not.toHaveClass("is-scrubbing");
  });

  it("ends a scrub when the pointer is canceled", () => {
    const onScrubEnd = jest.fn();
    const { container } = renderScrollbar(25, 75, jest.fn(), { onScrubEnd });
    const track = mockTrackWidth(container);

    fireEvent.pointerDown(track, { clientX: 250, pointerId: 1 });
    fireEvent.pointerCancel(track, { pointerId: 1 });
    expect(onScrubEnd).toHaveBeenCalledTimes(1);
  });

  it("ends a scrub that is in progress when it unmounts", () => {
    const onScrubEnd = jest.fn();
    const { container, unmount } = renderScrollbar(25, 75, jest.fn(), { onScrubEnd });
    const track = mockTrackWidth(container);

    fireEvent.pointerDown(track, { clientX: 250, pointerId: 1 });
    unmount();
    expect(onScrubEnd).toHaveBeenCalledTimes(1);
  });

  it("does nothing when disabled", () => {
    const onScrubStart = jest.fn();
    const { container, onViewChange } = renderScrollbar(25, 75, jest.fn(), { disabled: true, onScrubStart });
    const track = mockTrackWidth(container);
    const thumb = container.querySelector(".dynamic-scrollbar-thumb") as HTMLElement;

    fireEvent.pointerDown(track, { clientX: 450, pointerId: 1 });
    fireEvent.pointerMove(track, { clientX: 400, pointerId: 1 });
    fireEvent.keyDown(thumb, { key: "ArrowRight" });
    expect(onViewChange).not.toHaveBeenCalled();
    expect(onScrubStart).not.toHaveBeenCalled();
  });

  it("takes the thumb out of the tab order when disabled", () => {
    const { container } = renderScrollbar(25, 75, jest.fn(), { disabled: true });
    const thumb = container.querySelector(".dynamic-scrollbar-thumb") as HTMLElement;
    expect(thumb).toHaveAttribute("tabindex", "-1");
    expect(thumb).toHaveAttribute("aria-disabled", "true");
  });
});
