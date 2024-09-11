import React from "react";
import { render, getByText as globalGetByText } from "@testing-library/react";

import { ITileApi } from "../../components/tiles/tile-api";
import { TileModel } from "../../models/tiles/tile-model";
import { defaultBarGraphContent } from "./bar-graph-content";
import { BarGraphComponent } from "./bar-graph-tile";

// The tile needs to be registered so the TileModel.create
// knows it is a supported tile type
import "./bar-graph-registration";

jest.mock("react-resize-detector", () => ({
  useResizeDetector: jest.fn(() => ({height: 200, width: 200, ref: null}))
}));

jest.mock("./bar-graph-utils", () => ({
  getBBox: jest.fn(() => ({x: 0, y: 0, width: 500, height: 200}))
}));


describe("BarGraphComponent", () => {
  const content = defaultBarGraphContent();
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
    const {getByText, getByTestId} =
      render(<BarGraphComponent  {...defaultProps} {...{model}}></BarGraphComponent>);
    expect(getByText("Tile Title")).toBeInTheDocument();
    expect(getByTestId("bar-graph-content")).toBeInTheDocument();
    expect(globalGetByText(getByTestId("bar-graph-content"), "Counts")).toBeInTheDocument();
    expect(getByText("6/23/24")).toBeInTheDocument();
  });

  it.skip("updates the text when the model changes", async () => {
    const {getByTestId, findByText} =
      render(<BarGraphComponent  {...defaultProps} {...{model}}></BarGraphComponent>);
    expect(globalGetByText(getByTestId("bar-graph-content"), "Counts")).toBeInTheDocument();

    content.setYAxisLabel("New Text");

    expect(await findByText( "New Text")).toBeInTheDocument();
  });

});
