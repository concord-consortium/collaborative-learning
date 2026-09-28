import { writeCellValue } from "./write-cell-value";

const makeHandlers = () => ({ onAddRows: jest.fn(), onUpdateRow: jest.fn() });

describe("writeCellValue", () => {
  it("creates a case and rotates the placeholder when the target is the input row", () => {
    const handlers = makeHandlers();
    const inputRowId = { current: "input-row-id" };
    const caseValues = { __id__: "input-row-id", attr1: "value" };

    writeCellValue(caseValues, inputRowId, handlers);

    expect(handlers.onAddRows).toHaveBeenCalledWith([caseValues]);
    expect(handlers.onUpdateRow).not.toHaveBeenCalled();
    expect(inputRowId.current).not.toBe("input-row-id");
  });

  it("updates an existing case and leaves the placeholder alone", () => {
    const handlers = makeHandlers();
    const inputRowId = { current: "input-row-id" };
    const caseValues = { __id__: "case1", attr1: "value" };

    writeCellValue(caseValues, inputRowId, handlers);

    expect(handlers.onUpdateRow).toHaveBeenCalledWith(caseValues);
    expect(handlers.onAddRows).not.toHaveBeenCalled();
    expect(inputRowId.current).toBe("input-row-id");
  });
});
