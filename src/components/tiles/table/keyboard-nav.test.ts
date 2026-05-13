import { isCellEditing, getHeaderFocusables, createBodyTabHandler, createBodyEscapeHandler, type CellPosition } from "./keyboard-nav";

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
