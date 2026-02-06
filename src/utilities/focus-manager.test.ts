import { focusManager } from "./focus-manager";

describe("FocusManager", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    // Reset focus manager state between tests
    focusManager.exitTrap();
  });

  describe("region registration", () => {
    it("should register a region", () => {
      const element = document.createElement("div");
      container.appendChild(element);

      focusManager.registerRegion({
        id: "test-region",
        element,
        type: "region"
      });

      // Region should be registered (we can verify by checking focus memory works)
      focusManager.setFocusMemory("test-region", element);
      expect(focusManager.getFocusMemory("test-region")).toBe(element);

      focusManager.unregisterRegion("test-region");
    });

    it("should unregister a region", () => {
      const element = document.createElement("div");
      container.appendChild(element);

      focusManager.registerRegion({
        id: "test-region",
        element,
        type: "region"
      });

      focusManager.setFocusMemory("test-region", element);
      focusManager.unregisterRegion("test-region");

      // Focus memory should be cleared when region is unregistered
      expect(focusManager.getFocusMemory("test-region")).toBeNull();
    });
  });

  describe("focus memory", () => {
    it("should store and retrieve focus memory for a region", () => {
      const element = document.createElement("button");
      container.appendChild(element);

      focusManager.registerRegion({
        id: "workspace",
        element: container,
        type: "region"
      });

      focusManager.setFocusMemory("workspace", element);
      expect(focusManager.getFocusMemory("workspace")).toBe(element);

      focusManager.unregisterRegion("workspace");
    });

    it("should return null for unregistered region", () => {
      expect(focusManager.getFocusMemory("nonexistent")).toBeNull();
    });

    it("should clear focus memory when element is removed from DOM", () => {
      const element = document.createElement("button");
      container.appendChild(element);

      focusManager.registerRegion({
        id: "workspace",
        element: container,
        type: "region"
      });

      focusManager.setFocusMemory("workspace", element);
      container.removeChild(element);

      // Focus memory should return null for elements no longer in DOM
      // (This tests the isConnected check in getFocusMemory)
      expect(focusManager.getFocusMemory("workspace")).toBeNull();

      focusManager.unregisterRegion("workspace");
    });
  });

  describe("focus trap", () => {
    it("should track when focus is trapped", () => {
      expect(focusManager.isInTrap()).toBe(false);

      focusManager.enterTrap("tile-1");
      expect(focusManager.isInTrap()).toBe(true);

      focusManager.exitTrap();
      expect(focusManager.isInTrap()).toBe(false);
    });

    it("should handle entering trap multiple times", () => {
      focusManager.enterTrap("tile-1");
      focusManager.enterTrap("tile-2");
      expect(focusManager.isInTrap()).toBe(true);

      focusManager.exitTrap();
      expect(focusManager.isInTrap()).toBe(false);
    });
  });

  describe("keyboard navigation tracking", () => {
    it("should track keyboard navigation state", () => {
      // Initial state should be false
      expect(focusManager.isKeyboardNavigation()).toBe(false);
    });

    it("should update keyboard navigation state on keydown", () => {
      // Simulate keydown event
      const keydownEvent = new KeyboardEvent("keydown", { key: "Tab" });
      document.dispatchEvent(keydownEvent);

      expect(focusManager.isKeyboardNavigation()).toBe(true);
    });

    it("should update keyboard navigation state on mousedown", () => {
      // First set keyboard navigation to true
      const keydownEvent = new KeyboardEvent("keydown", { key: "Tab" });
      document.dispatchEvent(keydownEvent);
      expect(focusManager.isKeyboardNavigation()).toBe(true);

      // Then simulate mousedown
      const mousedownEvent = new MouseEvent("mousedown");
      document.dispatchEvent(mousedownEvent);

      expect(focusManager.isKeyboardNavigation()).toBe(false);
    });
  });
});
