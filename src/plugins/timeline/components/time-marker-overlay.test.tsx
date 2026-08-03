// Mock uPlot — canvas won't work in jsdom
jest.mock("uplot", () => {
  return jest.fn().mockImplementation(() => ({
    setData: jest.fn(),
    setSize: jest.fn(),
    destroy: jest.fn(),
  }));
});

import { fireEvent, render } from "@testing-library/react";
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

  function renderOverlay(content: TimelineContentModelType) {
    const model = TileModel.create({ content });
    return render(
      <TileModelContext.Provider value={model}>
        <TimeMarkerOverlay />
      </TileModelContext.Provider>
    );
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

  it("renders a pinned marker and clears it when its label is clicked", () => {
    const content = createContent();
    content.setPinnedTime(viewStart.plus({ hours: 12 }));
    const { container } = renderOverlay(content);

    const label = container.querySelector<HTMLElement>("button.time-marker-label.pinned");
    expect(container.querySelector(".time-marker-line.pinned")).toBeInTheDocument();
    expect(label).toBeInTheDocument();

    fireEvent.click(label!);
    expect(content.pinnedTime).toBeUndefined();
    expect(container.querySelector(".time-marker-line.pinned")).toBeNull();
  });

  it("hides the pinned marker when its time is outside the view range", () => {
    const content = createContent();
    content.setPinnedTime(viewEnd.plus({ hours: 1 }));
    const { container } = renderOverlay(content);
    expect(container.querySelector(".time-marker-line.pinned")).toBeNull();
    // Still pinned — it reappears if the view pans back
    expect(content.pinnedTime).toBeDefined();
  });

  it("renders hover and pinned markers simultaneously", () => {
    const content = createContent();
    content.setHoverTime(viewStart.plus({ hours: 6 }));
    content.setPinnedTime(viewStart.plus({ hours: 12 }));
    const { container } = renderOverlay(content);
    expect(container.querySelectorAll(".time-marker-line")).toHaveLength(2);
  });
});
