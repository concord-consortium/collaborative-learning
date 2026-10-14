import { renderHook } from "@testing-library/react";
import { addAttributeToDataSet, DataSet } from "../../../models/data/data-set";
import { useColumnsFromDataSet } from "./use-columns-from-data-set";

// jsdom renders no grid here; what is under test is which columns the hook hands react-data-grid,
// and in particular whether it gives a column an editor.
describe("useColumnsFromDataSet", () => {
  function renderColumns() {
    const dataSet = DataSet.create();
    addAttributeToDataSet(dataSet, { name: "typed" });
    addAttributeToDataSet(dataSet, { name: "derived", editable: false });

    const { result } = renderHook(() => useColumnsFromDataSet({
      gridContext: { isColumnSelected: () => false } as any,
      dataSet,
      content: { hasExpression: () => false } as any,
      columnChanges: 0,
      headerHeight: () => 30,
      rowHeight: () => 30,
      RowLabelHeader: () => null,
      RowLabelFormatter: () => null,
      measureColumnWidth: () => 100,
      lookupImage: () => undefined
    }));
    return (name: string) => result.current.columns.find((c: any) => c.name === name) as any;
  }

  it("gives an ordinary attribute a cell editor", () => {
    expect(renderColumns()("typed")?.renderEditCell).toBeDefined();
  });

  // The Timeline's event number is derived, so an edit would be overwritten on the next renumber.
  it("gives a non-editable attribute no cell editor", () => {
    expect(renderColumns()("derived")?.renderEditCell).toBeUndefined();
  });
});
