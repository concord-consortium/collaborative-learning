import React from "react";
import { act, render, screen, fireEvent } from "@testing-library/react";
import { Provider } from "mobx-react";
import { ModalProvider } from "react-modal-hook";
import { DateTime } from "luxon";

import { TileModelContext } from "../../components/tiles/tile-api";
import { TileModel } from "../../models/tiles/tile-model";
import { registerTileContentInfo } from "../../models/tiles/tile-content-info";
import { specStores } from "../../models/stores/spec-stores";
import { getToolbarButtonInfo } from "../../components/toolbar/toolbar-button-manager";
import { getSharedModelManager } from "../../models/tiles/tile-environment";
import { TimelineContentModel, TimelineContentModelType, defaultTimelineContent } from "./models/timeline-content";
import { kTimelineTileType } from "./timeline-types";
import { SharedSeismogram } from "../shared-seismogram/shared-seismogram";
import "./timeline-toolbar";

jest.mock("../../models/tiles/tile-environment", () => ({
  getSharedModelManager: jest.fn()
}));

// Registering only the content info (not the full timeline-registration, which pulls in
// the uPlot-based chart component and fails outside a browser matchMedia environment).
registerTileContentInfo({
  type: kTimelineTileType,
  displayName: "Timeline",
  modelClass: TimelineContentModel,
  defaultContent: defaultTimelineContent
});

const mockedGetSharedModelManager = getSharedModelManager as jest.MockedFunction<typeof getSharedModelManager>;

function withSharedSeismogram(dataStart: DateTime, dataEnd: DateTime) {
  mockedGetSharedModelManager.mockReturnValue({
    isReady: true,
    getTileSharedModelsByType: (_self: any, type: any) =>
      type === SharedSeismogram ? [{ station: {}, startTime: dataStart, endTime: dataEnd }] : [],
  } as any);
}

function withNoSharedModels() {
  mockedGetSharedModelManager.mockReturnValue({
    isReady: true,
    getTileSharedModelsByType: () => [],
  } as any);
}

function renderToolbarButton(content: TimelineContentModelType) {
  const info = getToolbarButtonInfo("timeline", "add-marker");
  if (!info) throw new Error(`Toolbar button 'add-marker' is not registered for tileType 'timeline'`);
  const Component = info.component;
  const stores = specStores();
  const model = TileModel.create({ content });

  return render(
    <ModalProvider>
      <Provider stores={stores}>
        <TileModelContext.Provider value={model}>
          <Component name="add-marker" />
        </TileModelContext.Provider>
      </Provider>
    </ModalProvider>
  );
}

describe("Timeline toolbar — Add Time Marker button", () => {
  const dataStart = DateTime.fromISO("2026-01-30T00:00:00.000Z");
  const dataEnd = DateTime.fromISO("2026-02-06T00:00:00.000Z");

  afterEach(() => {
    mockedGetSharedModelManager.mockReset();
  });

  /** A real pointer click. A button activated from the keyboard reports detail 0, which the
   *  button treats as a request to place the marker rather than to arm placement mode. */
  const clickButton = () =>
    fireEvent.click(screen.getByRole("button", { name: "Add Time Marker" }), { detail: 1 });

  it("turns on placement mode when clicked", () => {
    withSharedSeismogram(dataStart, dataEnd);
    const content = TimelineContentModel.create();
    renderToolbarButton(content);

    clickButton();
    expect(content.isPlacingMarker).toBe(true);
  });

  // aria-pressed says this is a toggle, so it has to behave like one: Escape was otherwise the
  // only way out of placement mode, and nothing tells the student that.
  it("turns placement mode back off when clicked again", () => {
    withSharedSeismogram(dataStart, dataEnd);
    const content = TimelineContentModel.create();
    renderToolbarButton(content);

    clickButton();
    clickButton();

    expect(content.isPlacingMarker).toBe(false);
  });

  it("reports whether placement mode is on", () => {
    withSharedSeismogram(dataStart, dataEnd);
    const content = TimelineContentModel.create();
    renderToolbarButton(content);
    const button = screen.getByRole("button", { name: "Add Time Marker" });

    expect(button).toHaveAttribute("aria-pressed", "false");
    clickButton();
    expect(button).toHaveAttribute("aria-pressed", "true");
  });

  // Placement is a pointer gesture. Without this a keyboard user gets a button that reports itself
  // pressed and then does nothing they can reach, which fails WCAG 2.1.1.
  it("places the marker in the middle of the view when activated from the keyboard", () => {
    withSharedSeismogram(dataStart, dataEnd);
    const content = TimelineContentModel.create();
    content.setViewRange(dataStart, dataEnd);
    renderToolbarButton(content);

    fireEvent.click(screen.getByRole("button", { name: "Add Time Marker" }), { detail: 0 });

    expect(content.isPlacingMarker).toBe(false);
    expect(content.timeToViewPct(content.markerTime!)).toBeCloseTo(50);
  });

  it("announces why it is disabled rather than the generic message", () => {
    withSharedSeismogram(dataStart, dataEnd);
    const content = TimelineContentModel.create();
    content.setMarkerTime(dataStart.plus({ days: 1 }));
    renderToolbarButton(content);

    clickButton();

    expect(screen.getByText("Delete the existing marker first")).toBeInTheDocument();
  });

  // Only one marker at a time: the way to get another is to delete the first.
  it("is disabled once a marker exists", () => {
    withSharedSeismogram(dataStart, dataEnd);
    const content = TimelineContentModel.create();
    content.setMarkerTime(dataStart.plus({ days: 1 }));
    renderToolbarButton(content);

    expect(screen.getByRole("button", { name: "Add Time Marker" })).toHaveAttribute("aria-disabled", "true");
  });

  it("is enabled again once the marker is deleted", () => {
    withSharedSeismogram(dataStart, dataEnd);
    const content = TimelineContentModel.create();
    content.setMarkerTime(dataStart.plus({ days: 1 }));
    renderToolbarButton(content);

    act(() => { content.clearMarkerTime(); });
    clickButton();

    expect(content.isPlacingMarker).toBe(true);
  });

  // Changing the Wave Runner's dates can leave a marker outside the data, where it can neither be
  // panned to nor deleted. Keeping the button off then would disable it for the life of the tile.
  it("is enabled when the marker has been left outside the data", () => {
    withSharedSeismogram(dataStart, dataEnd);
    const content = TimelineContentModel.create();
    content.setMarkerTime(dataStart.minus({ days: 2 }));
    renderToolbarButton(content);

    expect(screen.getByRole("button", { name: "Add Time Marker" })).not.toHaveAttribute("aria-disabled");
  });

  // Nothing to place a marker against before data has loaded.
  it("is disabled when there is no data", () => {
    withNoSharedModels();
    const content = TimelineContentModel.create();
    renderToolbarButton(content);

    expect(screen.getByRole("button", { name: "Add Time Marker" })).toHaveAttribute("aria-disabled", "true");
  });
});
