// Mock uPlot — canvas won't work in jsdom
jest.mock("uplot", () => {
  return jest.fn().mockImplementation(() => ({
    setData: jest.fn(),
    setSize: jest.fn(),
    destroy: jest.fn(),
  }));
});

import { act, fireEvent, render, screen } from "@testing-library/react";
import { DateTime } from "luxon";
import { onPatch } from "mobx-state-tree";
import React from "react";
import { ReadOnlyContext } from "../../../components/document/read-only-context";
import { TileModelContext } from "../../../components/tiles/tile-api";
import { TileModel } from "../../../models/tiles/tile-model";
import { mockPointerEvents } from "../../../test/pointer-events";
import { TimelineContentModel, TimelineContentModelType } from "../models/timeline-content";
import { formatTime } from "./describe-view";
import { TimeMarkerOverlay } from "./time-marker-overlay";

// The timeline tile needs to be registered so TileModel.create
// knows it is a supported tile type
import "../timeline-registration";

beforeAll(mockPointerEvents);

describe("TimeMarkerOverlay", () => {
  const viewStart = DateTime.fromISO("2026-02-01T00:00:00.000Z");
  const viewEnd = DateTime.fromISO("2026-02-02T00:00:00.000Z");

  function createContent() {
    return TimelineContentModel.create({
      viewStartTimeISO: viewStart.toISO()!,
      viewEndTimeISO: viewEnd.toISO()!,
    });
  }

  function renderOverlay(content: TimelineContentModelType = createContent(), readOnly = false) {
    const model = TileModel.create({ content });
    const result = render(
      <ReadOnlyContext.Provider value={readOnly}>
        <TileModelContext.Provider value={model}>
          <TimeMarkerOverlay />
        </TileModelContext.Provider>
      </ReadOnlyContext.Provider>
    );
    return { content, ...result };
  }

  function renderOverlayWithAMarker() {
    const content = createContent();
    act(() => { content.setMarkerTime(viewStart.plus({ hours: 12 })); });
    return renderOverlay(content);
  }

  it("renders no markers by default", () => {
    const { container } = renderOverlay(createContent());
    expect(container.querySelector(".time-marker-line")).toBeNull();
    expect(container.querySelector(".time-marker-label")).toBeNull();
  });

  it("renders the placing preview with a two-line UTC label", () => {
    const content = createContent();
    const hoverTime = viewStart.plus({ hours: 6 });
    content.startPlacingMarker();
    content.setHoverTime(hoverTime);
    const { container } = renderOverlay(content);

    const line = container.querySelector<HTMLElement>(".time-marker-line.placing");
    const label = container.querySelector<HTMLElement>(".time-marker-label.placing");
    expect(line).toBeInTheDocument();
    expect(label).toBeInTheDocument();
    expect(line!.style.left).toBe("25%");
    expect(label!.textContent).toContain(hoverTime.toUTC().toLocaleString());
    expect(label!.textContent).toContain(hoverTime.toUTC().toLocaleString(DateTime.TIME_WITH_SECONDS));
  });

  it("hides the placed marker when its time is outside the view range", () => {
    const content = createContent();
    content.setMarkerTime(viewEnd.plus({ hours: 1 }));
    const { container } = renderOverlay(content);
    expect(container.querySelector(".time-marker-line.placed")).toBeNull();
    // Still placed — it reappears if the view pans back
    expect(content.markerTime).toBeDefined();
  });

  // Placing a marker ends placement, so the preview and a placed marker never appear together.
  it("clears the hover preview when a marker is placed", () => {
    const content = createContent();
    content.startPlacingMarker();
    content.setHoverTime(viewStart.plus({ hours: 6 }));
    content.setMarkerTime(viewStart.plus({ hours: 12 }));
    const { container } = renderOverlay(content);
    expect(container.querySelectorAll(".time-marker-line")).toHaveLength(1);
    expect(container.querySelector(".time-marker-line.placed")).toBeInTheDocument();
  });

  describe("the placing preview", () => {
    it("draws a dashed preview at the hovered time while placing", () => {
      const { content, container } = renderOverlay();
      act(() => {
        content.startPlacingMarker();
        content.setHoverTime(viewStart.plus({ hours: 12 }));
      });

      expect(container.querySelector(".time-marker-line.placing")).toBeInTheDocument();
    });

    it("draws no preview when not placing", () => {
      const { content, container } = renderOverlay();
      act(() => { content.setHoverTime(viewStart.plus({ hours: 12 })); });

      expect(container.querySelector(".time-marker-line.placing")).not.toBeInTheDocument();
    });
  });

  describe("deleting the marker", () => {
    it("deletes from the delete button in the label", () => {
      const { content } = renderOverlayWithAMarker();
      fireEvent.click(screen.getByRole("button", { name: "Delete marker" }));
      expect(content.markerTime).toBeUndefined();
    });

    it("does not delete when the label itself is clicked", () => {
      const { content } = renderOverlayWithAMarker();
      fireEvent.click(screen.getByTestId("marker-label"));
      expect(content.markerTime).toBeDefined();
    });
  });

  const kOverlayWidth = 1000;

  function stubOverlayRect() {
    const overlay = document.querySelector<HTMLElement>(".time-marker-overlay")!;
    overlay.getBoundingClientRect = () => ({
      left: 0, right: kOverlayWidth, width: kOverlayWidth, top: 0, bottom: 100, height: 100, x: 0, y: 0,
      toJSON: () => ({})
    });
  }

  function dragBy(testId: string, toFraction: number) {
    stubOverlayRect();
    const target = screen.getByTestId(testId);
    const fromX = kOverlayWidth * 0.5;
    const toX = kOverlayWidth * toFraction;
    fireEvent.pointerDown(target, { pointerId: 1, clientX: fromX });
    fireEvent.pointerMove(target, { pointerId: 1, clientX: (fromX + toX) / 2 });
    fireEvent.pointerMove(target, { pointerId: 1, clientX: toX });
    fireEvent.pointerUp(target, { pointerId: 1, clientX: toX });
  }

  describe("dragging the marker", () => {
    it("moves the marker when the stem is dragged", () => {
      const { content } = renderOverlayWithAMarker();
      const before = content.markerTime!;

      dragBy("marker-stem", 0.75);

      expect(content.markerTime!.toMillis()).toBeGreaterThan(before.toMillis());
    });

    it("moves the marker when the label is dragged", () => {
      const { content } = renderOverlayWithAMarker();
      const before = content.markerTime!;

      dragBy("marker-label", 0.75);

      expect(content.markerTime!.toMillis()).toBeGreaterThan(before.toMillis());
    });

    // A drag is hundreds of pointermoves. Writing each one would bury the document's undo history
    // under a single gesture.
    it("writes the model once, at the end of the drag", () => {
      const { content } = renderOverlayWithAMarker();
      const writes: unknown[] = [];
      onPatch(content, patch => { if (patch.path === "/markerTimeISO") writes.push(patch.value); });

      dragBy("marker-stem", 0.75);

      expect(writes).toHaveLength(1);
    });

    // A pointerup that never arrives must not leave a drag running.
    it("ends the drag on pointer cancel", () => {
      const { content } = renderOverlayWithAMarker();
      const before = content.markerTime!;
      stubOverlayRect();
      const stem = screen.getByTestId("marker-stem");

      fireEvent.pointerDown(stem, { pointerId: 1, clientX: 100 });
      fireEvent.pointerCancel(stem, { pointerId: 1 });
      fireEvent.pointerMove(stem, { pointerId: 1, clientX: 400 });
      // A trailing pointerup is what actually distinguishes "cancel disarmed the drag" from
      // "cancel was a no-op": without it, the model only ever changes at commit time regardless.
      fireEvent.pointerUp(stem, { pointerId: 1, clientX: 400 });

      expect(content.markerTime!.toMillis()).toBe(before.toMillis());
    });

    // It sits on the label, which is itself a drag grip, so its pointerdown must not reach it.
    it("does not start a drag from the delete button", () => {
      const { content } = renderOverlayWithAMarker();
      const before = content.markerTime!;
      stubOverlayRect();
      const deleteButton = screen.getByRole("button", { name: "Delete marker" });

      fireEvent.pointerDown(deleteButton, { pointerId: 1, clientX: kOverlayWidth * 0.5 });
      fireEvent.pointerMove(screen.getByTestId("marker-label"), { pointerId: 1, clientX: kOverlayWidth * 0.9 });
      fireEvent.pointerUp(screen.getByTestId("marker-label"), { pointerId: 1, clientX: kOverlayWidth * 0.9 });

      expect(content.markerTime!.toMillis()).toBe(before.toMillis());
    });

    // A press on the stem focuses it, so Delete can arrive mid-drag. The marker was still drawn
    // from the drag state, and pointer-up committed it again.
    it("stays deleted when Delete arrives mid-drag", () => {
      const { content } = renderOverlayWithAMarker();
      stubOverlayRect();
      const stem = screen.getByTestId("marker-stem");

      fireEvent.pointerDown(stem, { pointerId: 1, clientX: kOverlayWidth * 0.5 });
      fireEvent.pointerMove(stem, { pointerId: 1, clientX: kOverlayWidth * 0.7 });
      fireEvent.keyDown(stem, { key: "Delete" });
      fireEvent.pointerUp(stem, { pointerId: 1, clientX: kOverlayWidth * 0.7 });

      expect(content.markerTime).toBeUndefined();
    });

    it("deletes the marker when the delete button is clicked", () => {
      const { content } = renderOverlayWithAMarker();
      fireEvent.click(screen.getByRole("button", { name: "Delete marker" }));
      expect(content.markerTime).toBeUndefined();
    });

    // The stem holds the captured pointer, so it has to stay mounted for the whole drag, and
    // the release has to land somewhere the view reaches.
    it("stays mounted and lands at the edge when dragged past it", () => {
      const { content } = renderOverlayWithAMarker();
      stubOverlayRect();
      const stem = screen.getByTestId("marker-stem");

      fireEvent.pointerDown(stem, { pointerId: 1, clientX: kOverlayWidth * 0.5 });
      fireEvent.pointerMove(stem, { pointerId: 1, clientX: kOverlayWidth * 1.4 });
      expect(stem).toBeInTheDocument();
      expect(stem.style.left).toBe("100%");

      fireEvent.pointerUp(stem, { pointerId: 1, clientX: kOverlayWidth * 1.4 });
      expect(content.timeToViewPct(content.markerTime!)).toBeCloseTo(100);
    });

    it("ends the drag when the pointer capture is lost", () => {
      const { content } = renderOverlayWithAMarker();
      const before = content.markerTime!;
      stubOverlayRect();
      const stem = screen.getByTestId("marker-stem");

      fireEvent.pointerDown(stem, { pointerId: 1, clientX: 100 });
      fireEvent.lostPointerCapture(stem, { pointerId: 1 });
      fireEvent.pointerMove(stem, { pointerId: 1, clientX: 400 });
      fireEvent.pointerUp(stem, { pointerId: 1, clientX: 400 });

      expect(content.markerTime!.toMillis()).toBe(before.toMillis());
    });
  });

  describe("moving the marker from the keyboard", () => {
    // The marker starts at the middle of the view; a step is 5% of it, a large step 20%.
    it.each([
      { key: "ArrowRight", pct: 55 },
      { key: "ArrowUp", pct: 55 },
      { key: "ArrowLeft", pct: 45 },
      { key: "ArrowDown", pct: 45 },
      { key: "PageUp", pct: 70 },
      { key: "PageDown", pct: 30 },
      { key: "Home", pct: 0 },
      { key: "End", pct: 100 },
    ])("moves the marker to $pct% of the view on $key", ({ key, pct }) => {
      const { content } = renderOverlayWithAMarker();
      fireEvent.keyDown(screen.getByRole("slider"), { key });
      expect(content.timeToViewPct(content.markerTime!)).toBeCloseTo(pct);
    });

    it("stops at the edge of the view", () => {
      const { content } = renderOverlayWithAMarker();
      const slider = screen.getByRole("slider");
      fireEvent.keyDown(slider, { key: "End" });
      fireEvent.keyDown(slider, { key: "ArrowRight" });
      expect(content.timeToViewPct(content.markerTime!)).toBeCloseTo(100);
    });

    it("writes the model once per press, so a nudge is a single undo step", () => {
      const { content } = renderOverlayWithAMarker();
      const writes: unknown[] = [];
      onPatch(content, patch => { if (patch.path === "/markerTimeISO") writes.push(patch.value); });

      fireEvent.keyDown(screen.getByRole("slider"), { key: "ArrowRight" });

      expect(writes).toHaveLength(1);
    });

    it.each(["Delete", "Backspace"])("deletes the marker on %s", (key) => {
      const { content } = renderOverlayWithAMarker();
      fireEvent.keyDown(screen.getByRole("slider"), { key });
      expect(content.markerTime).toBeUndefined();
    });

    // TileComponent treats ArrowUp from a non-editable element inside a tile as a soft exit, so
    // the marker has to consume the keys it uses or focus leaves it. Its handler is a React one,
    // dispatched from the root, so this has to use a React handler too -- a native listener on an
    // ancestor would fire before React's and prove nothing.
    it.each(["ArrowUp", "ArrowRight", "Home", "Delete", "Backspace"])(
      "keeps %s from also reaching the tile around it", (key) => {
        const content = createContent();
        act(() => { content.setMarkerTime(viewStart.plus({ hours: 12 })); });
        const model = TileModel.create({ content });
        const onTileKeyDown = jest.fn();
        render(
          <ReadOnlyContext.Provider value={false}>
            <TileModelContext.Provider value={model}>
              <div onKeyDown={onTileKeyDown}><TimeMarkerOverlay /></div>
            </TileModelContext.Provider>
          </ReadOnlyContext.Provider>
        );

        fireEvent.keyDown(screen.getByRole("slider"), { key });

        expect(onTileKeyDown).not.toHaveBeenCalled();
      });

    // A key the marker does not use has to keep working on the tile.
    it("lets a key it does not handle through to the tile", () => {
      const content = createContent();
      act(() => { content.setMarkerTime(viewStart.plus({ hours: 12 })); });
      const model = TileModel.create({ content });
      const onTileKeyDown = jest.fn();
      render(
        <ReadOnlyContext.Provider value={false}>
          <TileModelContext.Provider value={model}>
            <div onKeyDown={onTileKeyDown}><TimeMarkerOverlay /></div>
          </TileModelContext.Provider>
        </ReadOnlyContext.Provider>
      );

      fireEvent.keyDown(screen.getByRole("slider"), { key: "Tab" });

      expect(onTileKeyDown).toHaveBeenCalled();
    });

    it("reads out the marker's time as the slider's value", () => {
      renderOverlayWithAMarker();
      expect(screen.getByRole("slider")).toHaveAttribute(
        "aria-valuetext", formatTime(viewStart.plus({ hours: 12 }))
      );
    });
  });

  // A read-only pane shares the document model, so anything live there edits the student's marker.
  describe("a read-only tile", () => {
    function renderReadOnlyWithAMarker() {
      const content = createContent();
      act(() => { content.setMarkerTime(viewStart.plus({ hours: 12 })); });
      return renderOverlay(content, true);
    }

    it("still shows where the marker is", () => {
      const { container } = renderReadOnlyWithAMarker();
      expect(container.querySelector(".time-marker-line.placed")).toBeInTheDocument();
    });

    it("offers no way to delete it", () => {
      renderReadOnlyWithAMarker();
      expect(screen.queryByRole("button", { name: "Delete marker" })).not.toBeInTheDocument();
    });

    it("leaves it out of the Tab order, with nothing there to operate", () => {
      renderReadOnlyWithAMarker();
      expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    });

    it.each(["marker-stem", "marker-label"])("does not move it when the %s is dragged", testId => {
      const { content } = renderReadOnlyWithAMarker();
      const before = content.markerTime!;
      dragBy(testId, 0.75);
      expect(content.markerTime!.toMillis()).toBe(before.toMillis());
    });
  });
});
