import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { EditableTableTitle } from "./editable-table-title";
import { TileModel } from "../../../models/tiles/tile-model";
import { defaultTableContent } from "../../../models/tiles/table/table-content";
// Registers "Table" with the tile content type union so TileModel.create resolves it.
import "../../../models/tiles/table/table-registration";

describe("EditableTableTitle", () => {
  function startEditing() {
    const model = TileModel.create({ title: "Table 1", content: defaultTableContent() });
    const onEndEdit = jest.fn();
    render(<EditableTableTitle model={model} titleCellWidth={100} titleCellHeight={30} onEndEdit={onEndEdit} />);
    fireEvent.click(screen.getByRole("button"));
    return { input: screen.getByRole("textbox"), onEndEdit };
  }

  it("starts editing from the current title", () => {
    const { input } = startEditing();
    expect(input).toHaveValue("Table 1");
  });

  it("saves the typed title, trimmed, on Enter", () => {
    const { input, onEndEdit } = startEditing();
    fireEvent.change(input, { target: { value: "  Results  " } });

    fireEvent.keyDown(input, { key: "Enter" });

    expect(onEndEdit).toHaveBeenCalledWith("Results");
  });

  it("doesn't save a blank title", () => {
    const { input, onEndEdit } = startEditing();
    fireEvent.change(input, { target: { value: "   " } });

    fireEvent.keyDown(input, { key: "Enter" });

    expect(onEndEdit).toHaveBeenCalledWith(undefined);
  });

  it("discards the typed title on Escape", () => {
    const { input, onEndEdit } = startEditing();
    fireEvent.change(input, { target: { value: "Results" } });

    fireEvent.keyDown(input, { key: "Escape" });

    expect(onEndEdit).toHaveBeenCalledWith(undefined);
  });
});
