import { render } from "@testing-library/react";
import React from "react";
import { ITileApi } from "../components/tiles/tile-api";
import { ClueTileAccessibilityBridge, useClueAccessibility } from "./use-clue-accessibility";
import { createClueTileStrategy } from "./create-clue-tile-strategy";
import { registerTileContentInfo } from "../models/tiles/tile-content-info";
import { TileContentModel } from "../models/tiles/tile-content";

// Mock useAccessibility to avoid pulling in the full package in unit tests
jest.mock("@concord-consortium/accessibility-tools/hooks", () => ({
  useAccessibility: () => ({ navigation: null, resizable: null, debug: null }),
}));

// Register a fake tile type with a displayName so we can verify the strategy
// resolves the announcement text to a user-facing label rather than the raw
// internal tile-type id.
registerTileContentInfo({
  type: "fake-test-tile-with-display-name",
  displayName: "Fake Display Name",
  modelClass: TileContentModel,
  defaultContent: () => TileContentModel.create({ type: "fake-test-tile-with-display-name" }),
});

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

  it("sets cycle order to title/topbar/content/palette/toolbar/dragHandle/resize", () => {
    const strategy = createClueTileStrategy({
      onRegisterTileApi: jest.fn(),
      onUnregisterTileApi: jest.fn(),
      tileType: "text",
    });

    // `topbar` (e.g. dataflow's Sampling Rate / Record bar) sits between title and
    // content; `palette` (e.g. dataflow's Add-Block palette) sits between content
    // and toolbar so it can be a single tab stop. Tiles that don't provide topbar
    // or palette elements have those slots skipped by the trap's findNextSlot.
    expect(strategy.cycleOrder).toEqual(
      ["title", "topbar", "content", "palette", "toolbar", "dragHandle", "resize"]);
  });

  it("falls back to the tile type id in announcements when no displayName is registered", () => {
    const strategy = createClueTileStrategy({
      onRegisterTileApi: jest.fn(),
      onUnregisterTileApi: jest.fn(),
      tileType: "unregistered-fake-tile-type",
    });

    expect(strategy.announceEnter).toBe(
      "Editing unregistered-fake-tile-type tile. Press Escape to exit.");
    expect(strategy.announceExit).toBe(
      "Exited unregistered-fake-tile-type tile. Use arrow keys to navigate.");
  });

  it("uses the tile registry displayName in announcements when available", () => {
    const strategy = createClueTileStrategy({
      onRegisterTileApi: jest.fn(),
      onUnregisterTileApi: jest.fn(),
      tileType: "fake-test-tile-with-display-name",
    });

    expect(strategy.announceEnter).toBe(
      "Editing Fake Display Name tile. Press Escape to exit.");
    expect(strategy.announceExit).toBe(
      "Exited Fake Display Name tile. Use arrow keys to navigate.");
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

    // additionalApi methods are present and delegate to the caller's impl.
    // (The registered method is a proxy — calling it must reach exportFn, but
    // it is intentionally not the same function reference, so the proxy can
    // pick up later dependency-driven updates to the underlying impl.)
    expect(registeredApi.exportContentAsTileJson).toBeDefined();
    const exportResult = registeredApi.exportContentAsTileJson?.();
    expect(exportFn).toHaveBeenCalled();
    expect(exportResult).toBe("{}");

    // getFocusableElements is NOT the rogue version
    expect(registeredApi.getFocusableElements).not.toBe(rogue);

    // Calling it should work (not throw) and not call the rogue
    registeredApi.getFocusableElements?.();
    expect(rogue).not.toHaveBeenCalled();
  });

  it("additionalApi methods pick up dependency-driven updates without re-registration", () => {
    // Regression for the graph tile: `getDotCenter` returns undefined until
    // the graph is data-linked (xAttrType / yAttrType change from undefined to
    // "numeric"). The annotation system looks up `getObjectBoundingBox` etc.
    // through the registered tile API at call time, so the registered method
    // must always reach the *current* underlying impl — not the impl captured
    // at mount time.
    const onRegister = jest.fn();
    const exportV1 = jest.fn(() => "v1");
    const exportV2 = jest.fn(() => "v2");

    const { rerender } = render(
      <TileHarness
        onRegisterTileApi={onRegister}
        onUnregisterTileApi={jest.fn()}
        additionalApi={{ exportContentAsTileJson: exportV1 }}
      />
    );

    // Re-render with a fresh additionalApi (different inner impl)
    rerender(
      <TileHarness
        onRegisterTileApi={onRegister}
        onUnregisterTileApi={jest.fn()}
        additionalApi={{ exportContentAsTileJson: exportV2 }}
      />
    );

    // Still only one registration — but calling through the registered proxy
    // hits the latest impl.
    expect(onRegister).toHaveBeenCalledTimes(1);
    const registeredApi: ITileApi = onRegister.mock.calls[0][0];
    const result = registeredApi.exportContentAsTileJson?.();
    expect(result).toBe("v2");
    expect(exportV2).toHaveBeenCalledTimes(1);
    expect(exportV1).not.toHaveBeenCalled();
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
