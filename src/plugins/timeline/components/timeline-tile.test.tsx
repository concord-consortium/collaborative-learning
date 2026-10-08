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
import { Provider } from "mobx-react";
import React from "react";
import { TileModel } from "../../../models/tiles/tile-model";
import { TileModelContext } from "../../../components/tiles/tile-api";
import { specStores } from "../../../models/stores/spec-stores";
import { specAppConfig } from "../../../models/stores/spec-app-config";
import { userSelectTile } from "../../../models/stores/ui";
import { getSharedModelManager } from "../../../models/tiles/tile-environment";
import { mockPointerEvents } from "../../../test/pointer-events";
import "../../../models/tiles/table/table-registration";
import "../../bar-graph/bar-graph-registration";
import "../../data-card/data-card-registration";
import { SharedSeismogram } from "../../shared-seismogram/shared-seismogram";
import { defaultTimelineContent, TimelineContentModelType } from "../models/timeline-content";
import { TimelineComponent } from "./timeline-tile";

// The timeline tile needs to be registered so the TileModel.create
// knows it is a supported tile type
import "../timeline-registration";

jest.mock("../../../models/tiles/tile-environment", () => ({
  ...jest.requireActual("../../../models/tiles/tile-environment"),
  getSharedModelManager: jest.fn()
}));

const mockedGetSharedModelManager = getSharedModelManager as jest.MockedFunction<typeof getSharedModelManager>;

