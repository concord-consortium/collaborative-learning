import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { IToolApi } from "../../components/tools/tool-api";
import { ToolTileModel } from "../../models/tools/tool-tile";
import { defaultDeckContent, DeckContentModel } from "./deck-content";
import { DeckToolComponent } from "./deck-tool";

// The deck tile needs to be registered so the ToolTileModel.create
// knows it is a supported tile type
import "./deck-registration";

describe("DeckToolComponent", () => {
  const content = defaultDeckContent();
  const model = ToolTileModel.create({content});

  const defaultProps = {
    toolTile: null,
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
    onRequestTilesOfType: (tileType: string): { id: string; title?: string | undefined; }[] => {
      throw new Error("Function not implemented.");
    },
    onRequestUniqueTitle: (tileId: string): string | undefined => {
      throw new Error("Function not implemented.");
    },
    onRequestRowHeight: (tileId: string, height?: number, deltaHeight?: number): void => {
      throw new Error("Function not implemented.");
    },
    onRegisterToolApi: (toolApi: IToolApi, facet?: string): void => {
      throw new Error("Function not implemented.");
    },
    onUnregisterToolApi: (facet?: string): void => {
      throw new Error("Function not implemented.");
    }
  };

  it("renders successfully", () => {
    const {getByText} =
      render(<DeckToolComponent  {...defaultProps} {...{model}}></DeckToolComponent>);
    expect(getByText("Hello World")).toBeInTheDocument();
  });

  it("updates the text when the model changes", async () => {
    const {getByText, findByText} =
      render(<DeckToolComponent  {...defaultProps} {...{model}}></DeckToolComponent>);
    expect(getByText("Hello World")).toBeInTheDocument();

    content.setText("New Text");

    expect(await findByText("New Text")).toBeInTheDocument();
  });

  it("updates the model when the user types", () => {
    const {getByRole, getByText} =
      render(<DeckToolComponent  {...defaultProps} {...{model}}></DeckToolComponent>);
    expect(getByText("New Text")).toBeInTheDocument();

    const textBox = getByRole("textbox");
    userEvent.type(textBox, "{selectall}{del}Typed Text");

    expect(textBox).toHaveValue("Typed Text");
    expect(content.text).toBe("Typed Text");
  });
});
