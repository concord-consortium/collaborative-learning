import React from "react";
import { render, screen } from "@testing-library/react";
import { EditableHeaderCell } from "./editable-header-cell";

function renderCell(name: string, isEditing: boolean) {
  const column = {
    key: "attr1", name, width: 100,
    appData: {
      editableName: true, isEditing, gridContext: { isColumnSelected: () => true, onSelectColumn: jest.fn() },
      onBeginHeaderCellEdit: jest.fn(), onHeaderCellEditKeyDown: jest.fn(), onEndHeaderCellEdit: jest.fn()
    }
  };
  return <EditableHeaderCell column={column as any} height={30} headerNameTabIndex={0} {...({} as any)} />;
}

describe("EditableHeaderCell", () => {
  // A column can be renamed from outside its own editor, such as by another table sharing the
  // dataset or by undo, while this cell stays mounted.
  it("starts editing from the column's current name after a rename from elsewhere", () => {
    const { rerender } = render(renderCell("Servo", false));
    rerender(renderCell("Gripper", false));
    expect(screen.getByRole("button")).toHaveTextContent("Gripper");

    rerender(renderCell("Gripper", true));

    expect(screen.getByRole("textbox")).toHaveValue("Gripper");
  });
});
