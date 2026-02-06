/**
 * Tests for the announcer utility.
 * Note: Due to module caching and requestAnimationFrame timing,
 * some tests focus on verifiable behavior rather than exact timing.
 */

// Empty export to make this file a module (required for isolatedModules)
export {};

describe("announcer", () => {
  let liveRegion: HTMLDivElement;

  beforeEach(() => {
    // Create the live region that the announcer expects
    liveRegion = document.createElement("div");
    liveRegion.id = "clue-announcements";
    document.body.appendChild(liveRegion);
  });

  afterEach(() => {
    // Clean up DOM
    if (document.body.contains(liveRegion)) {
      document.body.removeChild(liveRegion);
    }
  });

  describe("announce", () => {
    // Import dynamically to get fresh module state
    const getAnnouncer = () => require("./announcer");

    it("should use polite priority by default", () => {
      const { announce } = getAnnouncer();
      announce("Test message");

      // aria-live attribute is set synchronously
      expect(liveRegion.getAttribute("aria-live")).toBe("polite");
    });

    it("should use assertive priority when specified", () => {
      const { announce } = getAnnouncer();
      announce("Important message", "assertive");

      // aria-live attribute is set synchronously
      expect(liveRegion.getAttribute("aria-live")).toBe("assertive");
    });

    it("should clear content synchronously before setting message", () => {
      const { announce } = getAnnouncer();
      liveRegion.textContent = "Old content";

      announce("New message");

      // Content is cleared synchronously
      expect(liveRegion.textContent).toBe("");
    });

    it("should do nothing if live region doesn't exist", () => {
      document.body.removeChild(liveRegion);
      const { announce } = getAnnouncer();

      // This should not throw
      expect(() => announce("Test message")).not.toThrow();
    });
  });

  describe("clearAnnouncements", () => {
    const getAnnouncer = () => require("./announcer");

    it("should clear the live region content", () => {
      liveRegion.textContent = "Some content";
      const { clearAnnouncements } = getAnnouncer();

      clearAnnouncements();

      expect(liveRegion.textContent).toBe("");
    });

    it("should do nothing if live region doesn't exist", () => {
      document.body.removeChild(liveRegion);
      const { clearAnnouncements } = getAnnouncer();

      // This should not throw
      expect(() => clearAnnouncements()).not.toThrow();
    });
  });
});
