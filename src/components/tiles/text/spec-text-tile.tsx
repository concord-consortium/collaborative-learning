import React from "react";
import { Provider } from "mobx-react";
import { ModalProvider } from "@concord-consortium/react-modal-hook";
import { render, screen } from "@testing-library/react";

import { defaultTextContent } from "../../../models/tiles/text/text-content";
import { ITileModel, TileModel } from "../../../models/tiles/tile-model";
import { specStores } from "../../../models/stores/spec-stores";
import { specAppConfig } from "../../../models/stores/spec-app-config";
import TextToolComponent from "./text-tile";
import { ITileProps } from "../tile-component";
import { TileModelContext } from "../tile-api";

export interface ISpecTextTileOptions {
  tileModel?: ITileModel
}

export function specTextTile(options: ISpecTextTileOptions) {
  const model = options.tileModel || TileModel.create({content: defaultTextContent()});

  const stores = specStores({
    appConfig: specAppConfig({
      config: {
        settings: {
          "text": {
            "tools": [
              "bold",
              "italic",
              "underline",
              "subscript",
              "superscript",
              "list-ol",
              "list-ul",
              "link"
            ]
          }
        }
      }
      })
    });
  render(<div className="document-content" data-testid="document-content"/>);
  const documentContent = screen.getByTestId("document-content");

  const defaultProps: ITileProps = {
    model,
    tileElt: null,
    context: "",
    docId: "",
    documentContent,
    isUserResizable: true,
    readOnly: false,
    onResizeRow: (e) => {
      throw new Error("Function not implemented.");
    },
    onSetCanAcceptDrop: (tileId) => {
      throw new Error("Function not implemented.");
    },
    onRequestRowHeight: (tileId, height, deltaHeight) => {
      throw new Error("Function not implemented.");
    },
    onRegisterTileApi: (tileApi, facet) => {
      // throw new Error("Function not implemented.");
    },
    onUnregisterTileApi: (facet) => {
      // throw new Error("Function not implemented.");
    }
  };

  render(
    <ModalProvider>
      <TileModelContext.Provider value={model}>
        <Provider stores={stores}>
          <TextToolComponent {...defaultProps} />
        </Provider>
      </TileModelContext.Provider>
    </ModalProvider>
  );

  return {
    plugins: undefined, // plugins are no longer accessible from outside the component
    textTile: undefined // refs don't work with functional components
  };
}
