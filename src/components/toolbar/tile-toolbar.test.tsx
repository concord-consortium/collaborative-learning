import React, { useRef } from "react";
import { act, render, screen } from "@testing-library/react";
import { TileToolbarButton } from "./tile-toolbar-button";
import { IToolbarButtonProps, registerTileToolbarButtons } from "./toolbar-button-manager";
import CopyIcon from "../../../assets/icons/copy/copy-icon-default.svg";
import { TileToolbar } from "./tile-toolbar";
import { ITileModel, TileModel } from "../../models/tiles/tile-model";
import { defaultTextContent } from "../../models/tiles/text/text-content";

// The text tile needs to be registered so the TileModel.create
// knows it is a supported tile type
import "../../models/tiles/text/text-registration";
import { specStores } from "../../models/stores/spec-stores";
import { Provider } from "mobx-react";

const clickHandler = jest.fn();

function SampleToolbarButton({ model } : IToolbarButtonProps) {
  return <TileToolbarButton Icon={CopyIcon} onClick={clickHandler} />;
}

interface ISampleTileProps {
  model: ITileModel
}

function SampleTile({model}: ISampleTileProps) {
  const tileElt = useRef<HTMLDivElement>(null);
  return (
    <>
      <div ref={tileElt}>
        Tile content.
      </div>
      <TileToolbar id={model.id} readOnly={false} tileElement={tileElt.current} tileType="test" model={model}/>
    </>
  );
}

describe("Tile toolbar button", () => {

  it("can render a button", () => {
    render(<TileToolbarButton
      Icon={CopyIcon}
      onClick={clickHandler} />);

    expect(screen.getByRole("button")).toBeInTheDocument();
    expect(screen.getByRole("button")).toContainHTML("<svg");
    screen.getByRole("button").click();
    expect(clickHandler).toHaveBeenCalledTimes(1);
  });

  it("can register buttons and render default toolbar", () => {
    const model = TileModel.create({content: defaultTextContent()});
    const stores = specStores();
    stores.ui.setSelectedTileId(model.id);

    registerTileToolbarButtons("test",
    [
      {
        name: "default",
        title: "Default Button",
        component: SampleToolbarButton,
        defaultPosition: 1,
      },
      {
        name: "non-default",
        title: "Non-default button",
        component: SampleToolbarButton,
      }
    ]);

    render(
      <Provider stores={stores}>
        <SampleTile model={model}/>
      </Provider>
    );
    expect(screen.getByTestId("tile-toolbar")).toBeInTheDocument();
    expect(screen.getByTestId("tile-toolbar")).toContainHTML("Default Button");
    expect(screen.getByTestId("tile-toolbar")).not.toContainHTML("Non-default Button");
  });

});
