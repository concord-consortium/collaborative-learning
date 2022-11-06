import { render, screen } from "@testing-library/react";
import React from "react";
import { ITileApi } from "../../../components/tiles/tile-api";
import { TileModel } from "../../../models/tiles/tile-model";
import { Provider } from "mobx-react";
import { specStores } from "../../../models/stores/spec-stores";
import { ModalProvider } from "react-modal-hook";
import { createDrawingContent } from "../model/drawing-content";
import DrawingToolComponent from "./drawing-tile";

// The starter tile needs to be registered so the TileModel.create
// knows it is a supported tile type
import "../drawing-registration";


describe("DrawingToolComponent", () => {

  const stores = specStores();

  const content = createDrawingContent();
  const model = TileModel.create({content});
  model.setTitle('A Title for Testing');
  render(<div className="document-content" data-testid="document-content"/>);
  const documentContent = screen.getByTestId("document-content");

  const defaultProps = {
    tileElt: null,
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
    onRegisterTileApi: (tileApi: ITileApi, facet?: string): void => {
      // throw new Error("Function not implemented.");
    },
    onUnregisterTileApi: (facet?: string): void => {
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
    expect(screen.getByText("A Title for Testing")).toBeInTheDocument();
  });
});
