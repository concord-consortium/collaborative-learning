import React, { useRef } from "react";
import { Provider } from "mobx-react";
import { render, screen } from "@testing-library/react";
import { TileToolbarButton } from "./tile-toolbar-button";
import { registerTileToolbarButtons } from "./toolbar-button-manager";
import { TileToolbar } from "./tile-toolbar";
import { ITileModel, TileModel } from "../../models/tiles/tile-model";
import { defaultTextContent } from "../../models/tiles/text/text-content";
import { specStores } from "../../models/stores/spec-stores";
import { specAppConfig } from "../../models/stores/spec-app-config";
import { TileModelContext } from "../tiles/tile-api";

import CopyIcon from "../../../assets/icons/copy/copy-icon-default.svg";

// The text tile needs to be registered so the TileModel.create
// knows it is a supported tile type
import "../../models/tiles/text/text-registration";

const clickHandler = jest.fn();

function SampleToolbarButtonA() {
  return (
    <TileToolbarButton name="a" title="Test Button A" onClick={clickHandler}>
      <CopyIcon/>
    </TileToolbarButton>);
}

function SampleToolbarButtonB() {
  return (
    <TileToolbarButton name="b" title="Test Button B" onClick={clickHandler}>
      <CopyIcon/>
    </TileToolbarButton>);
}

const sampleButtons = [
  {
    name: "a",
    component: SampleToolbarButtonA,
  },
  {
    name: "b",
    component: SampleToolbarButtonB,
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
    render(
      <TileToolbarButton name="test-button" title="Test Button" onClick={clickHandler}>
        <CopyIcon/>
      </TileToolbarButton>);

    expect(screen.getByRole("button")).toBeInTheDocument();
    expect(screen.getByRole("button")).toContainHTML("<svg");
    screen.getByRole("button").click();
    expect(clickHandler).toHaveBeenCalledTimes(1);
  });

  it("can read tools list from app configuration", () => {
    const model = TileModel.create({content: defaultTextContent()});
    const stores = specStores({
      appConfig: specAppConfig({
        config: {
          settings: {
            test: {
              tools: ["b"]
            }
          }
        }
        })
      });
    stores.persistentUi.setSelectedTileId(model.id);

    registerTileToolbarButtons("test", sampleButtons);

    render(
      <Provider stores={stores}>
        <SampleTile type="test" model={model}/>
      </Provider>
    );
    expect(screen.getByTestId("tile-toolbar")).toBeInTheDocument();
    expect(screen.getByTestId("tile-toolbar")).toContainHTML("Test Button B");
    expect(screen.getByTestId("tile-toolbar")).not.toContainHTML("Test Button A");

  });

});
