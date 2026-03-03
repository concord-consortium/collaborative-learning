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

  describe("Tab on tile container (does NOT enter focus trap)", () => {
    it("Tab does not enter focus trap (focus stays on container)", () => {
      const { tileElement, titleElement } = renderFocusTrapTile();
      act(() => { tileElement.focus(); });
      fireEvent.keyDown(tileElement, { key: "Tab" });
      // Tab on unselected tile navigates to sibling (or stays if no sibling)
      expect(document.activeElement).not.toBe(titleElement);
    });

    it("Tab does not select tile (ui.selectedTileIds unchanged)", () => {
      const { stores, tileModel, tileElement } = renderFocusTrapTile();
      act(() => { tileElement.focus(); });
      fireEvent.keyDown(tileElement, { key: "Tab" });
      expect(stores.ui.selectedTileIds).not.toContain(tileModel.id);
    });

    it("Shift+Tab does not enter focus trap", () => {
      const { tileElement, contentElement } = renderFocusTrapTile();
      act(() => { tileElement.focus(); });
      fireEvent.keyDown(tileElement, { key: "Tab", shiftKey: true });
      expect(document.activeElement).not.toBe(contentElement);
    });

    it("Tab on selected tile enters focus trap (toolbar reachable)", () => {
      const { stores, tileModel, tileElement, titleElement } = renderFocusTrapTile();
      // Pre-select the tile (simulates Enter or mouse click on prior frame)
      act(() => { stores.ui.setSelectedTileId(tileModel.id); });
      act(() => { tileElement.focus(); });
      fireEvent.keyDown(tileElement, { key: "Tab" });
      expect(document.activeElement).toBe(titleElement);
    });

    it("Shift+Tab on selected tile enters focus trap backward", () => {
      const { stores, tileModel, tileElement, contentElement } = renderFocusTrapTile();
      act(() => { stores.ui.setSelectedTileId(tileModel.id); });
      act(() => { tileElement.focus(); });
      fireEvent.keyDown(tileElement, { key: "Tab", shiftKey: true });
      expect(document.activeElement).toBe(contentElement);
    });

    it("Tab on selected tile without title/content enters focus trap and reaches toolbar", () => {
      const { stores, tileModel, tileElement, toolbarButtons } = renderFocusTrapTile({
        hasTitle: false, hasContent: false, hasToolbar: true,
      });
      act(() => { stores.ui.setSelectedTileId(tileModel.id); });
      act(() => { tileElement.focus(); });
      fireEvent.keyDown(tileElement, { key: "Tab" });
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
      const liveRegion = tileElement.querySelector("[role='status'][aria-live='polite']");
      expect(liveRegion?.textContent).toBe("Exited tile. Tab to next tile, Shift+Tab to previous.");
    });

    it("Escape after Enter unselects tile", () => {
      const { stores, tileModel, tileElement, titleElement } = renderFocusTrapTile();
      act(() => { tileElement.focus(); });
      // Enter selects and enters trap
      fireEvent.keyDown(tileElement, { key: "Enter" });
      expect(stores.ui.selectedTileIds).toContain(tileModel.id);
      expect(document.activeElement).toBe(titleElement);
      // Escape deselects
      fireEvent.keyDown(titleElement!, { key: "Escape" });
      expect(stores.ui.selectedTileIds).not.toContain(tileModel.id);
      expect(document.activeElement).toBe(tileElement);
    });

    it("Escape on selected tile container deselects (no focusable content case)", () => {
      // No title, content, or toolbar — simulates sketch/table tile on first frame
      // (toolbar renders via MobX after setSelectedTileId, so it's not in DOM yet)
      const { stores, tileModel, tileElement } = renderFocusTrapTile({
        hasTitle: false, hasContent: false, hasToolbar: false,
      });
      act(() => { tileElement.focus(); });
      // Enter selects but enterFocusTrap fails — focus stays on container
      fireEvent.keyDown(tileElement, { key: "Enter" });
      expect(stores.ui.selectedTileIds).toContain(tileModel.id);
      expect(document.activeElement).toBe(tileElement);
      // Escape should still deselect even though focus is on the container
      fireEvent.keyDown(tileElement, { key: "Escape" });
      expect(stores.ui.selectedTileIds).not.toContain(tileModel.id);
      expect(document.activeElement).toBe(tileElement);
    });

    it("Escape after mouse click unselects tile", () => {
      const { stores, tileModel, tileElement, contentElement } = renderFocusTrapTile();
      // Simulate mouse click selecting the tile
      act(() => { stores.ui.setSelectedTileId(tileModel.id); });
      act(() => { contentElement!.focus(); });
      // Escape always deselects, regardless of entry method
      fireEvent.keyDown(contentElement!, { key: "Escape" });
      expect(stores.ui.selectedTileIds).not.toContain(tileModel.id);
      expect(document.activeElement).toBe(tileElement);
    });
  });

  // --- Inter-Tile Navigation ---

  describe("inter-tile navigation", () => {
    it("Tab navigates to next sibling tile", () => {
      const { tile1, tile2 } = renderTwoTiles();
      act(() => { tile1.focus(); });
      // Tab on unselected tile navigates directly to sibling
      fireEvent.keyDown(tile1, { key: "Tab" });
      expect(document.activeElement).toBe(tile2);
    });

    it("Shift+Tab navigates to previous sibling tile", () => {
      const { tile1, tile2 } = renderTwoTiles();
      act(() => { tile2.focus(); });
      fireEvent.keyDown(tile2, { key: "Tab", shiftKey: true });
      expect(document.activeElement).toBe(tile1);
    });

    it("navigateToSiblingTile does not select destination tile", () => {
      const { stores, model2, tile1, tile2 } = renderTwoTiles();
      act(() => { tile1.focus(); });
      fireEvent.keyDown(tile1, { key: "Tab" });
      expect(document.activeElement).toBe(tile2);
      expect(stores.ui.selectedTileIds).not.toContain(model2.id);
    });

    it("after mouse click → Escape → Tab, navigates to sibling (no keyboard trap)", () => {
      const { stores, model1, tile1, tile2 } = renderTwoTiles();
      // Simulate mouse click selecting tile1
      act(() => { stores.ui.setSelectedTileId(model1.id); });
      // Focus inside tile1 (simulates content focus after click)
      if (mockTitleElement) {
        act(() => { mockTitleElement!.focus(); });
        // Escape deselects
        fireEvent.keyDown(mockTitleElement!, { key: "Escape" });
        expect(stores.ui.selectedTileIds).not.toContain(model1.id);
      }
      expect(document.activeElement).toBe(tile1);
      // Tab should navigate to sibling, not re-enter trap
      fireEvent.keyDown(tile1, { key: "Tab" });
      expect(document.activeElement).toBe(tile2);
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

    it("ArrowUp does not deselect (Tab re-enters trap on selected tile)", () => {
      const { stores, tileModel, tileElement, contentElement, titleElement } = renderFocusTrapTile({
        contentEditable: false,
      });
      // Select the tile first (simulates having entered via Enter)
      act(() => { stores.ui.setSelectedTileId(tileModel.id); });
      act(() => { contentElement!.focus(); });
      fireEvent.keyDown(contentElement!, { key: "ArrowUp" });
      expect(document.activeElement).toBe(tileElement);
      // Tile is still selected after ArrowUp (soft exit)
      expect(stores.ui.selectedTileIds).toContain(tileModel.id);
      // Tab should re-enter focus trap (tile is still selected)
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
    it("toolbar-escape event deselects tile and announces exit", () => {
      const { stores, tileModel, tileElement } = renderFocusTrapTile();
      // Select the tile (simulates having entered via Enter)
      act(() => { stores.ui.setSelectedTileId(tileModel.id); });

      // Dispatch toolbar-escape (simulates Escape pressed in toolbar FloatingPortal)
      tileElement.dispatchEvent(new CustomEvent("toolbar-escape", { bubbles: false }));

      // Tile should be deselected
      expect(stores.ui.selectedTileIds).not.toContain(tileModel.id);
      // SR announcement
      const liveRegion = tileElement.querySelector("[role='status'][aria-live='polite']");
      expect(liveRegion?.textContent).toBe("Exited tile. Tab to next tile, Shift+Tab to previous.");
    });

    it("Tab→Shift+Tab navigates between tiles", () => {
      const { tile1, tile2 } = renderTwoTiles();
      act(() => { tile1.focus(); });

      // Tab → tile2
      fireEvent.keyDown(tile1, { key: "Tab" });
      expect(document.activeElement).toBe(tile2);

      // Shift+Tab → back to tile1
      fireEvent.keyDown(tile2, { key: "Tab", shiftKey: true });
      expect(document.activeElement).toBe(tile1);
    });
  });

  // --- Enter to enter focus trap ---

  describe("Enter enters focus trap", () => {
    it("Enter selects tile unconditionally and enters focus trap", () => {
      const { stores, tileModel, tileElement, titleElement } = renderFocusTrapTile();
      expect(stores.ui.selectedTileIds).not.toContain(tileModel.id);
      act(() => { tileElement.focus(); });
      fireEvent.keyDown(tileElement, { key: "Enter" });
      // Tile is now selected
      expect(stores.ui.selectedTileIds).toContain(tileModel.id);
      // Focus moved to first element (title)
      expect(document.activeElement).toBe(titleElement);
    });

    it("Enter announces 'Editing tile. Press Escape to exit.'", () => {
      const { tileElement } = renderFocusTrapTile();
      act(() => { tileElement.focus(); });
      fireEvent.keyDown(tileElement, { key: "Enter" });
      const liveRegion = tileElement.querySelector("[role='status'][aria-live='polite']");
      expect(liveRegion?.textContent).toBe("Editing tile. Press Escape to exit.");
    });

    it("Enter on tile without focusable content selects tile, focus stays on container", () => {
      const { stores, tileModel, tileElement } = renderFocusTrapTile({
        hasTitle: false, hasContent: false, hasToolbar: false,
      });
      act(() => { tileElement.focus(); });
      fireEvent.keyDown(tileElement, { key: "Enter" });
      // Tile is selected even though enterFocusTrap failed
      expect(stores.ui.selectedTileIds).toContain(tileModel.id);
      // Focus stays on container
      expect(document.activeElement).toBe(tileElement);
      // Fallback announcement
      const liveRegion = tileElement.querySelector("[role='status'][aria-live='polite']");
      expect(liveRegion?.textContent).toBe("Tile selected. Press Tab to access toolbar, Escape to exit.");
    });

    it("Enter→Escape→Enter round-trip: selection toggles correctly", () => {
      const { stores, tileModel, tileElement, titleElement } = renderFocusTrapTile();
      act(() => { tileElement.focus(); });
      // Enter → selected, in trap
      fireEvent.keyDown(tileElement, { key: "Enter" });
      expect(stores.ui.selectedTileIds).toContain(tileModel.id);
      expect(document.activeElement).toBe(titleElement);
      // Escape → deselected, on container
      fireEvent.keyDown(titleElement!, { key: "Escape" });
      expect(stores.ui.selectedTileIds).not.toContain(tileModel.id);
      expect(document.activeElement).toBe(tileElement);
      // Enter again → selected, in trap
      fireEvent.keyDown(tileElement, { key: "Enter" });
      expect(stores.ui.selectedTileIds).toContain(tileModel.id);
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
      const liveRegion = tileElement.querySelector("[role='status'][aria-live='polite']");
      expect(liveRegion).toBeInTheDocument();
      expect(liveRegion).toHaveClass("visually-hidden");
    });

    it("live region content clears after timeout", () => {
      jest.useFakeTimers();
      const { tileElement } = renderFocusTrapTile();
      act(() => { tileElement.focus(); });
      fireEvent.keyDown(tileElement, { key: "Enter" });

      const liveRegion = tileElement.querySelector("[role='status'][aria-live='polite']");
      expect(liveRegion?.textContent).toBe("Editing tile. Press Escape to exit.");

      act(() => { jest.advanceTimersByTime(2000); });
      expect(liveRegion?.textContent).toBe("");

      jest.useRealTimers();
    });

    it("Tab announces 'Tile focused. Press Enter to edit.'", () => {
      const { tile1, tile2 } = renderTwoTiles();
      act(() => { tile1.focus(); });
      // Tab to tile2 — handleFocus on tile2 should announce
      fireEvent.keyDown(tile1, { key: "Tab" });
      expect(document.activeElement).toBe(tile2);
      const liveRegion = tile2.querySelector("[role='status'][aria-live='polite']");
      expect(liveRegion?.textContent).toBe("Tile focused. Press Enter to edit.");
    });
  });
});
