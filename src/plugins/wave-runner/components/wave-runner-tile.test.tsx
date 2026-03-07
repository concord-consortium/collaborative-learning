import { render, screen } from "@testing-library/react";
import { Provider } from "mobx-react";
import React from "react";
import { TileModel } from "../../../models/tiles/tile-model";
import { TileModelContext } from "../../../components/tiles/tile-api";
import { specStores } from "../../../models/stores/spec-stores";
import { specAppConfig } from "../../../models/stores/spec-app-config";
import { defaultWaveRunnerContent } from "../models/wave-runner-content";
import { WaveRunnerComponent } from "./wave-runner-tile";

// The wave-runner tile needs to be registered so the TileModel.create
// knows it is a supported tile type
import "../wave-runner-registration";

let mockWidth: number | undefined;
jest.mock("react-resize-detector", () => ({
  useResizeDetector: () => ({ width: mockWidth, ref: React.createRef() })
}));

describe("WaveRunnerToolComponent", () => {
  const content = defaultWaveRunnerContent();
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
          "wave-runner": {
            tools: ["load-data", "|", "play", "restart", "reset", "|", "timeline"]
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
          <WaveRunnerComponent {...defaultProps} {...{model}} />
        </TileModelContext.Provider>
      </Provider>
    );
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

  it("renders all toolbar buttons", () => {
    renderWithStores();
    const toolbar = screen.getByTestId("tile-toolbar");
    expect(toolbar).toContainHTML("Load Data");
    expect(toolbar).toContainHTML("Run Model");
    expect(toolbar).toContainHTML("Restart Model");
    expect(toolbar).toContainHTML("Clear &amp; Reset Model");
    expect(toolbar).toContainHTML("Timeline It!");
  });
});
