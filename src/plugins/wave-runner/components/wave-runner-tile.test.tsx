// Mock uPlot — canvas won't work in jsdom
jest.mock("uplot", () => {
  return jest.fn().mockImplementation(() => ({
    setData: jest.fn(),
    setSize: jest.fn(),
    destroy: jest.fn(),
  }));
});

import { act, render, screen } from "@testing-library/react";
import { Provider } from "mobx-react";
import React from "react";
import "../../../models/tiles/table/table-registration";
import { TileModel } from "../../../models/tiles/tile-model";
import { TileModelContext } from "../../../components/tiles/tile-api";
import { specStores } from "../../../models/stores/spec-stores";
import { specAppConfig } from "../../../models/stores/spec-app-config";
import { defaultWaveRunnerContent } from "../models/wave-runner-content";
import { kWaveRunnerDefaultHeight, kWaveRunnerStackedHeight } from "../wave-runner-types";
import { WaveRunnerComponent } from "./wave-runner-tile";

// The wave-runner tile needs to be registered so the TileModel.create
// knows it is a supported tile type
import "../wave-runner-registration";

let mockWidth: number | undefined;
jest.mock("react-resize-detector", () => ({
  useResizeDetector: () => ({ width: mockWidth, ref: React.createRef() })
}));

describe("WaveRunnerComponent", () => {
  const content = defaultWaveRunnerContent();
  const model = TileModel.create({ content });

  const defaultProps = {
    tileElt: null,
    context: "",
    docId: "",
    documentContent: null,
    isUserResizable: true,
    readOnly: false,
    onResizeRow: () => { throw new Error("Function not implemented."); },
    onSetCanAcceptDrop: () => { throw new Error("Function not implemented."); },
    onRequestRowHeight: jest.fn(),
    onRegisterTileApi: () => { throw new Error("Function not implemented."); },
    onUnregisterTileApi: () => { throw new Error("Function not implemented."); }
  };

  const stores = specStores({
    appConfig: specAppConfig({
      config: {
        settings: {
          "wave-runner": {
            tools: ["load-data", "|", "play", "restart", "reset", "|", ["data-set-view", "Table"], "timeline"],
          stations: [
            { network: "AK", station: "K204", channel: "HNZ", label: "Anchorage Airport" },
            { network: "AK", station: "DDM", location: "01", channel: "HNZ", label: "Dexter Display Mine" }
          ],
          defaultStation: 0,
          models: [
            { label: "Compact Model", metadataUrl: "https://models.example.com/v1/compact-v2/metadata.json" },
            { label: "Placeholder (random weights)", metadataUrl: "placeholder:random-weights" }
          ],
          defaultModel: null
          }
        }
      }
    })
  });

  function renderModel(model2: ReturnType<typeof TileModel.create>,
                      overrides: Partial<typeof defaultProps> = {}) {
    stores.ui.setSelectedTileId(model2.id);
    return render(
      <Provider stores={stores}>
        <TileModelContext.Provider value={model2}>
          <WaveRunnerComponent {...defaultProps} {...overrides} {...{model: model2}} />
        </TileModelContext.Provider>
      </Provider>
    );
  }

  function renderWithStores(overrides: Partial<typeof defaultProps> = {}) {
    return renderModel(model, overrides);
  }

  beforeEach(() => {
    mockWidth = undefined;
  });

  it("renders an editable tile title", () => {
    const { container } = renderWithStores();
    expect(container.querySelector(".title-area")).toBeInTheDocument();
  });

  it("renders the wave-runner-content area", () => {
    const { container } = renderWithStores();
    expect(container.querySelector(".wave-runner-content")).toBeInTheDocument();
  });

  it("renders the title background", () => {
    const { container } = renderWithStores();
    expect(container.querySelector(".title-background")).toBeInTheDocument();
  });

  it("renders the data-setup section with title", () => {
    const { container } = renderWithStores();
    const title = container.querySelector(".section-title");
    expect(title?.textContent).toBe("Data Setup");
  });

  it("renders the status-and-output section with title", () => {
    renderWithStores();
    expect(screen.getByText("Status and Output")).toBeInTheDocument();
  });

  it("stacks sections vertically when width is undefined", () => {
    mockWidth = undefined;
    const { container } = renderWithStores();
    const sections = container.querySelector(".sections");
    expect(sections).toHaveClass("vertical");
    expect(sections).not.toHaveClass("horizontal");
  });

  // The tile asks for a height it knows rather than measuring: one panel's worth side by side,
  // two when the panels stack.
  it("asks for the stacked height when the panels stack", () => {
    mockWidth = 650;
    const onRequestRowHeight = jest.fn();
    renderWithStores({ onRequestRowHeight });
    expect(onRequestRowHeight).toHaveBeenCalledWith(expect.any(String), kWaveRunnerStackedHeight);
  });

  it("asks for the single-panel height when the panels sit side by side", () => {
    mockWidth = 900;
    const onRequestRowHeight = jest.fn();
    renderWithStores({ onRequestRowHeight });
    expect(onRequestRowHeight).toHaveBeenCalledWith(expect.any(String), kWaveRunnerDefaultHeight);
  });

  // The same document can render editable and read-only at different widths at once (four-up,
  // published documents); onRequestRowHeight mutates the shared row model, so a read-only instance
  // must not fight the editable one over the row's height.
  it("does not request a row height in a read-only rendering", () => {
    mockWidth = 900;
    const onRequestRowHeight = jest.fn();
    renderWithStores({ onRequestRowHeight, readOnly: true });
    expect(onRequestRowHeight).not.toHaveBeenCalled();
  });

  it("stacks sections vertically when width is less than 450", () => {
    mockWidth = 650;
    const { container } = renderWithStores();
    const sections = container.querySelector(".sections");
    expect(sections).toHaveClass("vertical");
    expect(sections).not.toHaveClass("horizontal");
  });

  it("stacks sections horizontally when width is 450 or greater", () => {
    mockWidth = 700;
    const { container } = renderWithStores();
    const sections = container.querySelector(".sections");
    expect(sections).toHaveClass("horizontal");
    expect(sections).not.toHaveClass("vertical");
  });

  it("renders date pickers with default values", () => {
    renderWithStores();
    const startGroup = screen.getByRole("group", { name: "Start Date and Time" });
    const endGroup = screen.getByRole("group", { name: "End Date and Time" });
    expect(startGroup).toHaveTextContent("09/01/2026");
    expect(endGroup).toHaveTextContent("10/01/2026");
  });

  it("renders station dropdown with options from config", () => {
    const { container } = renderWithStores();
    const stationItems = container.querySelectorAll('[data-testid="wave-runner-station-list"] .list-item .item');
    const labels = Array.from(stationItems).map(el => el.textContent);
    expect(labels).toEqual(["Anchorage Airport", "Dexter Display Mine"]);
  });

  it("auto-selects the default station on mount", () => {
    const model2 = TileModel.create({ content: defaultWaveRunnerContent() });
    renderModel(model2);
    const tileContent = model2.content as any;
    expect(tileContent.station?.network).toBe("AK");
    expect(tileContent.station?.station).toBe("K204");
  });

  it("renders all toolbar buttons", () => {
    renderWithStores();
    const toolbar = screen.getByTestId("tile-toolbar");
    expect(toolbar).toContainHTML("Load Data");
    expect(toolbar).toContainHTML("Run Model");
    expect(toolbar).toContainHTML("Restart Model");
    expect(toolbar).toContainHTML("Clear &amp; Reset Model");
    expect(toolbar).toContainHTML("Table It!");
    expect(toolbar).toContainHTML("Timeline It!");
  });

  it("disables Load Data without portal credentials", () => {
    renderWithStores();
    const button = screen.getByRole("button", { name: "Load Data" });
    expect(button).toHaveAttribute("aria-disabled", "true");
  });

  it("enables Load Data when the session has portal credentials and a station", () => {
    stores.portal.rawPortalJWT = "portal-jwt";
    stores.portal.basePortalUrl = "https://learn.example.com/";
    try {
      renderWithStores();
      const button = screen.getByRole("button", { name: "Load Data" });
      expect(button).not.toHaveAttribute("aria-disabled");
    } finally {
      stores.portal.rawPortalJWT = undefined as any;
      stores.portal.basePortalUrl = undefined;
    }
  });

  it("renders model dropdown with available models", () => {
    renderWithStores();
    expect(screen.getByText("Choose a model")).toBeInTheDocument();
    expect(screen.getByText("Compact Model")).toBeInTheDocument();
  });

  it("shows envelope load progress while loading", async () => {
    const content2 = defaultWaveRunnerContent();
    const model2 = TileModel.create({ content: content2 });
    content2.setStation({ network: "AK", station: "K204", location: "", channel: "HNZ", label: "Anchorage" });
    let resolveRun: (v: unknown) => void = () => undefined;
    const processEnvelopes = jest.fn((opts: any) => {
      opts.onProgress(2, 5);
      return new Promise(res => { resolveRun = res; });
    });
    const pending = content2.loadEnvelopeData({
      getJwt: async () => "jwt",
      uploader: { uploadTile: jest.fn().mockResolvedValue(undefined) },
      processEnvelopes: processEnvelopes as any,
    });
    renderModel(model2);
    expect(screen.getByText("Loading data: day 3 of 5...")).toBeInTheDocument();
    await act(async () => {
      resolveRun({ uploadedTiles: 0, processedDays: 0, skippedDays: 0, totalDays: 5 });
      await pending;
    });
  });

  it("shows envelope load errors", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const content2 = defaultWaveRunnerContent();
      const model2 = TileModel.create({ content: content2 });
      content2.setStation({ network: "AK", station: "K204", location: "", channel: "HNZ", label: "Anchorage" });
      await content2.loadEnvelopeData({
        getJwt: async () => "jwt",
        uploader: { uploadTile: jest.fn().mockResolvedValue(undefined) },
        processEnvelopes: jest.fn().mockRejectedValue(new Error("no credentials")) as any,
      });
      renderModel(model2);
      expect(screen.getByText("Error loading data: no credentials")).toBeInTheDocument();
    } finally {
      consoleSpy.mockRestore();
    }
  });
});
