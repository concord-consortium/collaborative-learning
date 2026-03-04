import { renderHook } from "@testing-library/react-hooks";
import { useAriaLabels, getAriaLabels } from "./use-aria-labels";

describe("useAriaLabels", () => {
  describe("useAriaLabels hook", () => {
    it("should return the aria labels object", () => {
      const { result } = renderHook(() => useAriaLabels());
      expect(result.current).toBeDefined();
      expect(typeof result.current).toBe("object");
    });

    it("should return the same object on multiple calls", () => {
      const { result: result1 } = renderHook(() => useAriaLabels());
      const { result: result2 } = renderHook(() => useAriaLabels());
      expect(result1.current).toBe(result2.current);
    });
  });

  describe("getAriaLabels function", () => {
    it("should return the same labels as useAriaLabels", () => {
      const { result } = renderHook(() => useAriaLabels());
      const labels = getAriaLabels();
      expect(labels).toBe(result.current);
    });
  });

  describe("static labels", () => {
    it("should have landmark region labels", () => {
      const labels = getAriaLabels();
      expect(labels.header).toBe("CLUE Header");
      expect(labels.resourcesPane).toBe("Lessons and Documents");
      expect(labels.workspacePane).toBe("Workspace");
      expect(labels.documentTiles).toBe("Document tiles");
    });

    it("should have navigation labels", () => {
      const labels = getAriaLabels();
      expect(labels.skipToResources).toBe("Skip to Lessons and Documents");
      expect(labels.skipToWorkspace).toBe("Skip to Workspace");
      expect(labels.skipToDashboard).toBe("Skip to Dashboard");
      expect(labels.resourceTabs).toBe("Resource navigation");
    });

    it("should have tile toolbar label", () => {
      const labels = getAriaLabels();
      expect(labels.tileToolbar).toBe("Tile toolbar");
    });

    it("should have chat and resources panel labels", () => {
      const labels = getAriaLabels();
      expect(labels.openChatPanel).toBe("Open chat panel");
      expect(labels.closeResourcesPanel).toBe("Close resources panel");
    });

    it("should have announcements label", () => {
      const labels = getAriaLabels();
      expect(labels.announcements).toBe("Status announcements");
    });
  });

  describe("dynamic label functions", () => {
    it("should generate tabPanel labels", () => {
      const labels = getAriaLabels();
      expect(labels.tabPanel("Problems")).toBe("Problems content");
      expect(labels.tabPanel("My Work")).toBe("My Work content");
    });

    it("should generate tile labels", () => {
      const labels = getAriaLabels();
      expect(labels.tile("Graph")).toBe("Graph tile");
      expect(labels.tile("Text")).toBe("Text tile");
    });

    it("should generate chat toggle labels based on expanded state", () => {
      const labels = getAriaLabels();
      expect(labels.chat(true)).toBe("Collapse chat");
      expect(labels.chat(false)).toBe("Expand chat");
    });
  });

  describe("announce functions", () => {
    it("should generate editingTile announcements", () => {
      const labels = getAriaLabels();
      expect(labels.announce.editingTile("Graph")).toBe("Editing Graph tile. Press Escape to exit.");
      expect(labels.announce.editingTile("Text")).toBe("Editing Text tile. Press Escape to exit.");
    });

    it("should generate exitedTile announcements", () => {
      const labels = getAriaLabels();
      expect(labels.announce.exitedTile("Graph")).toBe("Exited Graph tile. Use arrow keys to navigate.");
    });

    it("should generate tileSelected announcements", () => {
      const labels = getAriaLabels();
      expect(labels.announce.tileSelected("Drawing")).toBe("Drawing tile selected");
    });

    it("should generate tileAdded announcements", () => {
      const labels = getAriaLabels();
      expect(labels.announce.tileAdded("Table")).toBe("Table tile added");
    });

    it("should generate tileRemoved announcements", () => {
      const labels = getAriaLabels();
      expect(labels.announce.tileRemoved("Image")).toBe("Image tile removed");
    });

    it("should generate panelSelected announcements", () => {
      const labels = getAriaLabels();
      expect(labels.announce.panelSelected("Problems")).toBe("Problems panel selected");
    });
  });
});
