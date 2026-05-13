import { isCellEditing, getHeaderFocusables, createBodyTabHandler, createBodyEscapeHandler, createBodyFocusContent, createHeaderTabHandler, createHeaderEscapeHandler, type CellPosition } from "./keyboard-nav";

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

describe("getHeaderFocusables", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("includes buttons with tabindex=-1 (roving tabindex)", () => {
    const header = document.createElement("div");
    const b1 = document.createElement("button");
    b1.setAttribute("tabindex", "0");
    const b2 = document.createElement("button");
    b2.setAttribute("tabindex", "-1");
    header.appendChild(b1);
    header.appendChild(b2);
    document.body.appendChild(header);
    expect(getHeaderFocusables(header)).toEqual([b1, b2]);
  });

  it("skips elements with aria-hidden=true", () => {
    const header = document.createElement("div");
    const b1 = document.createElement("button");
    const b2 = document.createElement("button");
    b2.setAttribute("aria-hidden", "true");
    header.appendChild(b1);
    header.appendChild(b2);
    document.body.appendChild(header);
    expect(getHeaderFocusables(header)).toEqual([b1]);
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
  function makeHeader(numButtons: number, activeIdx: number) {
    const header = document.createElement("div");
    const buttons: HTMLButtonElement[] = [];
    for (let i = 0; i < numButtons; i++) {
      const btn = document.createElement("button");
      btn.setAttribute("tabindex", i === activeIdx ? "0" : "-1");
      jest.spyOn(btn, "focus");
      header.appendChild(btn);
      buttons.push(btn);
    }
    document.body.appendChild(header);
    buttons[activeIdx]?.focus();
    return { header, buttons };
  }

  beforeEach(() => {
    document.body.innerHTML = "";
  });

  function makeEvent() {
    const event = new KeyboardEvent("keydown");
    Object.defineProperty(event, "preventDefault", { value: jest.fn() });
    return event;
  }

  it("advances tabindex and focuses next control, returns 'handled'", () => {
    const { header, buttons } = makeHeader(3, 0);
    const handler = createHeaderTabHandler({ getTopbarElement: () => header });
    const event = makeEvent();
    expect(handler(event, false)).toBe("handled");
    expect(buttons[0].getAttribute("tabindex")).toBe("-1");
    expect(buttons[1].getAttribute("tabindex")).toBe("0");
    expect(buttons[1].focus).toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it("returns 'exit' when forward Tab is past the last control", () => {
    const { header, buttons } = makeHeader(3, 2);
    const handler = createHeaderTabHandler({ getTopbarElement: () => header });
    const event = makeEvent();
    expect(handler(event, false)).toBe("exit");
    expect(event.preventDefault).toHaveBeenCalled();
    // Roving target unchanged on exit.
    expect(buttons[2].getAttribute("tabindex")).toBe("0");
  });

  it("retreats and focuses previous control on reverse, returns 'handled'", () => {
    const { header, buttons } = makeHeader(3, 2);
    const handler = createHeaderTabHandler({ getTopbarElement: () => header });
    const event = makeEvent();
    expect(handler(event, true)).toBe("handled");
    expect(buttons[2].getAttribute("tabindex")).toBe("-1");
    expect(buttons[1].getAttribute("tabindex")).toBe("0");
    expect(buttons[1].focus).toHaveBeenCalled();
  });

  it("returns 'exit' on reverse at the first control", () => {
    const { header } = makeHeader(3, 0);
    const handler = createHeaderTabHandler({ getTopbarElement: () => header });
    const event = makeEvent();
    expect(handler(event, true)).toBe("exit");
  });

  it("returns 'exit' when topbar element is not available", () => {
    const handler = createHeaderTabHandler({ getTopbarElement: () => undefined });
    const event = makeEvent();
    expect(handler(event, false)).toBe("exit");
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
