import { Provider } from "mobx-react";
import React, { useContext, useEffect } from "react";
import { types } from "mobx-state-tree";
import { act, createEvent, fireEvent, render, screen } from "@testing-library/react";
import {
  ITileApi, ITileApiInterface, TileApiInterface, TileApiInterfaceContext, RegisterToolbarContext
} from "./tile-api";
import { ITileProps, TileComponent } from "./tile-component";
import { specStores } from "../../models/stores/spec-stores";
import { TileModel } from "../../models/tiles/tile-model";
import { UnknownContentModel } from "../../models/tiles/unknown-content";
import { TileContentModel } from "../../models/tiles/tile-content";
import { registerTileContentInfo } from "../../models/tiles/tile-content-info";
import { registerTileComponentInfo } from "../../models/tiles/tile-component-info";

// required before tile creation
import "../../register-tile-types";

// --- Test tile type for focus trap tests ---

const kTestFocusTrapType = "TestFocusTrap";

const TestFocusTrapContent = TileContentModel
  .named("TestFocusTrapContent")
  .props({
    type: types.optional(types.literal(kTestFocusTrapType), kTestFocusTrapType),
  });

// Module-level refs that tests populate before render
let mockToolbarElement: HTMLDivElement | null = null;
let mockTitleElement: HTMLInputElement | null = null;
let mockContentElement: HTMLDivElement | null = null;

