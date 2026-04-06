import { render, act } from "@testing-library/react";
import React from "react";
import { ITileApi } from "../components/tiles/tile-api";
import { ClueTileAccessibilityBridge, useClueAccessibility } from "./use-clue-accessibility";
import { createClueTileStrategy } from "./create-clue-tile-strategy";

// Mock useAccessibility to avoid pulling in the full package in unit tests
jest.mock("@concord-consortium/accessibility-tools/hooks", () => ({
  useAccessibility: () => ({ navigation: null, resizable: null, debug: null }),
}));

describe("createClueTileStrategy", () => {
  it("uses getter functions when provided", () => {
    const content = document.createElement("div");
    const title = document.createElement("input");
    const toolbar = document.createElement("div");

    const strategy = createClueTileStrategy({
      onRegisterTileApi: jest.fn(),
      onUnregisterTileApi: jest.fn(),
      tileType: "text",
      getContentElement: () => content,
      getTitleElement: () => title,
      getToolbarElement: () => toolbar,
    });

    const elements = strategy.getElements();
    expect(elements.content).toBe(content);
    expect(elements.title).toBe(title);
    expect(elements.toolbar).toBe(toolbar);
  });

  it("falls back to refs when getters are not provided", () => {
    const content = document.createElement("div");
    const contentRef = { current: content };

    const strategy = createClueTileStrategy({
      onRegisterTileApi: jest.fn(),
      onUnregisterTileApi: jest.fn(),
      tileType: "text",
      contentRef,
    });

    const elements = strategy.getElements();
    expect(elements.content).toBe(content);
    expect(elements.title).toBeUndefined();
    expect(elements.toolbar).toBeUndefined();
  });

  it("sets cycle order to title/toolbar/content", () => {
    const strategy = createClueTileStrategy({
      onRegisterTileApi: jest.fn(),
      onUnregisterTileApi: jest.fn(),
      tileType: "text",
    });

    expect(strategy.cycleOrder).toEqual(["title", "toolbar", "content"]);
  });

  it("sets announcement text from tile type", () => {
    const strategy = createClueTileStrategy({
      onRegisterTileApi: jest.fn(),
      onUnregisterTileApi: jest.fn(),
      tileType: "bar-graph",
    });

    expect(strategy.announceEnter).toContain("bar-graph");
    expect(strategy.announceExit).toContain("bar-graph");
  });

  it("passes through focusContent", () => {
    const focusContent = jest.fn(() => true);
    const strategy = createClueTileStrategy({
      onRegisterTileApi: jest.fn(),
      onUnregisterTileApi: jest.fn(),
      tileType: "text",
      focusContent,
    });

    expect(strategy.focusContent).toBe(focusContent);
  });

  it("returns toolbar as external element", () => {
    const toolbar = document.createElement("div");
    const strategy = createClueTileStrategy({
      onRegisterTileApi: jest.fn(),
      onUnregisterTileApi: jest.fn(),
      tileType: "text",
      getToolbarElement: () => toolbar,
    });

    expect(strategy.getExternalElements?.()).toEqual([toolbar]);
  });

  it("returns empty array when no toolbar", () => {
    const strategy = createClueTileStrategy({
      onRegisterTileApi: jest.fn(),
      onUnregisterTileApi: jest.fn(),
      tileType: "text",
    });

    expect(strategy.getExternalElements?.()).toEqual([]);
  });
});

