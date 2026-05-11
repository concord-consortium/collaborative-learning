import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "mobx-react";
import React from "react";
import Modal from "react-modal";
import { ModalProvider } from "react-modal-hook";
import { ToolbarButtonModel } from "../models/tiles/toolbar-button";
import { specStores } from "../models/stores/spec-stores";
import { DeleteButton } from "./delete-button";
import { kDragTileId, kDragTiles } from "./tiles/tile-component";

describe("DeleteButton", () => {

  const stores = specStores();
  const onSetToolActive = jest.fn();
  const onClick=jest.fn();
  const onSetShowDeleteTilesConfirmationAlert = jest.fn();
  const onDeleteSelectedTiles = jest.fn();
  const onDeleteTile = jest.fn();


  beforeEach(() => {
    onSetToolActive.mockReset();
    onClick.mockReset();
    onSetShowDeleteTilesConfirmationAlert.mockReset();
    onDeleteSelectedTiles.mockReset();
    onDeleteTile.mockReset();
  });

  const buttonConfig = {
          id: "delete",
          title: "Delete",
          iconId: "icon-delete-tool",
          isDefault: false,
          isTileTool: false
        };
  const toolButton = ToolbarButtonModel.create(buttonConfig);

  it("renders when disabled", async () => {
    const user = userEvent.setup();
    render(
      <Provider stores={stores}>
        <div className="app"/>
        <ModalProvider>
          <DeleteButton
            toolButton={toolButton}
            isActive={false} isDisabled={true}
            onSetToolActive={onSetToolActive}
            onClick={onClick}
            onSetShowDeleteTilesConfirmationAlert={onSetShowDeleteTilesConfirmationAlert}
            onDeleteSelectedTiles={onDeleteSelectedTiles}
            onDeleteTile={onDeleteTile} />
        </ModalProvider>
      </Provider>
    );
    const button = screen.getByTestId("delete-button");
    expect(button).toBeInTheDocument();
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveAttribute("aria-label", "Delete");
    expect(button).toHaveAttribute("aria-disabled", "true");

    Modal.setAppElement(".app");
    await user.click(button);
    expect(onSetToolActive).not.toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();
    expect(onSetShowDeleteTilesConfirmationAlert).toHaveBeenCalledTimes(1);
  });

  it("renders when enabled", async () => {
    const user = userEvent.setup();
    render(
      <Provider stores={stores}>
        <div className="app"/>
        <ModalProvider>
          <DeleteButton
            toolButton={toolButton}
            isActive={false} isDisabled={false} isPrimary={false}
            onSetToolActive={onSetToolActive}
            onClick={onClick}
            onSetShowDeleteTilesConfirmationAlert={onSetShowDeleteTilesConfirmationAlert}
            onDeleteSelectedTiles={onDeleteSelectedTiles}
            onDeleteTile={onDeleteTile} />
        </ModalProvider>
      </Provider>
    );
    const button = screen.getByTestId("delete-button");
    expect(button).toBeInTheDocument();
    expect(button).not.toHaveAttribute("aria-disabled");

    Modal.setAppElement(".app");
    await user.click(button);
    expect(onSetToolActive).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onSetShowDeleteTilesConfirmationAlert).toHaveBeenCalledTimes(1);
  });

  it("deletes picked-up tile on click", async () => {
    const user = userEvent.setup();
    const testStores = specStores();
    testStores.ui.pickUpTile("tile-1", "doc-1", "Text");

    render(
      <Provider stores={testStores}>
        <div className="app"/>
        <ModalProvider>
          <DeleteButton
            toolButton={toolButton}
            isActive={false} isDisabled={false}
            onSetToolActive={onSetToolActive}
            onClick={onClick}
            onSetShowDeleteTilesConfirmationAlert={onSetShowDeleteTilesConfirmationAlert}
            onDeleteSelectedTiles={onDeleteSelectedTiles}
            onDeleteTile={onDeleteTile} />
        </ModalProvider>
      </Provider>
    );

    Modal.setAppElement(".app");
    await user.click(screen.getByTestId("delete-button"));
    // Pick-up should be cleared
    expect(testStores.ui.pickedUpTileId).toBeUndefined();
    // Confirmation modal should appear
    await user.click(screen.getByText("Delete Tile", { selector: "button" }));
    expect(onDeleteTile).toHaveBeenCalledWith("tile-1");
    expect(onClick).not.toHaveBeenCalled();
  });

  it("deletes tile on drag-and-drop", async () => {
    const user = userEvent.setup();
    render(
      <Provider stores={stores}>
        <div className="app"/>
        <ModalProvider>
          <DeleteButton
            toolButton={toolButton}
            isActive={false} isDisabled={false}
            onSetToolActive={onSetToolActive}
            onClick={onClick}
            onSetShowDeleteTilesConfirmationAlert={onSetShowDeleteTilesConfirmationAlert}
            onDeleteSelectedTiles={onDeleteSelectedTiles}
            onDeleteTile={onDeleteTile} />
        </ModalProvider>
      </Provider>
    );

    const button = screen.getByTestId("delete-button");
    const dataTransfer = {
      types: [kDragTiles],
      getData: (type: string) => {
        if (type === kDragTileId) return "tile-2";
        if (type === kDragTiles) return JSON.stringify({ sourceDocId: "doc-1", tiles: [{ tileId: "tile-2" }] });
        return "";
      },
      dropEffect: "none",
      preventDefault: jest.fn(),
    };

    Modal.setAppElement(".app");
    fireEvent.drop(button, { dataTransfer });
    // Confirmation modal should appear
    await user.click(screen.getByText("Delete Tile", { selector: "button" }));
    expect(onDeleteTile).toHaveBeenCalledWith("tile-2");
  });

  it("shows confirmation alert when requested", async () => {
    const user = userEvent.setup();
    let showAlert: () => void;

    function setShowAlert(show: () => void) {
      showAlert = show;
    }

    function handleClick() {
      showAlert?.();
    }

    render(
      <Provider stores={stores}>
        <div className="app"/>
        <ModalProvider>
          <DeleteButton
            toolButton={toolButton}
            isActive={false} isDisabled={false} isPrimary={false}
            onSetToolActive={onSetToolActive}
            onClick={handleClick}
            onSetShowDeleteTilesConfirmationAlert={setShowAlert}
            onDeleteSelectedTiles={onDeleteSelectedTiles}
            onDeleteTile={onDeleteTile} />
        </ModalProvider>
      </Provider>
    );
    expect(screen.getByTestId("delete-button")).toBeInTheDocument();

    Modal.setAppElement(".app");
    await user.click(screen.getByTestId("delete-button"));
    await user.click(screen.getByText("Delete Tiles", { selector: "button" }));
    expect(onDeleteSelectedTiles).toHaveBeenCalledTimes(1);
  });
});