describe("TimelineComponent", () => {
  const content = defaultTimelineContent();
  const model = TileModel.create({ content });

  const defaultProps = {
    tileElt: null,
    context: "",
    docId: "",
    documentContent: null,
    isUserResizable: true,
    onResizeRow: () => { throw new Error("Function not implemented."); },
    onSetCanAcceptDrop: () => { throw new Error("Function not implemented."); },
    onRequestRowHeight: () => { throw new Error("Function not implemented."); },
    onRegisterTileApi: () => { throw new Error("Function not implemented."); },
    onUnregisterTileApi: () => { throw new Error("Function not implemented."); }
  };

  const stores = specStores({
    appConfig: specAppConfig({
      config: {
        settings: {
          "timeline": {
            tools: [
              ["data-set-view", "Table"],
              ["data-set-view", "DataCard"],
              ["data-set-view", "BarGraph"],
              "|", "zoom-in", "zoom-out", "view-all",
              "|", "pan-left", "pan-right"
            ]
          }
        }
      }
    })
  });

  function renderWithStores() {
    stores.ui.setSelectedTileId(model.id);
    return render(
      <Provider stores={stores}>
        <TileModelContext.Provider value={model}>
          <TimelineComponent {...defaultProps} {...{model}} />
        </TileModelContext.Provider>
      </Provider>
    );
  }

  it("renders successfully", () => {
    const { container } = renderWithStores();
    expect(container.querySelector(".timeline-tile")).toBeInTheDocument();
  });

  it("renders an editable tile title", () => {
    const { container } = renderWithStores();
    expect(container.querySelector(".title-area")).toBeInTheDocument();
  });

  it("zoom buttons are disabled when no seismogram data is available", () => {
    renderWithStores();
    const zoomInButton = screen.getByLabelText("Zoom In");
    const zoomOutButton = screen.getByLabelText("Zoom Out");
    const viewAllButton = screen.getByLabelText("View All");
    expect(zoomInButton).toHaveAttribute("aria-disabled", "true");
    expect(zoomOutButton).toHaveAttribute("aria-disabled", "true");
    expect(viewAllButton).toHaveAttribute("aria-disabled", "true");
  });

  it("pan buttons are disabled when no seismogram data is available", () => {
    renderWithStores();
    expect(screen.getByLabelText("Pan Left")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByLabelText("Pan Right")).toHaveAttribute("aria-disabled", "true");
  });

  describe("with seismogram data", () => {
    const dataStart = DateTime.fromISO("2026-02-01T00:00:00.000Z");
    const dataEnd = DateTime.fromISO("2026-02-05T00:00:00.000Z");

    beforeEach(() => {
      const mockSharedSeismogram = { startTime: dataStart, endTime: dataEnd };
      mockedGetSharedModelManager.mockReturnValue({
        isReady: true,
        getTileSharedModelsByType: (_self: any, type: any) => type === SharedSeismogram ? [mockSharedSeismogram] : []
      } as any);
    });

    afterEach(() => mockedGetSharedModelManager.mockReset());

    it("enables each pan button only while the view can pan that way", () => {
      const timeline = model.content as TimelineContentModelType;
      timeline.setViewRange(dataStart, dataStart.plus({ days: 1 }));
      renderWithStores();
      const panLeft = screen.getByLabelText("Pan Left");
      const panRight = screen.getByLabelText("Pan Right");
      expect(panLeft).toHaveAttribute("aria-disabled", "true");
      expect(panRight).not.toHaveAttribute("aria-disabled", "true");

      act(() => timeline.setViewRange(dataEnd.minus({ days: 1 }), dataEnd));
      expect(panLeft).not.toHaveAttribute("aria-disabled", "true");
      expect(panRight).toHaveAttribute("aria-disabled", "true");
    });
  });

  it("displays the selected event label", () => {
    renderWithStores();
    expect(screen.getByText("Event")).toBeInTheDocument();
  });

  it("Prev and Next buttons are disabled when no events exist", () => {
    const { container } = renderWithStores();
    const prevButton = container.querySelector(".prev-button");
    const nextButton = container.querySelector(".next-button");
    expect(prevButton).toBeDisabled();
    expect(nextButton).toBeDisabled();
  });

  it("renders all toolbar buttons", () => {
    renderWithStores();
    const toolbar = screen.getByTestId("tile-toolbar");
    expect(toolbar).toContainHTML("Table It!");
    expect(toolbar).toContainHTML("Data Card It!");
    expect(toolbar).toContainHTML("Bar Graph It!");
    expect(toolbar).toContainHTML("Zoom In");
    expect(toolbar).toContainHTML("Zoom Out");
    expect(toolbar).toContainHTML("View All");
    expect(toolbar).toContainHTML("Pan Left");
    expect(toolbar).toContainHTML("Pan Right");
  });

  describe("tile selection", () => {
    beforeAll(mockPointerEvents);

    // The tile element stays in the document while each test runs, as the toolbar's anchor.
    let tileElt: HTMLElement | undefined;

    afterEach(() => {
      // userSelectTile is debounced, so a call soon after the previous test's would run too late
      // for this test's checks, possibly during the next test.
      userSelectTile.cancel();
      tileElt?.remove();
      tileElt = undefined;
    });

    function renderInTile(selectedTileId = model.id) {
      tileElt = document.createElement("div");
      const plot = document.createElement("div");
      plot.className = "timeline-plot";
      const title = document.createElement("div");
      const dragHandle = document.createElement("div");
      dragHandle.className = "tool-tile-drag-handle-wrapper";
      const fullTimeline = document.createElement("div");
      fullTimeline.addEventListener("pointerdown", e => e.preventDefault());
      tileElt.append(plot, title, dragHandle, fullTimeline);
      document.body.append(tileElt);
      stores.ui.setSelectedTileId(selectedTileId);
      render(
        <Provider stores={stores}>
          <TileModelContext.Provider value={model}>
            <TimelineComponent {...defaultProps} {...{model, tileElt}} />
          </TileModelContext.Provider>
        </Provider>
      );
      return { plot, title, dragHandle, fullTimeline };
    }

    it("leaves a press on the drag handle to the handle's own selection", () => {
      const { dragHandle } = renderInTile();
      fireEvent.pointerDown(dragHandle, { shiftKey: true });
      expect([...stores.ui.selectedTileIds]).toEqual([model.id]);
    });

    it("becomes the only selected tile on a Shift-click on the graph", () => {
      const { plot } = renderInTile("other-tile");
      fireEvent.pointerDown(plot, { shiftKey: true });
      expect([...stores.ui.selectedTileIds]).toEqual([model.id]);
    });

    it("toggles out of the selection on a Shift-click elsewhere in the tile", () => {
      const { title } = renderInTile();
      fireEvent.pointerDown(title, { shiftKey: true });
      expect([...stores.ui.selectedTileIds]).toEqual([]);
    });

    // jsdom sends no mousedown after a pointerdown, so this can't check that canceling the pointerdown,
    // as the Full Timeline does, leaves selection working; it checks that selection uses the pointerdown.
    it("is selected by a pointerdown on a control within the tile", () => {
      const { fullTimeline } = renderInTile("other-tile");
      fireEvent.pointerDown(fullTimeline);
      expect([...stores.ui.selectedTileIds]).toEqual([model.id]);
    });
  });
});
