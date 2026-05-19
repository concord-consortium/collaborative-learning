import {
  isCellEditing,
  createBodyTabHandler,
  createBodyEscapeHandler,
  createBodyFocusContent,
  type CellPosition,
} from "./keyboard-nav";

describe("isCellEditing", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("returns false when active element is not an input", () => {
    const div = document.createElement("div");
    document.body.appendChild(div);
    div.focus();
    expect(isCellEditing()).toBe(false);
  });

  it("returns false when an input is focused but not inside a gridcell", () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    expect(isCellEditing()).toBe(false);
  });

  it("returns true when an input inside a role=gridcell is focused", () => {
    const cell = document.createElement("div");
    cell.setAttribute("role", "gridcell");
    const input = document.createElement("input");
    cell.appendChild(input);
    document.body.appendChild(cell);
    input.focus();
    expect(isCellEditing()).toBe(true);
  });

  it("returns true when an input inside a role=columnheader is focused (header rename)", () => {
    const cell = document.createElement("div");
    cell.setAttribute("role", "columnheader");
    const input = document.createElement("input");
    cell.appendChild(input);
    document.body.appendChild(cell);
    input.focus();
    expect(isCellEditing()).toBe(true);
  });
});


describe("createBodyTabHandler", () => {
  function makeDeps(opts: {
    pos: CellPosition | null;
    cols: number;
    rows: number;
  }) {
    return {
      selectedCellRef: { current: opts.pos },
      columnsRef: { current: new Array(opts.cols).fill({}) },
      rowsRef: { current: new Array(opts.rows).fill({}) },
    };
  }

  function makeEvent() {
    const event = new KeyboardEvent("keydown", { key: "Tab" });
    Object.defineProperty(event, "preventDefault", { value: jest.fn() });
    return event;
  }

  it("returns 'handled' (without preventDefault) when not at edge, forward", () => {
    const handler = createBodyTabHandler(makeDeps({ pos: { idx: 0, rowIdx: 0 }, cols: 3, rows: 3 }));
    const event = makeEvent();
    expect(handler(event, false)).toBe("handled");
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it("returns 'exit' (with preventDefault) on forward tab at last body cell", () => {
    const handler = createBodyTabHandler(makeDeps({ pos: { idx: 2, rowIdx: 2 }, cols: 3, rows: 3 }));
    const event = makeEvent();
    expect(handler(event, false)).toBe("exit");
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it("returns 'exit' on reverse tab at first header cell (rowIdx === -1, idx === 0)", () => {
    const handler = createBodyTabHandler(makeDeps({ pos: { idx: 0, rowIdx: -1 }, cols: 3, rows: 3 }));
    const event = makeEvent();
    expect(handler(event, true)).toBe("exit");
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it("returns 'handled' on reverse tab from first body cell (RDG navigates to last header cell)", () => {
    const handler = createBodyTabHandler(makeDeps({ pos: { idx: 0, rowIdx: 0 }, cols: 3, rows: 3 }));
    const event = makeEvent();
    expect(handler(event, true)).toBe("handled");
  });

  it("returns 'handled' on forward tab at last header cell (RDG navigates to first body cell)", () => {
    const handler = createBodyTabHandler(makeDeps({ pos: { idx: 2, rowIdx: -1 }, cols: 3, rows: 3 }));
    const event = makeEvent();
    expect(handler(event, false)).toBe("handled");
  });

  it("returns 'handled' on reverse tab when not at first cell", () => {
    const handler = createBodyTabHandler(makeDeps({ pos: { idx: 1, rowIdx: 0 }, cols: 3, rows: 3 }));
    const event = makeEvent();
    expect(handler(event, true)).toBe("handled");
  });

  it("returns 'exit' (with preventDefault) when no active cell", () => {
    const handler = createBodyTabHandler(makeDeps({ pos: null, cols: 3, rows: 3 }));
    const event = makeEvent();
    expect(handler(event, false)).toBe("exit");
    expect(event.preventDefault).toHaveBeenCalled();
  });
});

describe("createBodyEscapeHandler", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("returns 'handled' when a body cell editor is focused", () => {
    const cell = document.createElement("div");
    cell.setAttribute("role", "gridcell");
    const input = document.createElement("input");
    cell.appendChild(input);
    document.body.appendChild(cell);
    input.focus();
    const handler = createBodyEscapeHandler();
    expect(handler(new KeyboardEvent("keydown"))).toBe("handled");
  });

  it("returns 'handled' when a header rename editor is focused", () => {
    const cell = document.createElement("div");
    cell.setAttribute("role", "columnheader");
    const input = document.createElement("input");
    cell.appendChild(input);
    document.body.appendChild(cell);
    input.focus();
    const handler = createBodyEscapeHandler();
    expect(handler(new KeyboardEvent("keydown"))).toBe("handled");
  });

  it("returns 'exit' in select mode (no editor focused)", () => {
    const handler = createBodyEscapeHandler();
    expect(handler(new KeyboardEvent("keydown"))).toBe("exit");
  });
});

describe("createBodyFocusContent", () => {
  function makeGridStub(rowsHtml: string) {
    const element = document.createElement("div");
    element.innerHTML = rowsHtml;
    document.body.appendChild(element);
    const selectCell = jest.fn();
    return {
      gridRef: { current: { element, selectCell } as any },
      element,
      selectCell,
    };
  }

  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("targets the first header cell on forward entry", () => {
    const { gridRef, selectCell } = makeGridStub("");
    const focusContent = createBodyFocusContent({
      gridRef,
      selectedCellRef: { current: null },
      columnsRef: { current: [{}, {}, {}] },
      rowsRef: { current: [{}, {}, {}] },
    });
    expect(focusContent({ entryMode: "forward" })).toBe(true);
    expect(selectCell).toHaveBeenCalledWith({ idx: 0, rowIdx: -1 }, undefined, true);
  });

  it("focuses the memory cell on reverse entry (body cell)", () => {
    const { gridRef, element } = makeGridStub(`
      <div role="row" aria-rowindex="1"><div role="columnheader" tabindex="-1">header</div></div>
      <div role="row" aria-rowindex="2"><div role="gridcell" tabindex="-1">A</div></div>
      <div role="row" aria-rowindex="3"><div role="gridcell" tabindex="0" id="memory-cell">B</div></div>
    `);
    const memoryCell = element.querySelector<HTMLElement>("#memory-cell")!;
    jest.spyOn(memoryCell, "focus");

    const focusContent = createBodyFocusContent({
      gridRef,
      selectedCellRef: { current: null },
      columnsRef: { current: [{}] },
      rowsRef: { current: [{}, {}] },
    });
    expect(focusContent({ entryMode: "reverse" })).toBe(true);
    expect(memoryCell.focus).toHaveBeenCalled();
  });

  it("focuses the memory cell on reverse entry (header cell)", () => {
    const { gridRef, element } = makeGridStub(`
      <div role="row" aria-rowindex="1"><div role="columnheader" tabindex="0" id="memory-cell">header</div></div>
      <div role="row" aria-rowindex="2"><div role="gridcell" tabindex="-1">A</div></div>
    `);
    const memoryCell = element.querySelector<HTMLElement>("#memory-cell")!;
    jest.spyOn(memoryCell, "focus");

    const focusContent = createBodyFocusContent({
      gridRef,
      selectedCellRef: { current: null },
      columnsRef: { current: [{}] },
      rowsRef: { current: [{}] },
    });
    expect(focusContent({ entryMode: "reverse" })).toBe(true);
    expect(memoryCell.focus).toHaveBeenCalled();
  });

  it("falls back to (last col, last row) on reverse entry when no memory cell", () => {
    const { gridRef, selectCell } = makeGridStub(`
      <div role="row" aria-rowindex="1"><div role="gridcell">header</div></div>
    `);
    const focusContent = createBodyFocusContent({
      gridRef,
      selectedCellRef: { current: null },
      columnsRef: { current: [{}, {}, {}] },
      rowsRef: { current: [{}, {}, {}] },
    });
    expect(focusContent({ entryMode: "reverse" })).toBe(true);
    expect(selectCell).toHaveBeenCalledWith({ idx: 2, rowIdx: 2 }, undefined, true);
  });
});

