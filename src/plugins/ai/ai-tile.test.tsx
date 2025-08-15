import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { ITileApi } from "../../components/tiles/tile-api";
import { TileModel } from "../../models/tiles/tile-model";
import { defaultAIContent } from "./ai-content";
import { AIComponent } from "./ai-tile";

// The starter tile needs to be registered so the TileModel.create
// knows it is a supported tile type
import "./ai-registration";

describe("AIComponent", () => {
  const content = defaultAIContent();
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
    content.setPrompt("Hello World");
    const {getByText} =
      render(<AIComponent  {...defaultProps} {...{model}}></AIComponent>);
    expect(getByText("Hello World")).toBeInTheDocument();
  });

  it("updates the text when the model changes", async () => {
    content.setPrompt("Hello World");
    const {getByText, findByText} =
      render(<AIComponent  {...defaultProps} {...{model}}></AIComponent>);
    expect(getByText("Hello World")).toBeInTheDocument();

    content.setPrompt("New Text");

    expect(await findByText("New Text")).toBeInTheDocument();
  });

  it("updates the model when the user types", () => {
    content.setPrompt("New Text");
    const {getByRole, getByText} =
      render(<AIComponent  {...defaultProps} {...{model}}></AIComponent>);
    expect(getByText("New Text")).toBeInTheDocument();

    const textBox = getByRole("textbox");
    userEvent.type(textBox, "{selectall}{del}Typed Text");

    expect(textBox).toHaveValue("Typed Text");
    expect(content.prompt).toBe("Typed Text");
  });
});
