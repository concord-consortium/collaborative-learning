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
import { TimelineContentModel, TimelineContentModelType } from "../models/timeline-content";
import { TimeMarkerOverlay } from "./time-marker-overlay";

// The timeline tile needs to be registered so TileModel.create
// knows it is a supported tile type
import "../timeline-registration";

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

  it("renders a placed marker and clears it when its label is clicked", () => {
    const content = createContent();
    content.setMarkerTime(viewStart.plus({ hours: 12 }));
    const { container } = renderOverlay(content);

    const label = container.querySelector<HTMLElement>("button.time-marker-label.placed");
    expect(container.querySelector(".time-marker-line.placed")).toBeInTheDocument();
    expect(label).toBeInTheDocument();

    fireEvent.click(label!);
    expect(content.markerTime).toBeUndefined();
    expect(container.querySelector(".time-marker-line.placed")).toBeNull();
  });

  it("hides the placed marker when its time is outside the view range", () => {
    const content = createContent();
    content.setMarkerTime(viewEnd.plus({ hours: 1 }));
    const { container } = renderOverlay(content);
    expect(container.querySelector(".time-marker-line.placed")).toBeNull();
    // Still placed — it reappears if the view pans back
    expect(content.markerTime).toBeDefined();
  });

  // A hover preview and a placed marker can no longer coexist: the preview is only drawn while
  // placing, and placing is unreachable once a marker exists. Placing one clears the preview, so
  // a stale line is not left behind where the pointer happened to be.
  it("clears the hover preview when a marker is placed", () => {
    const content = createContent();
    content.setHoverTime(viewStart.plus({ hours: 6 }));
    content.setMarkerTime(viewStart.plus({ hours: 12 }));
    const { container } = renderOverlay(content);
    expect(container.querySelectorAll(".time-marker-line")).toHaveLength(1);
    expect(container.querySelector(".time-marker-line.placed")).toBeInTheDocument();
  });

  describe("the placing preview", () => {
    // The preview is what tells a student where the marker will land, and dashed is what tells them
    // it is not settled yet.
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
});
