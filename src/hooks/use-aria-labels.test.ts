import { renderHook } from "@testing-library/react-hooks";
import { useAriaLabels } from "./use-aria-labels";

describe("useAriaLabels", () => {
  it("should return static ARIA labels", () => {
    const { result } = renderHook(() => useAriaLabels());

    expect(result.current.header).toBe("CLUE Header");
    expect(result.current.resourcesPane).toBe("Resources");
    expect(result.current.workspacePane).toBe("My Workspace");
    expect(result.current.documentTiles).toBe("Document tiles");
    expect(result.current.skipToMain).toBe("Skip to My Workspace");
    expect(result.current.resourceTabs).toBe("Resource navigation");
    expect(result.current.tileToolbar).toBe("Tile toolbar");
    expect(result.current.announcements).toBe("Status announcements");
  });

  it("should return dynamic tabPanel label", () => {
    const { result } = renderHook(() => useAriaLabels());

    expect(result.current.tabPanel("Problems")).toBe("Problems content");
    expect(result.current.tabPanel("My Work")).toBe("My Work content");
  });

  it("should return dynamic tile label", () => {
    const { result } = renderHook(() => useAriaLabels());

    expect(result.current.tile("Text")).toBe("Text tile");
    expect(result.current.tile("Graph")).toBe("Graph tile");
  });

  it("should return dynamic chat label", () => {
    const { result } = renderHook(() => useAriaLabels());

    expect(result.current.chat(true)).toBe("Collapse chat");
    expect(result.current.chat(false)).toBe("Expand chat");
  });

  describe("announce labels", () => {
    it("should return editing tile announcement", () => {
      const { result } = renderHook(() => useAriaLabels());

      expect(result.current.announce.editingTile).toBe("Editing tile");
    });

    it("should return exited tile announcement", () => {
      const { result } = renderHook(() => useAriaLabels());

      expect(result.current.announce.exitedTile).toBe("Exited tile");
    });

    it("should return dynamic tile selected announcement", () => {
      const { result } = renderHook(() => useAriaLabels());

      expect(result.current.announce.tileSelected("Text")).toBe("Text tile selected");
      expect(result.current.announce.tileSelected("Graph")).toBe("Graph tile selected");
    });

    it("should return dynamic tile added announcement", () => {
      const { result } = renderHook(() => useAriaLabels());

      expect(result.current.announce.tileAdded("Table")).toBe("Table tile added");
    });

    it("should return dynamic tile removed announcement", () => {
      const { result } = renderHook(() => useAriaLabels());

      expect(result.current.announce.tileRemoved("Image")).toBe("Image tile removed");
    });

    it("should return dynamic panel selected announcement", () => {
      const { result } = renderHook(() => useAriaLabels());

      expect(result.current.announce.panelSelected("My Work")).toBe("My Work panel selected");
    });
  });
});
