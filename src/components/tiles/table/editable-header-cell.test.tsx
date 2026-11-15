import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { EditableHeaderCell } from "./editable-header-cell";

function renderCell(name: string, isEditing: boolean, onParentKeyDown?: (e: React.KeyboardEvent) => void,
                    onEndHeaderCellEdit = jest.fn()) {
  const column = {
    key: "attr1", name, width: 100,
    appData: {
      editableName: true, isEditing, gridContext: { isColumnSelected: () => true, onSelectColumn: jest.fn() },
      onBeginHeaderCellEdit: jest.fn(), onHeaderCellEditKeyDown: jest.fn(), onEndHeaderCellEdit
    }
  };
  // The parent stands in for the column header cell and the data grid, which both handle keys
  // that bubble up from the cell.
  return (
    <div onKeyDown={onParentKeyDown}>
      <EditableHeaderCell column={column as any} height={30} headerNameTabIndex={0} {...({} as any)} />
    </div>
  );
}

describe("EditableHeaderCell", () => {
  // A column can be renamed from outside its own editor, such as by another table sharing the
  // dataset or by undo, while this cell stays mounted.
  it("starts editing from the column's current name after a rename from elsewhere", () => {
    const { rerender } = render(renderCell("Servo", false));
    rerender(renderCell("Gripper", false));
    expect(screen.getByRole("button")).toHaveTextContent("Gripper");

    rerender(renderCell("Gripper", true));

    expect(screen.getByRole("textbox", { name: "Column name" })).toHaveValue("Gripper");
  });

  it("saves the typed name on Enter", () => {
    const onEndHeaderCellEdit = jest.fn();
    render(renderCell("Servo", true, undefined, onEndHeaderCellEdit));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Gripper" } });

    fireEvent.keyDown(input, { key: "Enter" });

    expect(onEndHeaderCellEdit).toHaveBeenCalledWith("Gripper");
  });

  it("discards the typed name on Escape", () => {
    const onEndHeaderCellEdit = jest.fn();
    render(renderCell("Servo", true, undefined, onEndHeaderCellEdit));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Gripper" } });

    fireEvent.keyDown(input, { key: "Escape" });

    expect(onEndHeaderCellEdit).toHaveBeenCalledWith(undefined);
  });

  // The data grid moves to another cell on these keys, which would end the edit instead of moving
  // the cursor in the name.
  it.each(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"])(
    "keeps %s inside the name input while editing", key => {
      const onParentKeyDown = jest.fn();
      render(renderCell("Servo", true, onParentKeyDown));

      fireEvent.keyDown(screen.getByRole("textbox"), { key });

      expect(onParentKeyDown).not.toHaveBeenCalled();
    });

  it("passes Tab on while editing so the grid can move to the next cell", () => {
    const onParentKeyDown = jest.fn();
    render(renderCell("Servo", true, onParentKeyDown));

    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Tab" });

    expect(onParentKeyDown).toHaveBeenCalled();
  });

  it("passes arrow keys on when not editing so they move between the header controls", () => {
    const onParentKeyDown = jest.fn();
    render(renderCell("Servo", false, onParentKeyDown));

    fireEvent.keyDown(screen.getByRole("button"), { key: "ArrowRight" });

    expect(onParentKeyDown).toHaveBeenCalled();
  });
});
