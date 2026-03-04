import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { ITileApi } from "../../components/tiles/tile-api";
import { TileModel } from "../../models/tiles/tile-model";
import { defaultWaveRunnerContent } from "./wave-runner-content";
import { WaveRunnerToolComponent } from "./wave-runner-tile";

// The wave-runner tile needs to be registered so the TileModel.create
// knows it is a supported tile type
import "./wave-runner-registration";

describe("WaveRunnerToolComponent", () => {
  const content = defaultWaveRunnerContent();
  const model = TileModel.create({content});

  const defaultProps = {
    tileElt: null,
    context: "",
    docId: "",
    documentContent: null,
    isUserResizable: true,
    onResizeRow: (e: React.DragEvent<HTMLDivElement>): void => {
      throw new Error("Function not implemented.");
    },
    onSetCanAcceptDrop: (tileId?: string): void => {
      throw new Error("Function not implemented.");
    },
    onRequestRowHeight: (tileId: string, height?: number, deltaHeight?: number): void => {
      throw new Error("Function not implemented.");
    },
    onRegisterTileApi: (tileApi: ITileApi, facet?: string): void => {
      throw new Error("Function not implemented.");
    },
    onUnregisterTileApi: (facet?: string): void => {
      throw new Error("Function not implemented.");
    }
  };

  it("renders successfully", () => {
    const {getByText} =
      render(<WaveRunnerToolComponent  {...defaultProps} {...{model}}></WaveRunnerToolComponent>);
    expect(getByText("Wave Runner Content")).toBeInTheDocument();
  });

  it("updates the text when the model changes", async () => {
    const {getByText, findByText} =
      render(<WaveRunnerToolComponent  {...defaultProps} {...{model}}></WaveRunnerToolComponent>);
    expect(getByText("Wave Runner Content")).toBeInTheDocument();

    content.setText("New Text");

    expect(await findByText("New Text")).toBeInTheDocument();
  });

  it("updates the model when the user types", () => {
    const {getByRole, getByText} =
      render(<WaveRunnerToolComponent  {...defaultProps} {...{model}}></WaveRunnerToolComponent>);
    expect(getByText("New Text")).toBeInTheDocument();

    const textBox = getByRole("textbox");
    userEvent.type(textBox, "{selectall}{del}Typed Text");

    expect(textBox).toHaveValue("Typed Text");
    expect(content.text).toBe("Typed Text");
  });
});