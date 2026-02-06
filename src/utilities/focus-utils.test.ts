import { isEditableElement, shouldInterceptArrows, FOCUSABLE_SELECTOR } from "./focus-utils";

describe("focus-utils", () => {
  describe("FOCUSABLE_SELECTOR", () => {
    it("should match expected focusable elements", () => {
      expect(FOCUSABLE_SELECTOR).toContain("button:not([disabled])");
      expect(FOCUSABLE_SELECTOR).toContain("[href]");
      expect(FOCUSABLE_SELECTOR).toContain("input:not([disabled])");
      expect(FOCUSABLE_SELECTOR).toContain("[tabindex]:not([tabindex=\"-1\"])");
    });
  });

  describe("isEditableElement", () => {
    let container: HTMLDivElement;

    beforeEach(() => {
      container = document.createElement("div");
      document.body.appendChild(container);
    });

    afterEach(() => {
      document.body.removeChild(container);
    });

    it("should return true for input elements", () => {
      const input = document.createElement("input");
      container.appendChild(input);
      expect(isEditableElement(input)).toBe(true);
    });

    it("should return true for textarea elements", () => {
      const textarea = document.createElement("textarea");
      container.appendChild(textarea);
      expect(isEditableElement(textarea)).toBe(true);
    });

    it("should return true for select elements", () => {
      const select = document.createElement("select");
      container.appendChild(select);
      expect(isEditableElement(select)).toBe(true);
    });

    it("should return true for contenteditable elements", () => {
      const div = document.createElement("div");
      div.setAttribute("contenteditable", "true");
      container.appendChild(div);
      expect(isEditableElement(div)).toBe(true);
    });

    it("should return true for elements inside contenteditable", () => {
      const editableDiv = document.createElement("div");
      editableDiv.setAttribute("contenteditable", "true");
      const span = document.createElement("span");
      editableDiv.appendChild(span);
      container.appendChild(editableDiv);
      expect(isEditableElement(span)).toBe(true);
    });

    it("should return true for elements with textbox role", () => {
      const div = document.createElement("div");
      div.setAttribute("role", "textbox");
      container.appendChild(div);
      expect(isEditableElement(div)).toBe(true);
    });

    it("should return true for elements with combobox role", () => {
      const div = document.createElement("div");
      div.setAttribute("role", "combobox");
      container.appendChild(div);
      expect(isEditableElement(div)).toBe(true);
    });

    it("should return false for regular divs", () => {
      const div = document.createElement("div");
      container.appendChild(div);
      expect(isEditableElement(div)).toBe(false);
    });

    it("should return false for buttons", () => {
      const button = document.createElement("button");
      container.appendChild(button);
      expect(isEditableElement(button)).toBe(false);
    });

    it("should return true for elements inside code editors", () => {
      const editor = document.createElement("div");
      editor.className = "cm-editor";
      const inner = document.createElement("div");
      editor.appendChild(inner);
      container.appendChild(editor);
      expect(isEditableElement(inner)).toBe(true);
    });
  });

  describe("shouldInterceptArrows", () => {
    let container: HTMLDivElement;

    beforeEach(() => {
      container = document.createElement("div");
      document.body.appendChild(container);
    });

    afterEach(() => {
      document.body.removeChild(container);
    });

    function createKeyboardEvent(key: string, options: Partial<KeyboardEventInit> = {}): KeyboardEvent {
      return new KeyboardEvent("keydown", { key, ...options });
    }

    it("should return false for modified arrow keys (Ctrl)", () => {
      const grid = document.createElement("div");
      grid.setAttribute("role", "grid");
      container.appendChild(grid);
      const event = createKeyboardEvent("ArrowDown", { ctrlKey: true });
      Object.defineProperty(event, "target", { value: grid });
      expect(shouldInterceptArrows(event)).toBe(false);
    });

    it("should return false for modified arrow keys (Shift)", () => {
      const grid = document.createElement("div");
      grid.setAttribute("role", "grid");
      container.appendChild(grid);
      const event = createKeyboardEvent("ArrowDown", { shiftKey: true });
      Object.defineProperty(event, "target", { value: grid });
      expect(shouldInterceptArrows(event)).toBe(false);
    });

    it("should return false for input elements inside grid", () => {
      const grid = document.createElement("div");
      grid.setAttribute("role", "grid");
      const input = document.createElement("input");
      grid.appendChild(input);
      container.appendChild(grid);

      const event = createKeyboardEvent("ArrowDown");
      Object.defineProperty(event, "target", { value: input });
      expect(shouldInterceptArrows(event)).toBe(false);
    });

    it("should return true for non-editable elements inside grid", () => {
      const grid = document.createElement("div");
      grid.setAttribute("role", "grid");
      const cell = document.createElement("div");
      cell.setAttribute("role", "gridcell");
      grid.appendChild(cell);
      container.appendChild(grid);

      const event = createKeyboardEvent("ArrowDown");
      Object.defineProperty(event, "target", { value: cell });
      expect(shouldInterceptArrows(event)).toBe(true);
    });

    it("should return true for elements inside tablist", () => {
      const tablist = document.createElement("div");
      tablist.setAttribute("role", "tablist");
      const tab = document.createElement("div");
      tab.setAttribute("role", "tab");
      tablist.appendChild(tab);
      container.appendChild(tablist);

      const event = createKeyboardEvent("ArrowRight");
      Object.defineProperty(event, "target", { value: tab });
      expect(shouldInterceptArrows(event)).toBe(true);
    });

    it("should return false for elements outside of grid/tablist", () => {
      const div = document.createElement("div");
      container.appendChild(div);

      const event = createKeyboardEvent("ArrowDown");
      Object.defineProperty(event, "target", { value: div });
      expect(shouldInterceptArrows(event)).toBe(false);
    });
  });
});
