import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { ToolButtonComponent } from "./tool-button";

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
    render(
      <ToolButtonComponent
        config={{
          name: "select",
          title: "Select",
          iconId: "icon-select-tool",
          isDefault: true,
          isTileTool: false
        }}
        isActive={false}
        isDisabled={true}
        onSetToolActive={onSetToolActive}
        onClick={onClick}
        onDragStart={onDragStart}
        onShowDropHighlight={onShowDropHighlight}
        onHideDropHighlight={onHideDropHighlight}
        />
    );
    expect(screen.getByTestId("tool-select")).toBeInTheDocument();
    act(() => {
      userEvent.click(screen.getByTestId("tool-select"));
    });
    expect(onSetToolActive).not.toHaveBeenCalled();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders enabled text tool", () => {
    render(
      <ToolButtonComponent
        config={{
          name: "text",
          title: "Text",
          iconId: "icon-text-tool",
          isDefault: false,
          isTileTool: true
        }}
        ToolIcon={() => null}
        isActive={false}
        isDisabled={false}
        onSetToolActive={onSetToolActive}
        onClick={onClick}
        onDragStart={onDragStart}
        onShowDropHighlight={onShowDropHighlight}
        onHideDropHighlight={onHideDropHighlight}
        />
    );
    expect(screen.getByTestId("tool-text")).toBeInTheDocument();
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
