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

describe("Timeline toolbar — Add Marker button", () => {
  const dataStart = DateTime.fromISO("2026-01-30T00:00:00.000Z");
  const dataEnd = DateTime.fromISO("2026-02-06T00:00:00.000Z");

  afterEach(() => {
    mockedGetSharedModelManager.mockReset();
  });

  it("turns on placement mode when clicked", () => {
    withSharedSeismogram(dataStart, dataEnd);
    const content = TimelineContentModel.create();
    renderToolbarButton(content);

    fireEvent.click(screen.getByRole("button", { name: "Add Marker" }));
    expect(content.isPlacingMarker).toBe(true);
  });

  // Only one marker at a time: the way to get another is to delete the first.
  it("is disabled once a marker exists", () => {
    withSharedSeismogram(dataStart, dataEnd);
    const content = TimelineContentModel.create();
    content.setMarkerTime(dataStart.plus({ days: 1 }));
    renderToolbarButton(content);

    expect(screen.getByRole("button", { name: "Add Marker" })).toHaveAttribute("aria-disabled", "true");
  });

  it("is enabled again once the marker is deleted", () => {
    withSharedSeismogram(dataStart, dataEnd);
    const content = TimelineContentModel.create();
    content.setMarkerTime(dataStart.plus({ days: 1 }));
    renderToolbarButton(content);

    act(() => { content.clearMarkerTime(); });
    fireEvent.click(screen.getByRole("button", { name: "Add Marker" }));

    expect(content.isPlacingMarker).toBe(true);
  });

  // Nothing to place a marker against before data has loaded.
  it("is disabled when there is no data", () => {
    withNoSharedModels();
    const content = TimelineContentModel.create();
    renderToolbarButton(content);

    expect(screen.getByRole("button", { name: "Add Marker" })).toHaveAttribute("aria-disabled", "true");
  });
});
