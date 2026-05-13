import { isCellEditing, getHeaderFocusables } from "./keyboard-nav";

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