const TestFocusTrapComponent: React.FC<ITileProps> = (props) => {
  const registerToolbar = useContext(RegisterToolbarContext);

  useEffect(() => {
    if (mockToolbarElement) {
      registerToolbar?.(mockToolbarElement);
    }
    return () => registerToolbar?.(null);
  }, [registerToolbar]);

  useEffect(() => {
    const tileApi: ITileApi = {
      getFocusableElements: () => ({
        contentElement: mockContentElement || undefined,
        titleElement: mockTitleElement || undefined,
      }),
    };
    props.onRegisterTileApi(tileApi);
    return () => props.onUnregisterTileApi();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div data-testid="test-tile-content">Test content</div>;
};

registerTileContentInfo({
  type: kTestFocusTrapType,
  displayName: "TestTile",
  modelClass: TestFocusTrapContent as typeof TileContentModel,
  defaultContent: () => TestFocusTrapContent.create(),
});

registerTileComponentInfo({
  type: kTestFocusTrapType,
  Component: TestFocusTrapComponent as unknown as React.ComponentType<ITileProps>,
  tileEltClass: "test-focus-trap-tile",
});

// --- Render helpers ---

interface IRenderOptions {
  hasTitle?: boolean;
  hasContent?: boolean;
  hasToolbar?: boolean;
  numToolbarButtons?: number;
  contentEditable?: boolean;
}

function renderFocusTrapTile(options?: IRenderOptions) {
  const {
    hasTitle = true,
    hasContent = true,
    hasToolbar = true,
    numToolbarButtons = 2,
    contentEditable = false,
  } = options ?? {};

  mockTitleElement = hasTitle ? document.createElement("input") : null;

  mockContentElement = hasContent ? document.createElement("div") : null;
  if (mockContentElement) {
    mockContentElement.setAttribute("tabindex", "-1");
    if (contentEditable) {
      mockContentElement.setAttribute("contenteditable", "true");
    }
  }

  mockToolbarElement = hasToolbar ? document.createElement("div") : null;
  if (mockToolbarElement) {
    mockToolbarElement.setAttribute("role", "toolbar");
    for (let i = 0; i < numToolbarButtons; i++) {
      const btn = document.createElement("button");
      btn.textContent = `Btn${i}`;
      btn.setAttribute("tabindex", i === 0 ? "0" : "-1");
      mockToolbarElement.appendChild(btn);
    }
    document.body.appendChild(mockToolbarElement);
  }

  const stores = specStores();
  const tileContent = TestFocusTrapContent.create();
  const tileModel = TileModel.create({ content: tileContent });
  stores.ui.setSelectedTileId(tileModel.id);

  const tileApiInterface = new TileApiInterface();

  const result = render(
    <Provider stores={stores}>
      <TileApiInterfaceContext.Provider value={tileApiInterface}>
        <div className="document-content">
          <TileComponent
            context="context"
            docId="docId"
            documentContent={null}
            isUserResizable={false}
            model={tileModel}
            onResizeRow={jest.fn()}
            onSetCanAcceptDrop={jest.fn()}
            onRequestRowHeight={jest.fn()}
          />
        </div>
      </TileApiInterfaceContext.Provider>
    </Provider>
  );

  const tileElement = screen.getByTestId("tool-tile");

  // Append mock focusable elements inside tile DOM (simulates real structure)
  if (mockTitleElement) tileElement.appendChild(mockTitleElement);
  if (mockContentElement) tileElement.appendChild(mockContentElement);

  const toolbarButtons = mockToolbarElement
    ? Array.from(mockToolbarElement.querySelectorAll("button")) as HTMLButtonElement[]
    : [];

  return {
    stores, tileModel, tileElement,
    titleElement: mockTitleElement,
    contentElement: mockContentElement,
    toolbarElement: mockToolbarElement,
    toolbarButtons,
    ...result,
  };
}

function renderTwoTiles() {
  // Both tiles share one set of mocks, but the second tile won't have focusable elements.
  // We only need two tile containers for inter-tile navigation.
  mockTitleElement = document.createElement("input");
  mockContentElement = document.createElement("div");
  mockContentElement.setAttribute("tabindex", "-1");
  mockToolbarElement = null; // No toolbar needed for inter-tile nav tests

  const stores = specStores();
  const model1 = TileModel.create({ content: TestFocusTrapContent.create() });
  const model2 = TileModel.create({ content: TestFocusTrapContent.create() });
  stores.ui.setSelectedTileId(model1.id);

  const tileApiInterface = new TileApiInterface();

  const result = render(
    <Provider stores={stores}>
      <TileApiInterfaceContext.Provider value={tileApiInterface}>
        <div className="document-content">
          <TileComponent
            context="context"
            docId="docId"
            documentContent={null}
            isUserResizable={false}
            model={model1}
            onResizeRow={jest.fn()}
            onSetCanAcceptDrop={jest.fn()}
            onRequestRowHeight={jest.fn()}
          />
          <TileComponent
            context="context"
            docId="docId"
            documentContent={null}
            isUserResizable={false}
            model={model2}
            onResizeRow={jest.fn()}
            onSetCanAcceptDrop={jest.fn()}
            onRequestRowHeight={jest.fn()}
          />
        </div>
      </TileApiInterfaceContext.Provider>
    </Provider>
  );

  const tiles = screen.getAllByTestId("tool-tile");
  const tile1 = tiles[0];
  const tile2 = tiles[1];

  // Append focusable elements inside tile1 only
  if (mockTitleElement) tile1.appendChild(mockTitleElement);
  if (mockContentElement) tile1.appendChild(mockContentElement);

  return { stores, model1, model2, tile1, tile2, tileApiInterface, ...result };
}

// --- Tests ---

describe("TileComponent", () => {

  it("renders unknown tile successfully", () => {

    const stores = specStores();
    const mockHandleTileResize = jest.fn();
    const mockToolApi: ITileApiInterface = {
      register: jest.fn(),
      unregister: jest.fn(),
      getTileApi: () => ({
        handleTileResize: mockHandleTileResize
      }),
      forEach: jest.fn()
    };
    const tileContentModel = UnknownContentModel.create();
    const toolTileModel = TileModel.create({ content: tileContentModel });

    const onResizeRow = jest.fn();
    const onSetCanAcceptDrop = jest.fn();
    const onRequestRowHeight = jest.fn();

    render(
      <Provider stores={stores}>
        <TileApiInterfaceContext.Provider value={mockToolApi}>
          <TileComponent
            context="context"
            docId="docId"
            documentContent={null}
            isUserResizable={true}
            model={toolTileModel}
            onResizeRow={onResizeRow}
            onSetCanAcceptDrop={onSetCanAcceptDrop}
            onRequestRowHeight={onRequestRowHeight}
            />
        </TileApiInterfaceContext.Provider>
      </Provider>
    );
    expect(screen.getByTestId("tool-tile")).toBeInTheDocument();

    const dragStartEvent = createEvent.dragStart(screen.getByTestId("tool-tile"));
    dragStartEvent.preventDefault = jest.fn();
    act(() => {
      fireEvent.dragStart(screen.getByTestId("tool-tile"), dragStartEvent);
      fireEvent.dragEnd(screen.getByTestId("tool-tile"));
    });
    // TODO: figure out why this doesn't work
    // expect(dragStartEvent.preventDefault).toHaveBeenCalled();

    // Unknown (=placeholder) tile cannot be dragged or resized.
    // expect(mockHandleTileResize).toHaveBeenCalled();
  });
});

describe("TileComponent focus trap", () => {

  afterEach(() => {
    if (mockToolbarElement?.parentNode) {
      mockToolbarElement.parentNode.removeChild(mockToolbarElement);
    }
    mockToolbarElement = null;
    mockTitleElement = null;
    mockContentElement = null;
  });

  // --- ARIA Attributes ---

  describe("ARIA attributes", () => {
    it("tile container has role='group' and aria-label with tile type", () => {
      const { tileElement } = renderFocusTrapTile();
      expect(tileElement).toHaveAttribute("role", "group");
      expect(tileElement).toHaveAttribute("aria-label", "TestTile tile");
    });

    it("aria-label includes computed title when model has title set", () => {
      const { tileElement, tileModel } = renderFocusTrapTile();
      act(() => { tileModel.setTitle("My Notes"); });
      expect(tileElement).toHaveAttribute("aria-label", "TestTile tile: My Notes");
    });

    it("tile container has tabIndex=0 (reachable via Tab)", () => {
      const { tileElement } = renderFocusTrapTile();
      expect(tileElement).toHaveAttribute("tabindex", "0");
    });
  });

  // --- Focus Trap Entry ---

  describe("focus trap entry (Tab on tile container)", () => {
    it("Tab enters at title when title exists", () => {
      const { tileElement, titleElement } = renderFocusTrapTile();
      act(() => { tileElement.focus(); });
      fireEvent.keyDown(tileElement, { key: "Tab" });
      expect(document.activeElement).toBe(titleElement);
    });

    it("Tab enters at toolbar button when no title", () => {
      const { tileElement, toolbarButtons } = renderFocusTrapTile({ hasTitle: false });
      act(() => { tileElement.focus(); });
      fireEvent.keyDown(tileElement, { key: "Tab" });
      expect(document.activeElement).toBe(toolbarButtons[0]);
    });

    it("Tab enters at content when only content exists", () => {
      const { tileElement, contentElement } = renderFocusTrapTile({
        hasTitle: false, hasToolbar: false,
      });
      act(() => { tileElement.focus(); });
      fireEvent.keyDown(tileElement, { key: "Tab" });
      expect(document.activeElement).toBe(contentElement);
    });

    it("entering announces 'Editing tile. Press Escape to exit.'", () => {
      const { tileElement } = renderFocusTrapTile();
      act(() => { tileElement.focus(); });
      fireEvent.keyDown(tileElement, { key: "Tab" });
      const liveRegion = tileElement.querySelector("[role='status'][aria-live='assertive']");
      expect(liveRegion?.textContent).toBe("Editing tile. Press Escape to exit.");
    });

    it("Shift+Tab enters at last element (content)", () => {
      const { tileElement, contentElement } = renderFocusTrapTile();
      act(() => { tileElement.focus(); });
      fireEvent.keyDown(tileElement, { key: "Tab", shiftKey: true });
      expect(document.activeElement).toBe(contentElement);
    });

    it("Shift+Tab enters at toolbar when no content", () => {
      const { tileElement, toolbarButtons } = renderFocusTrapTile({ hasContent: false });
      act(() => { tileElement.focus(); });
      fireEvent.keyDown(tileElement, { key: "Tab", shiftKey: true });
      expect(document.activeElement).toBe(toolbarButtons[0]);
    });

    it("Tab skips non-focusable title and enters at toolbar", () => {
      // Simulate a title element that exists in the DOM but can't receive focus
      // (e.g., .editable-tile-title-text rendered as a plain div)
      const { tileElement, toolbarButtons } = renderFocusTrapTile({ hasTitle: false });
      const nonFocusableTitle = document.createElement("div");
      nonFocusableTitle.textContent = "Title";
      tileElement.appendChild(nonFocusableTitle);
      mockTitleElement = nonFocusableTitle as unknown as HTMLInputElement;
      act(() => { tileElement.focus(); });
      fireEvent.keyDown(tileElement, { key: "Tab" });
      // Should skip the non-focusable title and land on toolbar
      expect(document.activeElement).toBe(toolbarButtons[0]);
    });
  });

  // --- Focus Trap Cycling (Tab forward) ---

  describe("focus trap cycling (Tab forward)", () => {
    it("Tab from title goes to toolbar button", () => {
      const { titleElement, toolbarButtons } = renderFocusTrapTile();
      act(() => { titleElement!.focus(); });
      fireEvent.keyDown(titleElement!, { key: "Tab" });
      expect(document.activeElement).toBe(toolbarButtons[0]);
    });

    it("Tab from content wraps to title", () => {
      const { contentElement, titleElement } = renderFocusTrapTile();
      act(() => { contentElement!.focus(); });
      fireEvent.keyDown(contentElement!, { key: "Tab" });
      expect(document.activeElement).toBe(titleElement);
    });

    it("Tab from content with no title/toolbar calls preventDefault (defensive)", () => {
      const { contentElement } = renderFocusTrapTile({
        hasTitle: false, hasToolbar: false,
      });
      act(() => { contentElement!.focus(); });
      // fireEvent returns false when preventDefault was called
      const result = fireEvent.keyDown(contentElement!, { key: "Tab" });
      expect(result).toBe(false);
      expect(document.activeElement).toBe(contentElement);
    });

    it("Tab from content skips non-focusable title and wraps to toolbar", () => {
      const { tileElement, contentElement, toolbarButtons } = renderFocusTrapTile({ hasTitle: false });
      const nonFocusableTitle = document.createElement("div");
      nonFocusableTitle.textContent = "Title";
      tileElement.appendChild(nonFocusableTitle);
      mockTitleElement = nonFocusableTitle as unknown as HTMLInputElement;
      act(() => { contentElement!.focus(); });
      fireEvent.keyDown(contentElement!, { key: "Tab" });
      // Should skip the non-focusable title and go to toolbar instead
      expect(document.activeElement).toBe(toolbarButtons[0]);
    });
  });

  // --- Focus Trap Cycling (Shift+Tab reverse) ---

  describe("focus trap cycling (Shift+Tab reverse)", () => {
    it("Shift+Tab from content goes to toolbar button", () => {
      const { contentElement, toolbarButtons } = renderFocusTrapTile();
      act(() => { contentElement!.focus(); });
      fireEvent.keyDown(contentElement!, { key: "Tab", shiftKey: true });
      expect(document.activeElement).toBe(toolbarButtons[0]);
    });

    it("Shift+Tab from title wraps to content", () => {
      const { titleElement, contentElement } = renderFocusTrapTile();
      act(() => { titleElement!.focus(); });
      fireEvent.keyDown(titleElement!, { key: "Tab", shiftKey: true });
      expect(document.activeElement).toBe(contentElement);
    });

    it("Shift+Tab from content with no title/toolbar calls preventDefault", () => {
      const { contentElement } = renderFocusTrapTile({
        hasTitle: false, hasToolbar: false,
      });
      act(() => { contentElement!.focus(); });
      const result = fireEvent.keyDown(contentElement!, { key: "Tab", shiftKey: true });
      expect(result).toBe(false);
      expect(document.activeElement).toBe(contentElement);
    });
  });

  // --- Escape ---

  describe("Escape exits focus trap", () => {
    it("Escape from content exits to tile container", () => {
      const { tileElement, contentElement } = renderFocusTrapTile();
      act(() => { contentElement!.focus(); });
      fireEvent.keyDown(contentElement!, { key: "Escape" });
      expect(document.activeElement).toBe(tileElement);
    });

    it("Escape from title exits to tile container", () => {
      const { tileElement, titleElement } = renderFocusTrapTile();
      act(() => { titleElement!.focus(); });
      fireEvent.keyDown(titleElement!, { key: "Escape" });
      expect(document.activeElement).toBe(tileElement);
    });

    it("Escape announces exit message", () => {
      const { tileElement, contentElement } = renderFocusTrapTile();
      act(() => { contentElement!.focus(); });
      fireEvent.keyDown(contentElement!, { key: "Escape" });
      const liveRegion = tileElement.querySelector("[role='status'][aria-live='assertive']");
      expect(liveRegion?.textContent).toBe("Exited tile. Tab to next tile, Shift+Tab to previous.");
    });
  });

  // --- Inter-Tile Navigation ---

  describe("inter-tile navigation (Escape + Tab)", () => {
    it("after Escape, Tab navigates to next sibling tile", () => {
      const { stores, model2, tile1, tile2 } = renderTwoTiles();
      act(() => { stores.ui.setSelectedTileId(model2.id); });

      // Enter focus trap on tile1, then Escape
      act(() => { tile1.focus(); });
      fireEvent.keyDown(tile1, { key: "Tab" });
      // Now inside trap — Escape back to tile container
      fireEvent.keyDown(tile1, { key: "Escape" });
      expect(document.activeElement).toBe(tile1);

      // Clear mocks so tile2's handleFocus auto-entry finds no focusable elements
      // and focus stays on tile2's container (shared mocks would land in tile1's DOM).
      mockTitleElement = null;
      mockContentElement = null;

      // Tab should navigate to tile2 (handleFocus auto-entry attempted, but no elements)
      fireEvent.keyDown(tile1, { key: "Tab" });
      expect(document.activeElement).toBe(tile2);
    });

    it("after Escape, Shift+Tab navigates to previous sibling tile", () => {
      const { stores, model2, tile1, tile2 } = renderTwoTiles();
      act(() => { stores.ui.setSelectedTileId(model2.id); });

      // Focus tile2, simulate escaped state via custom event
      act(() => { tile2.focus(); });
      tile2.dispatchEvent(new CustomEvent("toolbar-escape", { bubbles: false }));

      // Clear mocks so tile1's handleFocus auto-entry finds no focusable elements
      mockTitleElement = null;
      mockContentElement = null;

      // Shift+Tab should navigate to tile1
      fireEvent.keyDown(tile2, { key: "Tab", shiftKey: true });
      expect(document.activeElement).toBe(tile1);
    });

    it("clicking a tile resets escapedFocusTrap (next Tab re-enters trap)", () => {
      const { tileElement, titleElement } = renderFocusTrapTile();

      // Escape from inside the trap
      act(() => { titleElement!.focus(); });
      fireEvent.keyDown(titleElement!, { key: "Escape" });
      expect(document.activeElement).toBe(tileElement);

      // Click the tile (mousedown resets escapedFocusTrap)
      fireEvent.mouseDown(tileElement);

      // Tab should re-enter focus trap, not navigate to sibling
      fireEvent.keyDown(tileElement, { key: "Tab" });
      expect(document.activeElement).toBe(titleElement);
    });
  });

  // --- ArrowUp Exit ---

  describe("ArrowUp exit behavior", () => {
    it("ArrowUp from non-editable element exits to tile container", () => {
      // Content element WITHOUT contenteditable
      const { tileElement, contentElement } = renderFocusTrapTile({ contentEditable: false });
      act(() => { contentElement!.focus(); });
      fireEvent.keyDown(contentElement!, { key: "ArrowUp" });
      expect(document.activeElement).toBe(tileElement);
    });

    it("ArrowUp does not set escapedFocusTrap (next Tab re-enters trap)", () => {
      const { tileElement, contentElement, titleElement } = renderFocusTrapTile({
        contentEditable: false,
      });
      act(() => { contentElement!.focus(); });
      fireEvent.keyDown(contentElement!, { key: "ArrowUp" });
      expect(document.activeElement).toBe(tileElement);

      // Tab should re-enter focus trap (ArrowUp is a soft exit)
      fireEvent.keyDown(tileElement, { key: "Tab" });
      expect(document.activeElement).toBe(titleElement);
    });

    it("ArrowUp from input element does not exit trap", () => {
      // Tests the INPUT tagName check. The isContentEditable check also exists
      // but jsdom does not implement isContentEditable, so we test with <input>.
      const { tileElement, titleElement } = renderFocusTrapTile();
      act(() => { titleElement!.focus(); });
      fireEvent.keyDown(titleElement!, { key: "ArrowUp" });
      expect(document.activeElement).not.toBe(tileElement);
    });
  });

  // --- Custom Events ---

  describe("custom events", () => {
    it("toolbar-escape event sets escapedFocusTrap", () => {
      const { tileElement, titleElement } = renderFocusTrapTile();

      // Dispatch toolbar-escape (simulates Escape pressed in toolbar FloatingPortal)
      tileElement.dispatchEvent(new CustomEvent("toolbar-escape", { bubbles: false }));
      act(() => { tileElement.focus(); });

      // Tab should navigate to sibling (not re-enter trap)
      // Since there's no sibling, Tab falls through — but it should NOT enter the trap
      fireEvent.keyDown(tileElement, { key: "Tab" });
      // If it entered the trap, activeElement would be titleElement
      expect(document.activeElement).not.toBe(titleElement);
    });

    it("after Escape→Tab→Escape→Shift+Tab, returns to original tile", () => {
      const { stores, model2, tile1, tile2 } = renderTwoTiles();
      act(() => { stores.ui.setSelectedTileId(model2.id); });

      // Escape from tile1 (sets escapedFocusTrap)
      act(() => { tile1.focus(); });
      fireEvent.keyDown(tile1, { key: "Tab" }); // enter trap
      fireEvent.keyDown(tile1, { key: "Escape" }); // escape
      expect(document.activeElement).toBe(tile1);

      // Clear mocks so handleFocus auto-entry finds no elements
      mockTitleElement = null;
      mockContentElement = null;

      // Tab → tile2
      fireEvent.keyDown(tile1, { key: "Tab" });
      expect(document.activeElement).toBe(tile2);

      // Simulate Escape on tile2 (set via toolbar-escape since we can't enter trap with no mocks)
      tile2.dispatchEvent(new CustomEvent("toolbar-escape", { bubbles: false }));

      // Shift+Tab → back to tile1
      fireEvent.keyDown(tile2, { key: "Tab", shiftKey: true });
      expect(document.activeElement).toBe(tile1);
    });
  });

  // --- Enter to enter focus trap ---

  describe("Enter enters focus trap", () => {
    it("Enter on tile container enters focus trap at first element", () => {
      const { tileElement, titleElement } = renderFocusTrapTile();
      act(() => { tileElement.focus(); });
      fireEvent.keyDown(tileElement, { key: "Enter" });
      expect(document.activeElement).toBe(titleElement);
    });

    it("Enter enters focus trap even when escapedFocusTrap is true", () => {
      const { tileElement, titleElement } = renderFocusTrapTile();
      // Set escapedFocusTrap via toolbar-escape event
      tileElement.dispatchEvent(new CustomEvent("toolbar-escape", { bubbles: false }));
      act(() => { tileElement.focus(); });

      // Enter should still enter the trap (overrides navigation mode)
      fireEvent.keyDown(tileElement, { key: "Enter" });
      expect(document.activeElement).toBe(titleElement);
    });
  });

  // --- Generic tile behavior (tiles without getFocusableElements) ---

  describe("generic tile behavior (no getFocusableElements)", () => {
    it("Tab inside tile without cycling exits to tile container", () => {
      // Render a tile with no title, no content, no toolbar — simulates a tile
      // that doesn't implement getFocusableElements. Use a bare div inside the tile.
      const { tileElement } = renderFocusTrapTile({
        hasTitle: false, hasContent: false, hasToolbar: false,
      });
      const arbitraryChild = document.createElement("button");
      arbitraryChild.textContent = "Some button";
      tileElement.appendChild(arbitraryChild);

      act(() => { arbitraryChild.focus(); });
      expect(document.activeElement).toBe(arbitraryChild);

      // Tab should exit to tile container (catch-all)
      fireEvent.keyDown(arbitraryChild, { key: "Tab" });
      expect(document.activeElement).toBe(tileElement);
    });

    it("Tab on tile container with no focusable elements does inter-tile navigation", () => {
      const { tile1, tile2 } = renderTwoTiles();

      // Null out module-level mocks so tile2's getFocusableElements returns nothing.
      // (The closure reads refs at call time, not at registration time.)
      mockContentElement = null;
      mockTitleElement = null;

      act(() => { tile2.focus(); });
      // tile2 has no focusable elements, so Shift+Tab should navigate to tile1
      fireEvent.keyDown(tile2, { key: "Tab", shiftKey: true });
      expect(document.activeElement).toBe(tile1);
    });
  });

  // --- Screen Reader Live Region ---

  describe("screen reader live region", () => {
    it("live region element exists with correct ARIA attributes", () => {
      const { tileElement } = renderFocusTrapTile();
      const liveRegion = tileElement.querySelector("[role='status'][aria-live='assertive']");
      expect(liveRegion).toBeInTheDocument();
      expect(liveRegion).toHaveClass("visually-hidden");
    });

    it("live region content clears after timeout", () => {
      jest.useFakeTimers();
      const { tileElement } = renderFocusTrapTile();
      act(() => { tileElement.focus(); });
      fireEvent.keyDown(tileElement, { key: "Tab" });

      const liveRegion = tileElement.querySelector("[role='status'][aria-live='assertive']");
      expect(liveRegion?.textContent).toBe("Editing tile. Press Escape to exit.");

      act(() => { jest.advanceTimersByTime(2000); });
      expect(liveRegion?.textContent).toBe("");

      jest.useRealTimers();
    });
  });
});
