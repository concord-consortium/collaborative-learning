import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { ITileApi } from "../../components/tiles/tile-api";
import { TileModel } from "../../models/tiles/tile-model";
import { defaultNumberlineContent } from "./numberline-content";
import { NumberlineToolComponent } from "./numberline-tile";

// The numberline tile needs to be registered so the TileModel.create
// knows it is a supported tile type
import "./numberline-registration";

describe("NumberlineToolComponent", () => {
  const content = defaultNumberlineContent();
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
    onRequestTilesOfType: (tileType: string): { id: string; title?: string | undefined; }[] => {
      throw new Error("Function not implemented.");
    },
    onRequestUniqueTitle: (tileId: string): string | undefined => {
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
      render(<NumberlineToolComponent  {...defaultProps} {...{model}}></NumberlineToolComponent>);
    expect(getByText("Numberline Tile")).toBeInTheDocument();
  });

  it.skip("updates the text when the model changes", async () => {
    const {findByText} =
      render(<NumberlineToolComponent  {...defaultProps} {...{model}}></NumberlineToolComponent>);
    // expect(getByText("Numberline Tile")).toBeInTheDocument();
    expect(await findByText("New Text")).toBeInTheDocument();
  });

  it.skip("updates the model when the user types", () => {
    const {getByRole} =
      render(<NumberlineToolComponent  {...defaultProps} {...{model}}></NumberlineToolComponent>);
    // expect(getByText("New Text")).toBeInTheDocument();
    const textBox = getByRole("textbox");
    userEvent.type(textBox, "{selectall}{del}Typed Text");

    expect(textBox).toHaveValue("Typed Text");
  });
});
