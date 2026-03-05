import { render } from "@testing-library/react";
import React from "react";
import { TileModel } from "../../../models/tiles/tile-model";
import { defaultWaveRunnerContent } from "../models/wave-runner-content";
import { WaveRunnerComponent } from "./wave-runner-tile";

// The wave-runner tile needs to be registered so the TileModel.create
// knows it is a supported tile type
import "../wave-runner-registration";

// Mock the TileToolbar since it requires store providers not available in this test
jest.mock("../../../components/toolbar/tile-toolbar", () => ({
  TileToolbar: () => null
}));

let mockWidth: number | undefined;
jest.mock("react-resize-detector", () => ({
  useResizeDetector: () => ({ width: mockWidth, ref: React.createRef() })
}));

describe("WaveRunnerToolComponent", () => {
  const content = defaultWaveRunnerContent();
  const model = TileModel.create({content});

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

  beforeEach(() => {
    mockWidth = undefined;
  });

  it("renders an editable tile title", () => {
    const { container } = render(<WaveRunnerComponent {...defaultProps} {...{model}} />);
    expect(container.querySelector(".title-area")).toBeInTheDocument();
  });

  it("renders the wave-runner-content area", () => {
    const { container } = render(<WaveRunnerComponent {...defaultProps} {...{model}} />);
    expect(container.querySelector(".wave-runner-content")).toBeInTheDocument();
  });

  it("renders the title background", () => {
    const { container } = render(<WaveRunnerComponent {...defaultProps} {...{model}} />);
    expect(container.querySelector(".title-background")).toBeInTheDocument();
  });

  it("renders the data-setup section with title", () => {
    const { container } = render(<WaveRunnerComponent {...defaultProps} {...{model}} />);
    const title = container.querySelector(".section-title");
    expect(title?.textContent).toBe("Data Setup");
  });

  it("renders the status-and-output section with title", () => {
    const { getByText } = render(<WaveRunnerComponent {...defaultProps} {...{model}} />);
    expect(getByText("Status and Output")).toBeInTheDocument();
  });

  it("stacks sections vertically when width is undefined", () => {
    mockWidth = undefined;
    const { container } = render(<WaveRunnerComponent {...defaultProps} {...{model}} />);
    const sections = container.querySelector(".sections");
    expect(sections).toHaveClass("vertical");
    expect(sections).not.toHaveClass("horizontal");
  });

  it("stacks sections vertically when width is less than 450", () => {
    mockWidth = 650;
    const { container } = render(<WaveRunnerComponent {...defaultProps} {...{model}} />);
    const sections = container.querySelector(".sections");
    expect(sections).toHaveClass("vertical");
    expect(sections).not.toHaveClass("horizontal");
  });

  it("stacks sections horizontally when width is 450 or greater", () => {
    mockWidth = 700;
    const { container } = render(<WaveRunnerComponent {...defaultProps} {...{model}} />);
    const sections = container.querySelector(".sections");
    expect(sections).toHaveClass("horizontal");
    expect(sections).not.toHaveClass("vertical");
  });
});
