import {
  isCellEditing,
  createBodyTabHandler,
  createBodyEscapeHandler,
  createBodyFocusContent,
  createHeaderTabHandler,
  createHeaderEscapeHandler,
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

  it("returns 'exit' (with preventDefault) on forward tab at last cell", () => {
    const handler = createBodyTabHandler(makeDeps({ pos: { idx: 2, rowIdx: 2 }, cols: 3, rows: 3 }));
    const event = makeEvent();
    expect(handler(event, false)).toBe("exit");
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it("returns 'exit' on reverse tab at first cell", () => {
    const handler = createBodyTabHandler(makeDeps({ pos: { idx: 0, rowIdx: 0 }, cols: 3, rows: 3 }));
    const event = makeEvent();
    expect(handler(event, true)).toBe("exit");
    expect(event.preventDefault).toHaveBeenCalled();
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

  it("returns 'handled' when a cell editor is focused", () => {
    const cell = document.createElement("div");
    cell.setAttribute("role", "gridcell");
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

  it("resets to (0,0) on forward entry", () => {
    const { gridRef, selectCell } = makeGridStub("");
    const focusContent = createBodyFocusContent({
      gridRef,
      selectedCellRef: { current: null },
      columnsRef: { current: [{}, {}, {}] },
      rowsRef: { current: [{}, {}, {}] },
    });
    expect(focusContent({ reverse: false })).toBe(true);
    expect(selectCell).toHaveBeenCalledWith({ idx: 0, rowIdx: 0 }, undefined, true);
  });

  it("focuses the memory cell on reverse entry", () => {
    const { gridRef, element } = makeGridStub(`
      <div role="row" aria-rowindex="1"><div role="gridcell" tabindex="0">header</div></div>
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
    expect(focusContent({ reverse: true })).toBe(true);
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
    expect(focusContent({ reverse: true })).toBe(true);
    expect(selectCell).toHaveBeenCalledWith({ idx: 2, rowIdx: 2 }, undefined, true);
  });
});

describe("createHeaderTabHandler", () => {
  function makeHeader(numCells: number) {
    const header = document.createElement("div");
    const cells: HTMLElement[] = [];
    for (let i = 0; i < numCells; i++) {
      const cell = document.createElement("div");
      cell.setAttribute("role", "columnheader");
      // Make cell focusable so activeElement tracking works
      cell.setAttribute("tabindex", "0");
      header.appendChild(cell);
      cells.push(cell);
    }
    document.body.appendChild(header);
    return { header, cells };
  }

  beforeEach(() => {
    document.body.innerHTML = "";
  });

  function makeEvent() {
    const event = new KeyboardEvent("keydown");
    Object.defineProperty(event, "preventDefault", { value: jest.fn() });
    return event;
  }

  it("returns 'handled' (without preventDefault) when not at boundary, forward", () => {
    const { header, cells } = makeHeader(3);
    cells[1].focus();
    const handler = createHeaderTabHandler({ getTopbarElement: () => header });
    const event = makeEvent();
    expect(handler(event, false)).toBe("handled");
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it("returns 'exit' (with preventDefault) when forward Tab is at last cell", () => {
    const { header, cells } = makeHeader(3);
    cells[2].focus();
    const handler = createHeaderTabHandler({ getTopbarElement: () => header });
    const event = makeEvent();
    expect(handler(event, false)).toBe("exit");
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it("returns 'handled' (without preventDefault) when not at boundary, reverse", () => {
    const { header, cells } = makeHeader(3);
    cells[1].focus();
    const handler = createHeaderTabHandler({ getTopbarElement: () => header });
    const event = makeEvent();
    expect(handler(event, true)).toBe("handled");
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it("returns 'exit' (with preventDefault) on reverse Tab at first cell", () => {
    const { header, cells } = makeHeader(3);
    cells[0].focus();
    const handler = createHeaderTabHandler({ getTopbarElement: () => header });
    const event = makeEvent();
    expect(handler(event, true)).toBe("exit");
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it("returns 'exit' when header element is not available", () => {
    const handler = createHeaderTabHandler({ getTopbarElement: () => undefined });
    const event = makeEvent();
    expect(handler(event, false)).toBe("exit");
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it("returns 'exit' when active element is not inside the header", () => {
    const { header } = makeHeader(3);
    const outsideDiv = document.createElement("div");
    document.body.appendChild(outsideDiv);
    outsideDiv.focus();
    const handler = createHeaderTabHandler({ getTopbarElement: () => header });
    const event = makeEvent();
    expect(handler(event, false)).toBe("exit");
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it("returns 'exit' when active element is not inside a columnheader cell", () => {
    const { header } = makeHeader(3);
    const button = document.createElement("button");
    header.appendChild(button);
    button.focus();
    const handler = createHeaderTabHandler({ getTopbarElement: () => header });
    const event = makeEvent();
    expect(handler(event, false)).toBe("exit");
    expect(event.preventDefault).toHaveBeenCalled();
  });
});

describe("createHeaderEscapeHandler", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("returns 'handled' when an input inside .editable-header-cell is focused", () => {
    const cell = document.createElement("div");
    cell.className = "editable-header-cell";
    const input = document.createElement("input");
    cell.appendChild(input);
    document.body.appendChild(cell);
    input.focus();
    const handler = createHeaderEscapeHandler();
    expect(handler(new KeyboardEvent("keydown"))).toBe("handled");
  });

  it("returns 'exit' when no rename input is focused", () => {
    const btn = document.createElement("button");
    document.body.appendChild(btn);
    btn.focus();
    const handler = createHeaderEscapeHandler();
    expect(handler(new KeyboardEvent("keydown"))).toBe("exit");
  });
});
