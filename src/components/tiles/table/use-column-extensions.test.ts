import { DataSet, addAttributeToDataSet } from "../../../models/data/data-set";
import { IGridContext, TColumn } from "./table-types";
import { useColumnExtensions } from "./use-column-extensions";

// The expression row under the column headers is what showed students
// "= rank(windowStart, ...)" above a Wave Runner's Event Number column. A column whose formula is
// hidden has no expression the student set, so the header draws none.
describe("useColumnExtensions", () => {
  function extend({ formulaHidden }: { formulaHidden?: boolean }) {
    const dataSet = DataSet.create();
    addAttributeToDataSet(dataSet, { id: "attr", name: "number", formulaHidden });
    dataSet.attrFromID("attr")!.setFormula("rank(windowStart)");
    const column = { key: "attr", name: "number" } as TColumn;

    // Named like a hook but calls none, so it runs outside a component.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useColumnExtensions({
      gridContext: {} as IGridContext,
      dataSet,
      columns: [column],
      rows: [],
      setColumnEditingName: jest.fn(),
      changeHandlers: { onSetColumnName: jest.fn(), onRemoveColumn: jest.fn() } as any
    });

    return column.appData!;
  }

  it("draws no expression row for a hidden formula, and offers it no formula", () => {
    const appData = extend({ formulaHidden: true });
    expect(appData.showExpressions).toBe(false);
    expect(appData.expression).toBeUndefined();
  });

  it("still draws one for an expression the student set", () => {
    const appData = extend({ formulaHidden: undefined });
    expect(appData.showExpressions).toBe(true);
    expect(appData.expression).toBe("rank(windowStart)");
  });
});
