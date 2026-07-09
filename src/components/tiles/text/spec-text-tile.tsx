import React from "react";
import { Provider } from "mobx-react";
import { ModalProvider } from "@concord-consortium/react-modal-hook";
import { render } from "@testing-library/react";

import { defaultTextContent } from "../../../models/tiles/text/text-content";
import { ITileModel, TileModel } from "../../../models/tiles/tile-model";
import { specStores } from "../../../models/stores/spec-stores";
import { specAppConfig } from "../../../models/stores/spec-app-config";
import TextToolComponent from "./text-tile";
import { ITileProps } from "../tile-component";
import { ITileApi, TileModelContext } from "../tile-api";

export interface ISpecTextTileOptions {
  tileModel?: ITileModel,
  readOnly?: boolean,
  showTextTitles?: boolean,
  onRegisterTileApi?: (tileApi: ITileApi, facet?: string) => void
}

export function specTextTile(options: ISpecTextTileOptions) {
  const model = options.tileModel || TileModel.create({content: defaultTextContent()});

  const stores = specStores({
    appConfig: specAppConfig({
      config: {
        showTextTitles: options.showTextTitles,
        settings: {
          "text": {
            "tools": [
              "bold",
              "italic",
              "underline",
              "highlight",
              "subscript",
              "superscript",
              "heading",
              "list-ol",
              "list-ul",
              "link",
              "voice-typing"
            ]
          }
        }
      }
      })
    });
  // Tests don't read from this element. `null` (allowed by the prop type) avoids
  // collisions when multiple specTextTile() calls share the same test root.
  const documentContent = null;

  const defaultProps: ITileProps = {
    model,
    tileElt: null,
    context: "",
    docId: "",
    documentContent,
    isUserResizable: true,
    readOnly: options.readOnly ?? false,
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
      options.onRegisterTileApi?.(tileApi, facet);
    },
    onUnregisterTileApi: (facet) => {
      // throw new Error("Function not implemented.");
    }
  };

  const textTile = React.createRef<TextToolComponent>();

  render(
    <ModalProvider>
      <TileModelContext.Provider value={model}>
        <Provider stores={stores}>
          <TextToolComponent ref={textTile} {...defaultProps} />
        </Provider>
      </TileModelContext.Provider>
    </ModalProvider>
  );

  return {
    plugins: textTile?.current?.plugins,
    textTile: textTile.current
  };
}
