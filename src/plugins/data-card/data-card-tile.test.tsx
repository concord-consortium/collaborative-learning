import React from "react";
import { Provider } from "mobx-react";
import { render } from "@testing-library/react";
import { ModalProvider } from "@concord-consortium/react-modal-hook";
import { ITileApi, TileModelContext } from "../../components/tiles/tile-api";
import { specStores } from "../../models/stores/spec-stores";
import { TileModel } from "../../models/tiles/tile-model";
import { defaultDataCardContent } from "./data-card-content";
import { DataCardToolComponent } from "./data-card-tile";

// The data card tile needs to be registered so the TileModel.create
// knows it is a supported tile type
import "./data-card-registration";

// mock Logger calls
const mockLogTileDocumentEvent = jest.fn();
jest.mock("../../models/tiles/log/log-tile-document-event", () => ({
  logTileDocumentEvent: (...args: any[]) => mockLogTileDocumentEvent()
}));

describe("DataCardToolComponent", () => {
  const stores = specStores();
  const content = defaultDataCardContent();
  const model = TileModel.create({content});

  const defaultProps = {
    tileElt: null,
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
    onRequestRowHeight: (tileId: string, height?: number, deltaHeight?: number): void => {
      // throw new Error("Function not implemented.");
    },
    onRegisterTileApi: (tileApi: ITileApi, facet?: string): void => {
      // throw new Error("Function not implemented.");
    },
    onUnregisterTileApi: (facet?: string): void => {
      // throw new Error("Function not implemented.");
    }
  };

  it("renders successfully", () => {
    const {getByText} =
      render(
        <ModalProvider>
          <Provider stores={stores}>
            <TileModelContext.Provider value={model}>
              <DataCardToolComponent  {...defaultProps} {...{model}}></DataCardToolComponent>
            </TileModelContext.Provider >
          </Provider>
        </ModalProvider>
      );
      expect(getByText("Data Card Collection 1")).toBeInTheDocument();
  });
});
