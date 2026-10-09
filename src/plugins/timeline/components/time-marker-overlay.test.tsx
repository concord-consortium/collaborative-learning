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
import { TileModelContext } from "../../../components/tiles/tile-api";
import { TileModel } from "../../../models/tiles/tile-model";
import { mockPointerEvents } from "../../../test/pointer-events";
import { TimelineContentModel, TimelineContentModelType } from "../models/timeline-content";
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

  function renderOverlay(content: TimelineContentModelType = createContent()) {
    const model = TileModel.create({ content });
    const result = render(
      <TileModelContext.Provider value={model}>
        <TimeMarkerOverlay />
      </TileModelContext.Provider>
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

  it("renders a hover marker with a two-line UTC label", () => {
    const content = createContent();
    const hoverTime = viewStart.plus({ hours: 6 });
    content.setHoverTime(hoverTime);
    const { container } = renderOverlay(content);

    const line = container.querySelector<HTMLElement>(".time-marker-line.hover");
    const label = container.querySelector<HTMLElement>(".time-marker-label.hover");
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

  // The preview is drawn only while placing, and placing is unreachable once a marker exists, so
  // the two can no longer coexist.
  it("clears the hover preview when a marker is placed", () => {
    const content = createContent();
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
    it("deletes from the x in the label", () => {
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

    it("does not start a drag from the delete control", () => {
      const { content } = renderOverlayWithAMarker();
      fireEvent.click(screen.getByRole("button", { name: "Delete marker" }));
      expect(content.markerTime).toBeUndefined();
    });
  });
});
