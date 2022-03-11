import { render, waitFor } from "@testing-library/react";
import React from "react";
import { IToolApi } from "../../components/tools/tool-api";
import { ToolTileModel } from "../../models/tools/tool-tile";
import { StarterContentModel } from "./starter-content";
import { StarterToolComponent } from "./starter-tool";

// The starter tile needs tob e registered so the ToolTileModel.create
// knows about it as a supported tile type
import "./starter-registration";
import userEvent from "@testing-library/user-event";

describe("StarterToolComponent", () => {
  const content = StarterContentModel.create();
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
      render(<StarterToolComponent  {...defaultProps} {...{model}}></StarterToolComponent>);
    expect(getByText("Hello World")).toBeInTheDocument();
  });

  it("updates the text when the model changes", () => {
    const {getByText} = 
      render(<StarterToolComponent  {...defaultProps} {...{model}}></StarterToolComponent>);
    expect(getByText("Hello World")).toBeInTheDocument();

    content.setText("New Text");

    expect(getByText("New Text")).toBeInTheDocument();
  });

  it("updates the model when the user types", () => {
    const {getByRole, getByText} = 
      render(<StarterToolComponent  {...defaultProps} {...{model}}></StarterToolComponent>);
    expect(getByText("New Text")).toBeInTheDocument();

    const textBox = getByRole("textbox");
    userEvent.type(textBox, "{selectall}{del}Typed Text");

    expect(textBox).toHaveValue("Typed Text");
    expect(content.text).toBe("Typed Text");
  });
});
