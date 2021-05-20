import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import Modal from "react-modal";
import { ModalProvider } from "react-modal-hook";
import { DeleteButton } from "./delete-button";

describe("DeleteButton", () => {

  const onSetToolActive = jest.fn();
  const onClick=jest.fn();
  const onSetShowDeleteTilesConfirmationAlert = jest.fn();
  const onDeleteSelectedTiles = jest.fn();


  beforeEach(() => {
    onSetToolActive.mockReset();
    onClick.mockReset();
    onSetShowDeleteTilesConfirmationAlert.mockReset();
    onDeleteSelectedTiles.mockReset();
  });

  const buttonConfig = {
          "name": "delete",
          "title": "Delete",
          "iconId": "icon-delete-tool",
          isDefault: false,
          isTileTool: false
        };

  it("renders when disabled", () => {
    render(
      <>
        <div className="app"/>
        <ModalProvider>
          <DeleteButton
            config={buttonConfig}
            isActive={false} isDisabled={true}
            onSetToolActive={onSetToolActive}
            onClick={onClick}
            onSetShowDeleteTilesConfirmationAlert={onSetShowDeleteTilesConfirmationAlert}
            onDeleteSelectedTiles={onDeleteSelectedTiles} />
        </ModalProvider>
      </>
    );
    expect(screen.getByTestId("delete-button")).toBeInTheDocument();

    act(() => {
      Modal.setAppElement(".app");
      userEvent.click(screen.getByTestId("delete-button"));
    });
    expect(onSetToolActive).not.toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();
    expect(onSetShowDeleteTilesConfirmationAlert).toHaveBeenCalledTimes(1);
  });

  it("renders when enabled", () => {
    render(
      <>
        <div className="app"/>
        <ModalProvider>
          <DeleteButton
            config={buttonConfig}
            ToolIcon={() => null}
            isActive={false} isDisabled={false}
            onSetToolActive={onSetToolActive}
            onClick={onClick}
            onSetShowDeleteTilesConfirmationAlert={onSetShowDeleteTilesConfirmationAlert}
            onDeleteSelectedTiles={onDeleteSelectedTiles} />
        </ModalProvider>
      </>
    );
    expect(screen.getByTestId("delete-button")).toBeInTheDocument();

    act(() => {
      Modal.setAppElement(".app");
      userEvent.click(screen.getByTestId("delete-button"));
    });
    expect(onSetToolActive).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onSetShowDeleteTilesConfirmationAlert).toHaveBeenCalledTimes(1);
  });

  it("shows confirmation alert when requested", () => {
    let showAlert: () => void;

    function setShowAlert(show: () => void) {
      showAlert = show;
    }

    function handleClick() {
      showAlert?.();
    }

    render(
      <>
        <div className="app"/>
        <ModalProvider>
          <DeleteButton
            config={buttonConfig}
            isActive={false} isDisabled={false}
            onSetToolActive={onSetToolActive}
            onClick={handleClick}
            onSetShowDeleteTilesConfirmationAlert={setShowAlert}
            onDeleteSelectedTiles={onDeleteSelectedTiles} />
        </ModalProvider>
      </>
    );
    expect(screen.getByTestId("delete-button")).toBeInTheDocument();

    act(() => {
      Modal.setAppElement(".app");
      userEvent.click(screen.getByTestId("delete-button"));
    });
    act(() => {
      userEvent.click(screen.getByText("Delete Tiles", { selector: "button" }));
    });
    expect(onDeleteSelectedTiles).toHaveBeenCalledTimes(1);
  });
});
