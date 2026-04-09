import { Provider } from "mobx-react";
import React from "react";
import { types } from "mobx-state-tree";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { ITileProps, TileComponent } from "./tile-component";
import { TileApiInterface, TileApiInterfaceContext } from "./tile-api";
import { specStores } from "../../models/stores/spec-stores";
import { TileModel } from "../../models/tiles/tile-model";
import { TileContentModel } from "../../models/tiles/tile-content";
import { registerTileContentInfo } from "../../models/tiles/tile-content-info";
import { registerTileComponentInfo } from "../../models/tiles/tile-component-info";

// required before tile creation
import "../../register-tile-types";

/**
 * Tests for the didDrag flag in TileComponent.
 *
 * The didDrag flag prevents a pick-up from triggering after a short HTML5 drag-and-release.
 * Sequence: dragStart sets didDrag=true -> dragEnd fires -> click fires ->
 *           handlePickUpClick sees didDrag=true, consumes it, skips pick-up.
 */

// --- Register a simple test tile type ---

const kTestDragType = "TestDragTile";

const TestDragContent = TileContentModel
  .named("TestDragContent")
  .props({
    type: types.optional(types.literal(kTestDragType), kTestDragType),
  });

const TestDragComponent: React.FC<ITileProps> = () => {
  return <div data-testid="test-drag-content">Test drag content</div>;
};

registerTileContentInfo({
  type: kTestDragType,
  displayName: "TestDrag",
  modelClass: TestDragContent as typeof TileContentModel,
  defaultContent: () => TestDragContent.create(),
});

registerTileComponentInfo({
  type: kTestDragType,
  Component: TestDragComponent as unknown as React.ComponentType<ITileProps>,
  tileEltClass: "test-drag-tile",
});

// --- Render helpers ---

function renderTileForDrag() {
  const stores = specStores();
  const tileModel = TileModel.create({ content: TestDragContent.create() });
  const tileApiInterface = new TileApiInterface();

  const result = render(
    <Provider stores={stores}>
      <TileApiInterfaceContext.Provider value={tileApiInterface}>
        <div className="document-content">
          <TileComponent
            context="context"
            docId="test-doc"
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

  const dragHandle = screen.getByTestId("tool-tile-drag-handle");

  return { stores, tileModel, dragHandle, ...result };
}

function renderTwoTilesForDrag() {
  const stores = specStores();
  const tileModelA = TileModel.create({ content: TestDragContent.create() });
  const tileModelB = TileModel.create({ content: TestDragContent.create() });
  const tileApiInterface = new TileApiInterface();

  const result = render(
    <Provider stores={stores}>
      <TileApiInterfaceContext.Provider value={tileApiInterface}>
        <div className="document-content">
          <TileComponent
            context="context"
            docId="test-doc"
            documentContent={null}
            isUserResizable={false}
            model={tileModelA}
            onResizeRow={jest.fn()}
            onSetCanAcceptDrop={jest.fn()}
            onRequestRowHeight={jest.fn()}
          />
          <TileComponent
            context="context"
            docId="test-doc"
            documentContent={null}
            isUserResizable={false}
            model={tileModelB}
            onResizeRow={jest.fn()}
            onSetCanAcceptDrop={jest.fn()}
            onRequestRowHeight={jest.fn()}
          />
        </div>
      </TileApiInterfaceContext.Provider>
    </Provider>
  );

  const dragHandles = screen.getAllByTestId("tool-tile-drag-handle");

  return {
    stores, tileModelA, tileModelB,
    handleA: dragHandles[0], handleB: dragHandles[1],
    ...result,
  };
}

// --- Tests ---

describe("TileComponent didDrag flag", () => {

  it("click without drag triggers pick-up", () => {
    const { stores, tileModel, dragHandle } = renderTileForDrag();

    // A plain click on the drag handle (no preceding drag events) should pick up the tile
    act(() => {
      fireEvent.click(dragHandle, { clientX: 100, clientY: 200 });
    });

    expect(stores.ui.pickedUpTileId).toBe(tileModel.id);
  });

  it("click after drag does NOT trigger pick-up", () => {
    const { stores, dragHandle } = renderTileForDrag();

    // Simulate the HTML5 drag sequence: dragStart -> dragEnd -> click
    act(() => {
      fireEvent.dragStart(dragHandle);
    });
    act(() => {
      fireEvent.dragEnd(dragHandle);
    });
    act(() => {
      fireEvent.click(dragHandle, { clientX: 100, clientY: 200 });
    });

    // The click after drag should be consumed by the didDrag flag -- no pick-up
    expect(stores.ui.pickedUpTileId).toBeUndefined();
  });

  it("second click after drag-then-click works", () => {
    const { stores, tileModel, dragHandle } = renderTileForDrag();

    // First: drag -> click (consumed, no pick-up)
    act(() => {
      fireEvent.dragStart(dragHandle);
    });
    act(() => {
      fireEvent.dragEnd(dragHandle);
    });
    act(() => {
      fireEvent.click(dragHandle, { clientX: 100, clientY: 200 });
    });
    expect(stores.ui.pickedUpTileId).toBeUndefined();

    // Second click (no preceding drag) should trigger pick-up
    act(() => {
      fireEvent.click(dragHandle, { clientX: 100, clientY: 200 });
    });
    expect(stores.ui.pickedUpTileId).toBe(tileModel.id);
  });

  it("drag during existing pick-up clears it", () => {
    const { stores, tileModelA, handleA, handleB } = renderTwoTilesForDrag();

    // Pick up tile A via click
    act(() => {
      fireEvent.click(handleA, { clientX: 100, clientY: 200 });
    });
    expect(stores.ui.pickedUpTileId).toBe(tileModelA.id);

    // Start dragging tile B -- should clear the picked-up state.
    // Must provide dataTransfer so handleTileDragStart doesn't bail before clearing pick-up.
    act(() => {
      fireEvent.dragStart(handleB, {
        dataTransfer: {
          setData: jest.fn(),
          setDragImage: jest.fn(),
        },
      });
    });

    expect(stores.ui.pickedUpTileId).toBeUndefined();
  });
});
