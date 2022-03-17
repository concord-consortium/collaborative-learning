import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { IToolApi } from "../../components/tools/tool-api";
import { ToolTileModel } from "../../models/tools/tool-tile";
import { defaultVListContent, VListContentModel } from "./vlist-content";
import { VListToolComponent } from "./vlist-tool";

// The vlist tile needs to be registered so the ToolTileModel.create
// knows it is a supported tile type
import "./vlist-registration";

describe("VListToolComponent", () => {
  const content = defaultVListContent();
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
      render(<VListToolComponent  {...defaultProps} {...{model}}></VListToolComponent>);
    expect(getByText("Hello World")).toBeInTheDocument();
  });

  it("updates the list when the model changes", async () => {
    const {getByText, findByText} = 
      render(<VListToolComponent  {...defaultProps} {...{model}}></VListToolComponent>);
    expect(getByText("Hello World")).toBeInTheDocument();

    content.addVariable("New Variable");

    expect(await findByText("Hello World")).toBeInTheDocument();
    expect(await findByText("New Variable")).toBeInTheDocument();
  });

  // it("updates the model when the user types", () => {
  //   const {getByRole, getByText} = 
  //     render(<VListToolComponent  {...defaultProps} {...{model}}></VListToolComponent>);
  //   expect(getByText("New Text")).toBeInTheDocument();

  //   const textBox = getByRole("textbox");
  //   userEvent.type(textBox, "{selectall}{del}Typed Text");

  //   expect(textBox).toHaveValue("Typed Text");
  //   expect(content.text).toBe("Typed Text");
  // });
});
