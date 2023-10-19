import React, { useRef } from "react";
import { Provider } from "mobx-react";
import { render, screen } from "@testing-library/react";
import { TileToolbarButton } from "./tile-toolbar-button";
import { registerTileToolbarButtons, registerTileToolbarConfig } from "./toolbar-button-manager";
import { TileToolbar } from "./tile-toolbar";
import { ITileModel, TileModel } from "../../models/tiles/tile-model";
import { defaultTextContent } from "../../models/tiles/text/text-content";
import { specStores } from "../../models/stores/spec-stores";
import { TileModelContext } from "../tiles/tile-api";

import CopyIcon from "../../../assets/icons/copy/copy-icon-default.svg";

// The text tile needs to be registered so the TileModel.create
// knows it is a supported tile type
import "../../models/tiles/text/text-registration";
import { specAppConfig } from "../../models/stores/spec-app-config";

const clickHandler = jest.fn();

function SampleToolbarButton() {
  return <TileToolbarButton name="test-button" onClick={clickHandler}><CopyIcon/></TileToolbarButton>;
}

const sampleButtons = [
  {
    name: "default",
    title: "Default Button",
    component: SampleToolbarButton,
  },
  {
    name: "non-default",
    title: "Non-default button",
    component: SampleToolbarButton,
  }
];

interface ISampleTileProps {
  type: string;
  model: ITileModel;
}

function SampleTile({type, model}: ISampleTileProps) {
  const tileElt = useRef<HTMLDivElement>(null);
  return (
    <TileModelContext.Provider value={model}>
      <div ref={tileElt}>
        Tile content.
      </div>
      <TileToolbar readOnly={false} tileElement={tileElt.current} tileType={type} />
    </TileModelContext.Provider>
  );
}

describe("Tile toolbar button", () => {

  it("can render a button", () => {
    render(<TileToolbarButton name="test-button" onClick={clickHandler}><CopyIcon/></TileToolbarButton>);

    expect(screen.getByRole("button")).toBeInTheDocument();
    expect(screen.getByRole("button")).toContainHTML("<svg");
    screen.getByRole("button").click();
    expect(clickHandler).toHaveBeenCalledTimes(1);
  });

  it("can register buttons and render default toolbar", () => {
    const model = TileModel.create({content: defaultTextContent()});
    const stores = specStores();
    stores.ui.setSelectedTileId(model.id);

    registerTileToolbarButtons("test", sampleButtons);
    registerTileToolbarConfig("test", ["default"]);

    render(
      <Provider stores={stores}>
        <SampleTile type="test" model={model}/>
      </Provider>
    );
    expect(screen.getByTestId("tile-toolbar")).toBeInTheDocument();
    expect(screen.getByTestId("tile-toolbar")).toContainHTML("Default Button");
    expect(screen.getByTestId("tile-toolbar")).not.toContainHTML("Non-default Button");
  });

  it("can read tools list from app configuration", () => {
    const model = TileModel.create({content: defaultTextContent()});
    const stores = specStores({
      appConfig: specAppConfig({
        config: {
          settings: {
            test: {
              tools: ["default"]
            }
          }
        }
        })
      });
    stores.ui.setSelectedTileId(model.id);

    registerTileToolbarButtons("test", sampleButtons);

    render(
      <Provider stores={stores}>
        <SampleTile type="test" model={model}/>
      </Provider>
    );
    expect(screen.getByTestId("tile-toolbar")).toBeInTheDocument();
    expect(screen.getByTestId("tile-toolbar")).toContainHTML("Default Button");
    expect(screen.getByTestId("tile-toolbar")).not.toContainHTML("Non-default Button");

  });

});
