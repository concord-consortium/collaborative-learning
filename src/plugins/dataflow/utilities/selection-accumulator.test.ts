import { accumulateOnModifier } from "./selection-accumulator";

// Dispatches a real KeyboardEvent so the modifier flags come from the event, as they do in a browser.
function key(type: "keydown" | "keyup", init: KeyboardEventInit) {
  document.dispatchEvent(new KeyboardEvent(type, init));
}

describe("accumulateOnModifier", () => {
  let acc: ReturnType<typeof accumulateOnModifier>;
  beforeEach(() => { acc = accumulateOnModifier(); });
  afterEach(() => { acc.destroy(); });

  it("is inactive until a modifier is held", () => {
    expect(acc.active()).toBe(false);
    key("keydown", { key: "a" });
    expect(acc.active()).toBe(false);
  });

  it.each([
    ["Shift", { key: "Shift", shiftKey: true }],
    ["Control", { key: "Control", ctrlKey: true }],
    ["Meta", { key: "Meta", metaKey: true }],
  ])("activates while %s is held and clears on release", (_name, down) => {
    key("keydown", down);
    expect(acc.active()).toBe(true);
    key("keyup", { key: (down as KeyboardEventInit).key });
    expect(acc.active()).toBe(false);
  });

  it("stays active when one of two held modifiers is released", () => {
    // Ctrl+Shift held, then Shift released. Toggling a single flag per keyup used to end additive
    // selection here even though Ctrl was still down, silently breaking multi-select mid-gesture.
    key("keydown", { key: "Control", ctrlKey: true });
    key("keydown", { key: "Shift", ctrlKey: true, shiftKey: true });
    expect(acc.active()).toBe(true);

    key("keyup", { key: "Shift", ctrlKey: true, shiftKey: false });
    expect(acc.active()).toBe(true);

    key("keyup", { key: "Control", ctrlKey: false, shiftKey: false });
    expect(acc.active()).toBe(false);
  });

  it("activates for a non-modifier keypress made while a modifier is held", () => {
    key("keydown", { key: "a", shiftKey: true });
    expect(acc.active()).toBe(true);
  });

  it("stops listening after destroy", () => {
    acc.destroy();
    key("keydown", { key: "Shift", shiftKey: true });
    expect(acc.active()).toBe(false);
  });
});
