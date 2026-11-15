import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { HeaderCellInput } from "./header-cell-input";

describe("HeaderCellInput", () => {
  function renderInput() {
    const onKeyDown = jest.fn();
    const onClose = jest.fn();
    render(<HeaderCellInput initialValue="Servo" ariaLabel="Column name" onKeyDown={onKeyDown} onClose={onClose} />);
    return { input: screen.getByRole("textbox", { name: "Column name" }), onKeyDown, onClose };
  }

  it("starts from the initial value", () => {
    const { input } = renderInput();
    expect(input).toHaveValue("Servo");
  });

  // The callers end the edit from these callbacks, so they have to receive what was typed.
  it("passes the typed text to onKeyDown and to onClose on blur", () => {
    const { input, onKeyDown, onClose } = renderInput();
    fireEvent.change(input, { target: { value: "Gripper" } });

    fireEvent.keyDown(input, { key: "Enter" });
    expect(onKeyDown).toHaveBeenCalledWith(expect.objectContaining({ key: "Enter" }), "Gripper");

    fireEvent.blur(input);
    expect(onClose).toHaveBeenCalledWith(true, "Gripper");
  });
});