describe("useClueAccessibility", () => {
  // Test harness that exposes the hook result
  function TileHarness(props: {
    onRegisterTileApi: (api: ITileApi, facet?: string) => void;
    onUnregisterTileApi: (facet?: string) => void;
    getContentElement?: () => HTMLElement | undefined;
    focusContent?: () => boolean;
    additionalApi?: Partial<ITileApi>;
  }) {
    useClueAccessibility({
      type: "tile",
      focusTrap: {
        tileType: "text",
        ...props,
      },
    });
    return <div data-testid="harness" />;
  }

  function RegionHarness() {
    useClueAccessibility({ type: "region" });
    return <div data-testid="harness" />;
  }

  it("registers tile API on mount", () => {
    const onRegister = jest.fn();
    const onUnregister = jest.fn();

    render(<TileHarness onRegisterTileApi={onRegister} onUnregisterTileApi={onUnregister} />);

    expect(onRegister).toHaveBeenCalledTimes(1);
    expect(onUnregister).not.toHaveBeenCalled();

    const registeredApi: ITileApi = onRegister.mock.calls[0][0];
    expect(registeredApi.getFocusableElements).toBeDefined();
  });

  it("unregisters tile API on unmount", () => {
    const onRegister = jest.fn();
    const onUnregister = jest.fn();

    const { unmount } = render(
      <TileHarness onRegisterTileApi={onRegister} onUnregisterTileApi={onUnregister} />
    );

    unmount();

    expect(onUnregister).toHaveBeenCalledTimes(1);
  });

  it("getFocusableElements returns content and focusContent from strategy", () => {
    const onRegister = jest.fn();
    const content = document.createElement("div");
    const focusContent = jest.fn(() => true);

    render(
      <TileHarness
        onRegisterTileApi={onRegister}
        onUnregisterTileApi={jest.fn()}
        getContentElement={() => content}
        focusContent={focusContent}
      />
    );

    const registeredApi: ITileApi = onRegister.mock.calls[0][0];
    const focusable = registeredApi.getFocusableElements?.();

    expect(focusable?.contentElement).toBe(content);
    expect(focusable?.focusContent).toBe(focusContent);
  });

  it("getFocusableElements uses latest options (not stale closure)", () => {
    const onRegister = jest.fn();
    const content1 = document.createElement("div");
    const content2 = document.createElement("span");

    const { rerender } = render(
      <TileHarness
        onRegisterTileApi={onRegister}
        onUnregisterTileApi={jest.fn()}
        getContentElement={() => content1}
      />
    );

    // Re-render with a different content element
    rerender(
      <TileHarness
        onRegisterTileApi={onRegister}
        onUnregisterTileApi={jest.fn()}
        getContentElement={() => content2}
      />
    );

    // The registered API should return the updated content
    const registeredApi: ITileApi = onRegister.mock.calls[0][0];
    const focusable = registeredApi.getFocusableElements?.();
    expect(focusable?.contentElement).toBe(content2);
  });

  it("additionalApi methods are included but cannot override getFocusableElements", () => {
    const onRegister = jest.fn();
    const exportFn = jest.fn(() => "{}");
    const rogue = jest.fn();

    render(
      <TileHarness
        onRegisterTileApi={onRegister}
        onUnregisterTileApi={jest.fn()}
        additionalApi={{
          exportContentAsTileJson: exportFn,
          getFocusableElements: rogue as any,
        }}
      />
    );

    const registeredApi: ITileApi = onRegister.mock.calls[0][0];

    // additionalApi methods are present
    expect(registeredApi.exportContentAsTileJson).toBe(exportFn);

    // getFocusableElements is NOT the rogue version
    expect(registeredApi.getFocusableElements).not.toBe(rogue);

    // Calling it should work (not throw) and not call the rogue
    registeredApi.getFocusableElements?.();
    expect(rogue).not.toHaveBeenCalled();
  });

  it("does not register tile API for region type", () => {
    // RegionHarness uses type: "region" — should render without error
    // and not attempt any tile API registration
    const { container } = render(<RegionHarness />);
    expect(container.querySelector("[data-testid='harness']")).toBeTruthy();
  });
});

describe("ClueTileAccessibilityBridge", () => {
  it("renders nothing and registers tile API", () => {
    const onRegister = jest.fn();

    const { container } = render(
      <ClueTileAccessibilityBridge
        onRegisterTileApi={onRegister}
        onUnregisterTileApi={jest.fn()}
        tileType="text"
      />
    );

    // Bridge renders null
    expect(container.innerHTML).toBe("");

    // But registers the API
    expect(onRegister).toHaveBeenCalledTimes(1);
  });
});
