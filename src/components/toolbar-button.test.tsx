import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { ToolbarButtonModel } from "../models/tiles/toolbar-button";
import { ToolbarButtonComponent } from "./toolbar-button";

// This is needed so the icon for the text tool can be found
import "../models/tiles/text/text-registration";

describe("ToolButtonComponent", () => {

  const onSetToolActive = jest.fn();
  const onClick = jest.fn();
  const onDragStart = jest.fn();
  const onShowDropHighlight = jest.fn();
  const onHideDropHighlight = jest.fn();

  beforeEach(() => {
    onSetToolActive.mockReset();
    onClick.mockReset();
    onDragStart.mockReset();
    onShowDropHighlight.mockReset();
    onHideDropHighlight.mockReset();
  });

  it("renders disabled select tool", () => {
    const toolButton = ToolbarButtonModel.create({
      id: "select",
      title: "Select",
      iconId: "icon-select-tool",
      isDefault: true,
      isTileTool: false
    });

    render(
      <ToolbarButtonComponent
        toolButton={toolButton}
        isActive={false}
        isDisabled={true}
        onSetToolActive={onSetToolActive}
        onClick={onClick}
        onDragStart={onDragStart}
        onShowDropHighlight={onShowDropHighlight}
        onHideDropHighlight={onHideDropHighlight}
        />
    );
    const button = screen.getByTestId("tool-select");
    expect(button).toBeInTheDocument();
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveAttribute("aria-label", "Select");
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(onSetToolActive).not.toHaveBeenCalled();
  });

  it("does not call click handler on disabled tool", () => {
    const toolButton = ToolbarButtonModel.create({
      id: "delete",
      title: "Delete",
      iconId: "icon-delete-tool",
      isTileTool: false
    });

    render(
      <ToolbarButtonComponent
        toolButton={toolButton}
        isActive={false}
        isDisabled={true}
        onSetToolActive={onSetToolActive}
        onClick={onClick}
        onDragStart={onDragStart}
        onShowDropHighlight={onShowDropHighlight}
        onHideDropHighlight={onHideDropHighlight}
        />
    );
    expect(screen.getByTestId("tool-delete")).toBeInTheDocument();
    act(() => {
      userEvent.click(screen.getByTestId("tool-delete"));
    });
    expect(onClick).toHaveBeenCalledTimes(0);
  });

  it("renders enabled text tool", () => {
    const toolButton = ToolbarButtonModel.create({
      id: "Text",
      isDefault: false,
      isTileTool: true
    });
    toolButton.initialize();

    render(
      <ToolbarButtonComponent
        toolButton={toolButton}
        isActive={false}
        isDisabled={false}
        onSetToolActive={onSetToolActive}
        onClick={onClick}
        onDragStart={onDragStart}
        onShowDropHighlight={onShowDropHighlight}
        onHideDropHighlight={onHideDropHighlight}
        />
    );
    const element = screen.getByTestId("tool-text");
    expect(element).toBeInTheDocument();
    expect(element.tagName).toBe("BUTTON");
    expect(element).toHaveAttribute("title", "Text");
    expect(element).toHaveAttribute("aria-label", "Text");
    expect(element).not.toHaveAttribute("aria-disabled");
    act(() => {
      userEvent.click(screen.getByTestId("tool-text"));
    });
    expect(onSetToolActive).toHaveBeenCalledTimes(2);
    expect(onClick).toHaveBeenCalledTimes(1);
    act(() => {
      fireEvent.dragStart(screen.getByTestId("tool-text"));
      fireEvent.dragEnd(screen.getByTestId("tool-text"));
    });
    expect(onDragStart).toHaveBeenCalledTimes(1);
  });
});
