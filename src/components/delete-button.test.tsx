import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import Modal from "react-modal";
import { ModalProvider } from "react-modal-hook";
import { ToolbarButtonModel } from "../models/tiles/toolbar-button";
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
          id: "delete",
          title: "Delete",
          iconId: "icon-delete-tool",
          isDefault: false,
          isTileTool: false
        };
  const toolButton = ToolbarButtonModel.create(buttonConfig);

  it("renders when disabled", () => {
    render(
      <>
        <div className="app"/>
        <ModalProvider>
          <DeleteButton
            toolButton={toolButton}
            isActive={false} isDisabled={true}
            onSetToolActive={onSetToolActive}
            onClick={onClick}
            onSetShowDeleteTilesConfirmationAlert={onSetShowDeleteTilesConfirmationAlert}
            onDeleteSelectedTiles={onDeleteSelectedTiles} />
        </ModalProvider>
      </>
    );
    const button = screen.getByTestId("delete-button");
    expect(button).toBeInTheDocument();
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveAttribute("aria-label", "Delete");
    expect(button).toHaveAttribute("aria-disabled", "true");

    act(() => {
      Modal.setAppElement(".app");
      userEvent.click(button);
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
            toolButton={toolButton}
            isActive={false} isDisabled={false} isPrimary={false}
            onSetToolActive={onSetToolActive}
            onClick={onClick}
            onSetShowDeleteTilesConfirmationAlert={onSetShowDeleteTilesConfirmationAlert}
            onDeleteSelectedTiles={onDeleteSelectedTiles} />
        </ModalProvider>
      </>
    );
    const button = screen.getByTestId("delete-button");
    expect(button).toBeInTheDocument();
    expect(button).not.toHaveAttribute("aria-disabled");

    act(() => {
      Modal.setAppElement(".app");
      userEvent.click(button);
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
            toolButton={toolButton}
            isActive={false} isDisabled={false} isPrimary={false}
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
