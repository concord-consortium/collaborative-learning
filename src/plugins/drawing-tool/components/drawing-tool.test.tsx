import { render, screen } from "@testing-library/react";
import React from "react";
import { IToolApi } from "../../../components/tools/tool-api";
import { ToolTileModel } from "../../../models/tools/tool-tile";
import { Provider } from "mobx-react";
import { specStores } from "../../../models/stores/spec-stores";
import { ModalProvider } from "react-modal-hook";
import { createDrawingContent } from "../model/drawing-content";
import DrawingToolComponent from "./drawing-tool";

// The starter tile needs to be registered so the ToolTileModel.create
// knows it is a supported tile type
import "../drawing-registration";


describe("DrawingToolComponent", () => {

  const stores = specStores();

  const content = createDrawingContent();
  const model = ToolTileModel.create({content});

  render(<div className="document-content" data-testid="document-content"/>);
  const documentContent = screen.getByTestId("document-content");

  const defaultProps = {
    toolTile: null,
    context: "",
    docId: "",
    documentContent,
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
      throw new Error("Function not implemented.");
    },
    onRequestRowHeight: (tileId: string, height?: number, deltaHeight?: number): void => {
      throw new Error("Function not implemented.");
    },
    onRegisterToolApi: (toolApi: IToolApi, facet?: string): void => {
      // throw new Error("Function not implemented.");
    },
    onUnregisterToolApi: (facet?: string): void => {
      // throw new Error("Function not implemented.");
    }
  };

  it("renders successfully", () => {
    render(
      <ModalProvider>
        <Provider stores={stores}>
          <DrawingToolComponent {...defaultProps} {...{model}} />
        </Provider>
      </ModalProvider>
  );
    expect(screen.getByTestId("drawing-tool")).toBeInTheDocument();
    expect(screen.getByTestId("drawing-toolbar")).toBeInTheDocument();
  });
});

