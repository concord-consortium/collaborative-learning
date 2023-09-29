import React from "react";
import {render, screen} from "@testing-library/react";

import { defaultTextContent } from "../../../models/tiles/text/text-content";
import { ITileModel, TileModel } from "../../../models/tiles/tile-model";
import { specStores } from "../../../models/stores/spec-stores";
import { ModalProvider } from "@concord-consortium/react-modal-hook";
import { Provider } from "mobx-react";
import TextToolComponent from "./text-tile";
import { ITileProps } from "../tile-component";

export interface ISpecTextTileOptions {
  tileModel?: ITileModel
}

export function specTextTile(options: ISpecTextTileOptions) {
  const model = options.tileModel || TileModel.create({content: defaultTextContent()});

  const stores = specStores();

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
    onRequestUniqueTitle: (tileId) => {
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

  const textTile = React.createRef<TextToolComponent>();

  render(
    <ModalProvider>
      <Provider stores={stores}>
        <TextToolComponent ref={textTile} {...defaultProps} />
      </Provider>
    </ModalProvider>
  );

  return {
    plugins: textTile?.current?.plugins,
    textTile: textTile.current
  };
}
