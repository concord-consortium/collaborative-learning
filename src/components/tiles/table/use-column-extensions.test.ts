import { DataSet, addAttributeToDataSet } from "../../../models/data/data-set";
import { IGridContext, TColumn } from "./table-types";
import { useColumnExtensions } from "./use-column-extensions";

// The expression row under the column headers is what showed students
// "= rank(windowStart, ...)" above a Wave Runner's Event Number column. A column the owning
// tile derives has no expression the student set, so the header draws none.
describe("useColumnExtensions", () => {
  function extend({ derived }: { derived?: boolean }) {
    const dataSet = DataSet.create();
    addAttributeToDataSet(dataSet, { id: "attr", name: "number", derived });
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

  it("draws no expression row for a derived column, and offers it no formula", () => {
    const appData = extend({ derived: true });
    expect(appData.showExpressions).toBe(false);
    expect(appData.expression).toBeUndefined();
  });

  it("still draws one for an expression the student set", () => {
    const appData = extend({ derived: undefined });
    expect(appData.showExpressions).toBe(true);
    expect(appData.expression).toBe("rank(windowStart)");
  });
});
