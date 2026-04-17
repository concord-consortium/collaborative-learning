// Mock uPlot — canvas won't work in jsdom
jest.mock("uplot", () => {
  return jest.fn().mockImplementation(() => ({
    setData: jest.fn(),
    setSize: jest.fn(),
    destroy: jest.fn(),
  }));
});

import { render, screen } from "@testing-library/react";
import { Provider } from "mobx-react";
import React from "react";
import { TileModel } from "../../../models/tiles/tile-model";
import { TileModelContext } from "../../../components/tiles/tile-api";
import { specStores } from "../../../models/stores/spec-stores";
import { specAppConfig } from "../../../models/stores/spec-app-config";
import "../../../models/tiles/table/table-registration";
import "../../bar-graph/bar-graph-registration";
import "../../data-card/data-card-registration";
import { defaultTimelineContent } from "../models/timeline-content";
import { TimelineComponent } from "./timeline-tile";

// The timeline tile needs to be registered so the TileModel.create
// knows it is a supported tile type
import "../timeline-registration";

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
              "|", "zoom-in", "zoom-out", "view-all"
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
  });
});
