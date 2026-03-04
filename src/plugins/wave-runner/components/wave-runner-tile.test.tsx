import { render } from "@testing-library/react";
import React from "react";
import { TileModel } from "../../../models/tiles/tile-model";
import { defaultWaveRunnerContent } from "../models/wave-runner-content";
import { WaveRunnerToolComponent } from "./wave-runner-tile";

// The wave-runner tile needs to be registered so the TileModel.create
// knows it is a supported tile type
import "../wave-runner-registration";

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

  it("renders an editable tile title", () => {
    const {container} =
      render(<WaveRunnerToolComponent {...defaultProps} {...{model}} />);
    expect(container.querySelector(".title-area")).toBeInTheDocument();
  });

  it("renders the wave-runner-content area", () => {
    const {container} =
      render(<WaveRunnerToolComponent {...defaultProps} {...{model}} />);
    expect(container.querySelector(".wave-runner-content")).toBeInTheDocument();
  });

  it("renders the title background", () => {
    const {container} =
      render(<WaveRunnerToolComponent {...defaultProps} {...{model}} />);
    expect(container.querySelector(".wave-runner-title-background")).toBeInTheDocument();
  });

  it("renders the data-setup section with title", () => {
    const {getByText} =
      render(<WaveRunnerToolComponent {...defaultProps} {...{model}} />);
    expect(getByText("Data Setup")).toBeInTheDocument();
  });

  it("renders the status-and-output section with title", () => {
    const {getByText} =
      render(<WaveRunnerToolComponent {...defaultProps} {...{model}} />);
    expect(getByText("Status and Output")).toBeInTheDocument();
  });
});
