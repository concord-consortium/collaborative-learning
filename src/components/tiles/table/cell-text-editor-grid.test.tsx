import React, { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ReactDataGrid from "react-data-grid";
import { gImageMap } from "../../../models/image-map";
import {
  kCcImgUrl, makeClipboardData, mockFile, pasteAndFlush, readyEntry
} from "../../../test/clipboard-image-test-utils";
import CellTextEditor from "./cell-text-editor";

// Exercises the editor inside a real react-data-grid rather than against stubbed
// onRowChange/onClose. The bug this covers lives in the interaction between the two: rdg's
// onClose(commit) delegates to onRowChange with the row *it* currently holds, so committing in
// two steps within one tick silently drops the new value. Faking those callbacks hides that.
interface IRow { id: string; photo: string }

const Grid = ({ onRowsChange }: { onRowsChange: (rows: IRow[]) => void }) => {
  const [rows, setRows] = useState<IRow[]>([{ id: "r1", photo: "" }]);
  const columns = [{
    key: "photo",
    name: "photo",
    editable: true,
    renderEditCell: CellTextEditor,
    appData: {}
  }] as any;

  return (
    <ReactDataGrid
      columns={columns}
      rows={rows}
      rowKeyGetter={(row: IRow) => row.id}
      onRowsChange={(next: IRow[]) => { setRows(next); onRowsChange(next); }}
    />
  );
};

async function openEditor() {
  const cell = screen.getAllByRole("gridcell")[0];
  // rdg opens the editor on double click.
  fireEvent.doubleClick(cell);
  return waitFor(() => screen.getByRole("textbox"));
}

describe("CellTextEditor inside a real grid", () => {
  // rdg scrolls the committed cell back into view; jsdom has no layout to scroll.
  beforeAll(() => { (Element.prototype as any).scrollIntoView = jest.fn(); });
  afterEach(() => jest.restoreAllMocks());

  it("commits a pasted image into the row", async () => {
    jest.spyOn(gImageMap, "addFileImage").mockResolvedValue(readyEntry(kCcImgUrl));
    jest.spyOn(gImageMap, "getImage").mockResolvedValue(readyEntry(kCcImgUrl) as any);
    const onRowsChange = jest.fn();

    render(<Grid onRowsChange={onRowsChange} />);
    const textbox = await openEditor();

    await pasteAndFlush(textbox, makeClipboardData({ image: mockFile() }));

    await waitFor(() => expect(onRowsChange).toHaveBeenCalled());
    const lastRows = onRowsChange.mock.calls[onRowsChange.mock.calls.length - 1][0];
    expect(lastRows[0].photo).toBe(kCcImgUrl);
  });

  it("ignores a paste that resolves after its editing session ended", async () => {
    let resolveIngest: (v: any) => void = () => undefined;
    jest.spyOn(gImageMap, "addFileImage")
        .mockReturnValue(new Promise(res => { resolveIngest = res; }) as any);
    const onRowsChange = jest.fn();

    render(<Grid onRowsChange={onRowsChange} />);
    const textbox = await openEditor();

    fireEvent.paste(textbox, { clipboardData: makeClipboardData({ image: mockFile() }) });
    // The student gives up waiting and leaves the cell, closing this editor.
    fireEvent.keyDown(textbox, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());

    // The upload lands afterwards. It must not reach back into the grid.
    resolveIngest(readyEntry(kCcImgUrl));
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(onRowsChange).not.toHaveBeenCalled();
  });
});
