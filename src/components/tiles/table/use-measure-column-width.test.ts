import { renderHook } from "@testing-library/react";
import { onPatch } from "mobx-state-tree";
import { addAttributeToDataSet } from "../../../models/data/data-set";
import { TableContentModel, TableContentModelType } from "../../../models/tiles/table/table-content";
import { headerFitWidth } from "./column-width";
import { useMeasureColumnWidth } from "./use-measure-column-width";

describe("useMeasureColumnWidth", () => {
  function setup() {
    const content: TableContentModelType = TableContentModel.create();
    addAttributeToDataSet(content.dataSet, { id: "attr", name: "a".repeat(40) });
    const attr = content.dataSet.attrFromID("attr")!;
    const { result } = renderHook(() => useMeasureColumnWidth({ content }));
    return { content, attr, result };
  }

  it("fits the heading when the column has no stored width", () => {
    const { attr, result } = setup();
    expect(result.current.measureColumnWidth(attr)).toBe(headerFitWidth(attr.name));
  });

  // A column the student has resized is theirs; the heading must not pull it back.
  it("keeps a stored width even when it is narrower than the heading needs", () => {
    const { content, attr, result } = setup();
    content.setColumnWidth("attr", 80);
    expect(result.current.measureColumnWidth(attr)).toBe(80);
  });

  it("uses the in-progress width while the column is being dragged", () => {
    const { attr, result } = setup();
    result.current.resizeColumn.current = "attr";
    result.current.resizeColumnWidth.current = 123;
    expect(result.current.measureColumnWidth(attr)).toBe(123);
  });

  it("returns 0 for no attribute", () => {
    const { result } = setup();
    expect(result.current.measureColumnWidth(undefined)).toBe(0);
  });

  // The width is computed at render, never stored. Were it stored, merely opening a document
  // would dirty it and add an undo entry.
  it("writes nothing to the document", () => {
    const { content, attr, result } = setup();
    const patches: unknown[] = [];
    onPatch(content, patch => patches.push(patch));

    result.current.measureColumnWidth(attr);

    expect(patches).toEqual([]);
    expect(content.columnWidths.size).toBe(0);
  });
});
