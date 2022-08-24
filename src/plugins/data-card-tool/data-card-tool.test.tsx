import { render } from "@testing-library/react";
import React from "react";
import { IToolApi } from "../../components/tools/tool-api";
import { ToolTileModel } from "../../models/tools/tool-tile";
import { defaultDataCardContent } from "./data-card-content";
import { DataCardToolComponent } from "./data-card-tool";

// The data card tile needs to be registered so the ToolTileModel.create
// knows it is a supported tile type
import "./data-card-registration";

jest.mock("../../hooks/use-stores", () => ({
  useUIStore: () => ({
    selectedTileIds: []
  })
}));

describe("DataCardToolComponent", () => {
  const content = defaultDataCardContent();
  const model = ToolTileModel.create({content});

  const defaultProps = {
    toolTile: null,
    context: "",
    docId: "",
    documentContent: null,
    isUserResizable: true,
    readOnly: false,
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
      return "Data Card Collection 1";
    },
    onRequestRowHeight: (tileId: string, height?: number, deltaHeight?: number): void => {
      throw new Error("Function not implemented.");
    },
    onRegisterToolApi: (toolApi: IToolApi, facet?: string): void => {
      // throw new Error("Function not implemented.");
    },
    onUnregisterToolApi: (facet?: string): void => {
      throw new Error("Function not implemented.");
    }
  };

  it("renders successfully", () => {
    const {getByText} =
      render(<DataCardToolComponent  {...defaultProps} {...{model}}></DataCardToolComponent>);
      expect(getByText("Data Card Collection 1")).toBeInTheDocument();
  });
});
