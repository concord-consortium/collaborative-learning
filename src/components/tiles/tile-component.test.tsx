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

    it("Shift+Tab on selected tile enters focus trap on the drag handle", () => {
      const { stores, tileModel, tileElement } = renderFocusTrapTile();
      act(() => { stores.ui.setSelectedTileId(tileModel.id); });
      act(() => { tileElement.focus(); });
      fireEvent.keyDown(tileElement, { key: "Tab", shiftKey: true });
      // Reverse entry: resize (absent) → dragHandle; lands on the drag handle
      // (tabIndex=-1, focusable programmatically by the trap).
      const dragHandle = tileElement.querySelector('[data-testid="tool-tile-drag-handle"]');
      expect(document.activeElement).toBe(dragHandle);
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
    it("Tab from title goes to content", () => {
      const { stores, tileModel, titleElement, contentElement } = renderFocusTrapTile();
      act(() => { stores.ui.setSelectedTileId(tileModel.id); });
      act(() => { titleElement!.focus(); });
      fireEvent.keyDown(titleElement!, { key: "Tab" });
      expect(document.activeElement).toBe(contentElement);
    });

    it("Tab from content goes to toolbar button", () => {
      const { stores, tileModel, contentElement, toolbarButtons } = renderFocusTrapTile();
      act(() => { stores.ui.setSelectedTileId(tileModel.id); });
      act(() => { contentElement!.focus(); });
      fireEvent.keyDown(contentElement!, { key: "Tab" });
      expect(document.activeElement).toBe(toolbarButtons[0]);
    });

    it("Tab from content with no title/toolbar goes to drag handle", () => {
      const { stores, tileModel, tileElement, contentElement } = renderFocusTrapTile({
        hasTitle: false, hasToolbar: false,
      });
      act(() => { stores.ui.setSelectedTileId(tileModel.id); });
      act(() => { contentElement!.focus(); });
      fireEvent.keyDown(contentElement!, { key: "Tab" });
      // dragHandle is always present even when title/toolbar are absent
      const dragHandle = tileElement.querySelector('[data-testid="tool-tile-drag-handle"]');
      expect(document.activeElement).toBe(dragHandle);
    });

    it("Tab from content with no toolbar goes to drag handle", () => {
      const { stores, tileModel, tileElement, contentElement } = renderFocusTrapTile({ hasToolbar: false });
      act(() => { stores.ui.setSelectedTileId(tileModel.id); });
      act(() => { contentElement!.focus(); });
      fireEvent.keyDown(contentElement!, { key: "Tab" });
      // dragHandle is always present even when toolbar is absent
      const dragHandle = tileElement.querySelector('[data-testid="tool-tile-drag-handle"]');
      expect(document.activeElement).toBe(dragHandle);
    });
  });

  // --- Focus Trap Cycling (Shift+Tab reverse) ---

  describe("focus trap cycling (Shift+Tab reverse)", () => {
    it("Shift+Tab from content goes to title", () => {
      const { stores, tileModel, contentElement, titleElement } = renderFocusTrapTile();
      act(() => { stores.ui.setSelectedTileId(tileModel.id); });
      act(() => { contentElement!.focus(); });
      fireEvent.keyDown(contentElement!, { key: "Tab", shiftKey: true });
      expect(document.activeElement).toBe(titleElement);
    });

    it("Shift+Tab from title wraps backward to the drag handle", () => {
      const { stores, tileModel, tileElement, titleElement } = renderFocusTrapTile();
      act(() => { stores.ui.setSelectedTileId(tileModel.id); });
      act(() => { titleElement!.focus(); });
      fireEvent.keyDown(titleElement!, { key: "Tab", shiftKey: true });
      // Reverse: title → (wrap to end) → resize (absent) → dragHandle
      const dragHandle = tileElement.querySelector('[data-testid="tool-tile-drag-handle"]');
      expect(document.activeElement).toBe(dragHandle);
    });

    it("Shift+Tab from content with no title/toolbar goes to drag handle", () => {
      const { stores, tileModel, tileElement, contentElement } = renderFocusTrapTile({
        hasTitle: false, hasToolbar: false,
      });
      act(() => { stores.ui.setSelectedTileId(tileModel.id); });
      act(() => { contentElement!.focus(); });
      fireEvent.keyDown(contentElement!, { key: "Tab", shiftKey: true });
      // Reverse: content → title(absent) → (wrap) → resize(absent) → dragHandle(present)
      const dragHandle = tileElement.querySelector('[data-testid="tool-tile-drag-handle"]');
      expect(document.activeElement).toBe(dragHandle);
    });
  });

  // --- Tab within content (multiple focusable children) ---

  describe("Tab cycles through focusable children within content", () => {
    // These tests use native dispatchEvent because the Tab handler is a capture-phase listener.
    // React's fireEvent dispatches in bubble phase and won't trigger capture listeners.
    // jsdom returns zero-size bounding rects, so mock checkVisibility on test inputs
    function makeVisible(el: HTMLElement) {
      (el as any).checkVisibility = () => true;
    }

    it("Tab moves from first to second focusable child in content", () => {
      const { stores, tileModel, contentElement } = renderFocusTrapTile();
      act(() => { stores.ui.setSelectedTileId(tileModel.id); });
      const input1 = document.createElement("input");
      const input2 = document.createElement("input");
      makeVisible(input1);
      makeVisible(input2);
      contentElement!.appendChild(input1);
      contentElement!.appendChild(input2);
      act(() => { input1.focus(); });
      input1.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
      expect(document.activeElement).toBe(input2);
      contentElement!.removeChild(input1);
      contentElement!.removeChild(input2);
    });

    it("Shift+Tab moves from second to first focusable child in content", () => {
      const { stores, tileModel, contentElement } = renderFocusTrapTile();
      act(() => { stores.ui.setSelectedTileId(tileModel.id); });
      const input1 = document.createElement("input");
      const input2 = document.createElement("input");
      makeVisible(input1);
      makeVisible(input2);
      contentElement!.appendChild(input1);
      contentElement!.appendChild(input2);
      act(() => { input2.focus(); });
      input2.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true }));
      expect(document.activeElement).toBe(input1);
      contentElement!.removeChild(input1);
      contentElement!.removeChild(input2);
    });

    it("Tab from last focusable child exits content to toolbar", () => {
      const { stores, tileModel, contentElement, toolbarButtons } = renderFocusTrapTile();
      act(() => { stores.ui.setSelectedTileId(tileModel.id); });
      const input1 = document.createElement("input");
      const input2 = document.createElement("input");
      contentElement!.appendChild(input1);
      contentElement!.appendChild(input2);
      act(() => { input2.focus(); });
      input2.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
      expect(document.activeElement).toBe(toolbarButtons[0]);
      contentElement!.removeChild(input1);
      contentElement!.removeChild(input2);
    });

    it("Shift+Tab from first focusable child exits content to title", () => {
      const { stores, tileModel, contentElement, titleElement } = renderFocusTrapTile();
      act(() => { stores.ui.setSelectedTileId(tileModel.id); });
      const input1 = document.createElement("input");
      const input2 = document.createElement("input");
      contentElement!.appendChild(input1);
      contentElement!.appendChild(input2);
      act(() => { input1.focus(); });
      input1.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true }));
      expect(document.activeElement).toBe(titleElement);
      contentElement!.removeChild(input1);
      contentElement!.removeChild(input2);
    });
  });

  // --- Escape ---

  describe("Escape exits focus trap", () => {
    it("Escape from content exits to tile container", () => {
      const { stores, tileModel, tileElement, contentElement } = renderFocusTrapTile();
      act(() => { stores.ui.setSelectedTileId(tileModel.id); });
      act(() => { contentElement!.focus(); });
      fireEvent.keyDown(contentElement!, { key: "Escape" });
      expect(document.activeElement).toBe(tileElement);
    });

    it("Escape from title exits to tile container", () => {
      const { stores, tileModel, tileElement, titleElement } = renderFocusTrapTile();
      act(() => { stores.ui.setSelectedTileId(tileModel.id); });
      act(() => { titleElement!.focus(); });
      fireEvent.keyDown(titleElement!, { key: "Escape" });
      expect(document.activeElement).toBe(tileElement);
    });

    it("Escape announces exit message", () => {
      const { stores, tileModel, contentElement } = renderFocusTrapTile();
      act(() => { stores.ui.setSelectedTileId(tileModel.id); });
      act(() => { contentElement!.focus(); });
      fireEvent.keyDown(contentElement!, { key: "Escape" });
      // Controller announces via temporary document.body element
      const announcements = document.querySelectorAll("[role='status'][aria-live='polite']");
      const lastAnnouncement = announcements[announcements.length - 1];
      expect(lastAnnouncement?.textContent).toMatch(/exit/i);
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
      // No title, content, or toolbar — but drag handle is always present
      const { stores, tileModel, tileElement } = renderFocusTrapTile({
        hasTitle: false, hasContent: false, hasToolbar: false,
      });
      act(() => { tileElement.focus(); });
      // Enter selects and enters trap — focus moves to drag handle
      fireEvent.keyDown(tileElement, { key: "Enter" });
      expect(stores.ui.selectedTileIds).toContain(tileModel.id);
      const dragHandle = tileElement.querySelector('[data-testid="tool-tile-drag-handle"]') as HTMLElement;
      expect(document.activeElement).toBe(dragHandle);
      // Escape should deselect
      fireEvent.keyDown(dragHandle, { key: "Escape" });
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
      const { stores, tileModel, tileElement, contentElement } = renderFocusTrapTile({
        contentEditable: false,
      });
      // Select the tile and enter the trap via Enter (the standard keyboard entry path)
      act(() => { stores.ui.setSelectedTileId(tileModel.id); });
      fireEvent.keyDown(tileElement, { key: "Enter" });
      // Move focus to content, then ArrowUp to exit
      act(() => { contentElement!.focus(); });
      fireEvent.keyDown(contentElement!, { key: "ArrowUp" });
      expect(document.activeElement).toBe(tileElement);
      // Tile is still selected after ArrowUp (soft exit, not deselected)
      expect(stores.ui.selectedTileIds).toContain(tileModel.id);
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

    it("Enter on tile without focusable content enters trap via drag handle", () => {
      const { stores, tileModel, tileElement } = renderFocusTrapTile({
        hasTitle: false, hasContent: false, hasToolbar: false,
      });
      act(() => { tileElement.focus(); });
      fireEvent.keyDown(tileElement, { key: "Enter" });
      // Tile is selected and focus moves to drag handle (always present)
      expect(stores.ui.selectedTileIds).toContain(tileModel.id);
      const dragHandle = tileElement.querySelector('[data-testid="tool-tile-drag-handle"]');
      expect(document.activeElement).toBe(dragHandle);
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

  // --- Click-to-enter focus trap (onFocusEnter) ---

  describe("click-to-enter focus trap", () => {
    it("focusing a child element selects tile via onFocusEnter when unselected", () => {
      const { stores, tileModel, tileElement } = renderFocusTrapTile();
      expect(stores.ui.selectedTileIds).not.toContain(tileModel.id);

      // Spy on setSelectedTile to verify onFocusEnter triggers selection.
      const setSelectedSpy = jest.spyOn(stores.ui, "setSelectedTile");

      // Focus an element inside the tile, as if the user clicked it directly
      const child = document.createElement("button");
      tileElement.appendChild(child);
      act(() => { child.focus(); });

      expect(setSelectedSpy).toHaveBeenCalled();
      setSelectedSpy.mockRestore();
    });

    it("focusing a child element when already selected does not call setSelectedTileId again", () => {
      const { stores, tileModel, tileElement } = renderFocusTrapTile();
      // Pre-select the tile
      act(() => { stores.ui.setSelectedTileId(tileModel.id); });
      // onFocusEnter calls ui.setSelectedTile directly, so spy on that specific method.
      const setSelectedSpy = jest.spyOn(stores.ui, "setSelectedTile");

      const child = document.createElement("button");
      tileElement.appendChild(child);
      act(() => { child.focus(); });

      expect(setSelectedSpy).not.toHaveBeenCalled();
      setSelectedSpy.mockRestore();
    });
  });

  // --- Generic tile behavior (tiles without getFocusableElements) ---

  describe("generic tile behavior (no getFocusableElements)", () => {
    it("focusing child from outside auto-enters trap (click-to-enter behavior)", () => {
      // Focusing a child element from outside the tile auto-enters the focus trap
      // and selects the tile (via onFocusEnter). Tab then cycles within the trap
      // rather than navigating to a sibling tile.
      const { stores, model1, tile1 } = renderTwoTiles();
      const arbitraryChild = document.createElement("button");
      arbitraryChild.textContent = "Some button";
      tile1.appendChild(arbitraryChild);

      act(() => { arbitraryChild.focus(); });
      expect(document.activeElement).toBe(arbitraryChild);
      // The tile should now be selected (onFocusEnter fires)
      expect(stores.ui.selectedTileIds).toContain(model1.id);
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

  // Shared helper: renders a tile with isUserResizable=true so both resize
  // handle and drag handle are present. Used by resize and drag-handle tests.
  function renderResizableTile() {
    mockTitleElement = document.createElement("input");
    mockContentElement = document.createElement("div");
    mockContentElement.setAttribute("tabindex", "-1");
    mockToolbarElement = document.createElement("div");
    mockToolbarElement.setAttribute("role", "toolbar");
    const btn = document.createElement("button");
    btn.textContent = "Tool";
    btn.setAttribute("tabindex", "0");
    mockToolbarElement.appendChild(btn);
    document.body.appendChild(mockToolbarElement);

    const stores = specStores();
    const tileContent = TestFocusTrapContent.create();
    const tileModel = TileModel.create({ content: tileContent });
    const tileApiInterface = new TileApiInterface();
    const onRequestRowHeight = jest.fn();

    const result = render(
      <Provider stores={stores}>
        <TileApiInterfaceContext.Provider value={tileApiInterface}>
          <div className="document-content">
            <TileComponent
              context="context"
              docId="docId"
              documentContent={null}
              isUserResizable={true}
              height={250}
              model={tileModel}
              onResizeRow={jest.fn()}
              onSetCanAcceptDrop={jest.fn()}
              onRequestRowHeight={onRequestRowHeight}
            />
          </div>
        </TileApiInterfaceContext.Provider>
      </Provider>
    );

    const tileElement = screen.getByTestId("tool-tile");
    if (mockTitleElement) tileElement.appendChild(mockTitleElement);
    if (mockContentElement) tileElement.appendChild(mockContentElement);

    const resizeHandle = tileElement.querySelector(
      ".tool-tile-resize-handle-wrapper"
    ) as HTMLElement;
    const dragHandle = tileElement.querySelector(
      '[data-testid="tool-tile-drag-handle"]'
    ) as HTMLElement;

    return {
      stores, tileModel, tileElement, resizeHandle, dragHandle, onRequestRowHeight, ...result,
    };
  }

  describe("keyboard resize handle", () => {
    it("resize handle renders as button with aria-label", () => {
      const { resizeHandle } = renderResizableTile();
      expect(resizeHandle).toBeTruthy();
      expect(resizeHandle.tagName).toBe("BUTTON");
      expect(resizeHandle.getAttribute("aria-label")).toBe("Resize tile height");
      // No separator role - this is a standalone resize button, not a divider
      expect(resizeHandle.getAttribute("role")).toBeNull();
    });

    it("ArrowDown increases tile height", () => {
      const { resizeHandle, onRequestRowHeight } = renderResizableTile();
      act(() => { resizeHandle.focus(); });
      fireEvent.keyDown(resizeHandle, { key: "ArrowDown" });
      expect(onRequestRowHeight).toHaveBeenCalledWith(expect.any(String), 260);
    });

    it("ArrowUp decreases tile height", () => {
      const { resizeHandle, onRequestRowHeight } = renderResizableTile();
      act(() => { resizeHandle.focus(); });
      fireEvent.keyDown(resizeHandle, { key: "ArrowUp" });
      expect(onRequestRowHeight).toHaveBeenCalledWith(expect.any(String), 240);
    });

    it("Shift+ArrowDown uses large step", () => {
      const { resizeHandle, onRequestRowHeight } = renderResizableTile();
      act(() => { resizeHandle.focus(); });
      fireEvent.keyDown(resizeHandle, { key: "ArrowDown", shiftKey: true });
      expect(onRequestRowHeight).toHaveBeenCalledWith(expect.any(String), 300);
    });

    it("ArrowUp on resize handle does not exit focus trap", () => {
      const { tileElement, resizeHandle, stores, tileModel } = renderResizableTile();
      // Select the tile first
      act(() => { stores.ui.setSelectedTileId(tileModel.id); });
      act(() => { resizeHandle.focus(); });
      fireEvent.keyDown(resizeHandle, { key: "ArrowUp" });
      // Focus should stay on resize handle, not exit to tile container
      expect(document.activeElement).toBe(resizeHandle);
      expect(document.activeElement).not.toBe(tileElement);
    });
  });

  // --- Drag Handle in Focus Trap ---

  describe("drag handle in focus trap", () => {
    it("drag handle has tabIndex -1", () => {
      const { tileElement } = renderFocusTrapTile();
      const dragHandle = tileElement.querySelector('[data-testid="tool-tile-drag-handle"]');
      expect(dragHandle).toBeTruthy();
      expect(dragHandle!.getAttribute("tabindex")).toBe("-1");
    });

    it("Tab from toolbar goes to drag handle", () => {
      const { stores, tileModel, tileElement, contentElement } = renderFocusTrapTile();
      act(() => { stores.ui.setSelectedTileId(tileModel.id); });
      // Tab from content goes to toolbar (tested elsewhere); Tab again from the
      // toolbar slot should reach dragHandle. Since the mock toolbar is outside the
      // tile DOM (FloatingPortal pattern), simulate by focusing content and tabbing
      // forward twice: content → toolbar → dragHandle.
      act(() => { contentElement!.focus(); });
      // First Tab: content → toolbar
      fireEvent.keyDown(contentElement!, { key: "Tab" });
      // Second Tab: toolbar → dragHandle (toolbar's own Tab handler runs in
      // production; here the focus trap controller handles it for the mock toolbar
      // element registered as an external element in the toolbar slot).
      // The mock toolbar button is outside tile DOM, so dispatch natively.
      const activeBtn = document.activeElement as HTMLElement;
      activeBtn.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
      const dragHandle = tileElement.querySelector('[data-testid="tool-tile-drag-handle"]');
      expect(document.activeElement).toBe(dragHandle);
    });

    it("Tab from drag handle goes to resize", () => {
      const { stores, tileModel, dragHandle, resizeHandle } = renderResizableTile();
      act(() => { stores.ui.setSelectedTileId(tileModel.id); });
      act(() => { dragHandle.focus(); });
      fireEvent.keyDown(dragHandle, { key: "Tab" });
      expect(document.activeElement).toBe(resizeHandle);
    });

    it("Shift+Tab from resize goes to drag handle", () => {
      const { stores, tileModel, dragHandle, resizeHandle } = renderResizableTile();
      act(() => { stores.ui.setSelectedTileId(tileModel.id); });
      act(() => { resizeHandle.focus(); });
      fireEvent.keyDown(resizeHandle, { key: "Tab", shiftKey: true });
      expect(document.activeElement).toBe(dragHandle);
    });
  });
});
