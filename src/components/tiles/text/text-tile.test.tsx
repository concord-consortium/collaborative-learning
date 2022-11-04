import {render, screen} from "@testing-library/react";
import { Provider } from "mobx-react";
import React from "react";
import { ITileApi } from "../tile-api";
import { TileModel } from "../../../models/tiles/tile-model";
import { specStores } from "../../../models/stores/spec-stores";
import { ModalProvider } from "react-modal-hook";
import { defaultTextContent } from "../../../models/tiles/text/text-content";
import TextToolComponent from "./text-tile";

// The text tile needs to be registered so the TileModel.create
// knows it is a supported tile type
import "../../../models/tiles/text/text-registration";

describe("TextToolComponent", () => {
  const stores = specStores();

  const content = defaultTextContent();
  const model = TileModel.create({content});

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
    onRegisterTileApi: (toolApi: ITileApi, facet?: string): void => {
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
          <TextToolComponent {...defaultProps} {...{model}} />
        </Provider>
      </ModalProvider>
  );
    expect(screen.getByTestId("text-tool-wrapper")).toBeInTheDocument();
    expect(screen.getByTestId("ccrte-editor")).toBeInTheDocument();
  });
});
