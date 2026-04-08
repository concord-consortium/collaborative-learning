import { act, render, fireEvent } from "@testing-library/react";
import { Provider } from "mobx-react";
import React from "react";
import { specStores } from "../../models/stores/spec-stores";
import { PickedUpTileGhost } from "../picked-up-tile-ghost";

describe("Document Content Pick-Up Behavior", () => {

  afterEach(() => {
    document.body.classList.remove("tile-picked-up");
  });

  describe("Keyboard Navigation (focusedDropZoneIndex)", () => {

    it("setFocusedDropZoneIndex sets and updates index", () => {
      const stores = specStores();
      stores.ui.pickUpTile("t1", "d1", "Text");
      expect(stores.ui.focusedDropZoneIndex).toBeUndefined();

      stores.ui.setFocusedDropZoneIndex(0);
      expect(stores.ui.focusedDropZoneIndex).toBe(0);

      stores.ui.setFocusedDropZoneIndex(1);
      expect(stores.ui.focusedDropZoneIndex).toBe(1);

      stores.ui.setFocusedDropZoneIndex(5);
      expect(stores.ui.focusedDropZoneIndex).toBe(5);
    });

    it("setFocusedDropZoneIndex can be reset to undefined", () => {
      const stores = specStores();
      stores.ui.pickUpTile("t1", "d1", "Text");
      stores.ui.setFocusedDropZoneIndex(3);
      expect(stores.ui.focusedDropZoneIndex).toBe(3);

      stores.ui.setFocusedDropZoneIndex(undefined);
      expect(stores.ui.focusedDropZoneIndex).toBeUndefined();
    });

    it("clearPickedUpTile resets focusedDropZoneIndex", () => {
      const stores = specStores();
      stores.ui.pickUpTile("t1", "d1", "Text");
      stores.ui.setFocusedDropZoneIndex(4);
      expect(stores.ui.focusedDropZoneIndex).toBe(4);

      stores.ui.clearPickedUpTile();
      expect(stores.ui.focusedDropZoneIndex).toBeUndefined();
      expect(stores.ui.pickedUpTileId).toBeUndefined();
    });
  });

  describe("Drop Zone Ordering", () => {
    // getDropZoneList is a private method on DocumentContentComponent.
    // We cannot access it directly without rendering the full component,
    // which requires heavy provider setup. Instead, we verify that the
    // focusedDropZoneIndex state can hold arbitrary non-negative indices,
    // which is the input the keyboard handler uses to index into the
    // drop zone list.

    it("focusedDropZoneIndex accepts any non-negative integer", () => {
      const stores = specStores();
      stores.ui.pickUpTile("t1", "d1", "Text");

      [0, 1, 10, 99].forEach(idx => {
        stores.ui.setFocusedDropZoneIndex(idx);
        expect(stores.ui.focusedDropZoneIndex).toBe(idx);
      });
    });
  });

  describe("Cancel Paths", () => {

    function renderGhostWithPickedUpTile() {
      const stores = specStores();
      const result = render(
        <Provider stores={stores}>
          <PickedUpTileGhost />
        </Provider>
      );
      act(() => {
        stores.ui.pickUpTile("t1", "d1", "Text", 100, 200);
      });
      expect(stores.ui.pickedUpTileId).toBe("t1");
      return { stores, ...result };
    }

    it("click outside cancels pick-up", () => {
      const { stores } = renderGhostWithPickedUpTile();

      // Clicking on body (not inside document-content, drag-handle, or delete-button)
      act(() => {
        fireEvent.mouseDown(document.body);
      });
      expect(stores.ui.pickedUpTileId).toBeUndefined();
    });

    it("click on .document-content does NOT cancel pick-up", () => {
      const { stores } = renderGhostWithPickedUpTile();

      // Create an element with the document-content class and append to body
      const docContent = document.createElement("div");
      docContent.className = "document-content";
      document.body.appendChild(docContent);

      try {
        act(() => {
          fireEvent.mouseDown(docContent);
        });
        expect(stores.ui.pickedUpTileId).toBe("t1");
      } finally {
        document.body.removeChild(docContent);
      }
    });

    it("click on .delete-button does NOT cancel pick-up", () => {
      const { stores } = renderGhostWithPickedUpTile();

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "delete-button";
      document.body.appendChild(deleteBtn);

      try {
        act(() => {
          fireEvent.mouseDown(deleteBtn);
        });
        expect(stores.ui.pickedUpTileId).toBe("t1");
      } finally {
        document.body.removeChild(deleteBtn);
      }
    });

    it("click on .tool-tile-drag-handle-wrapper does NOT cancel pick-up", () => {
      const { stores } = renderGhostWithPickedUpTile();

      const dragHandle = document.createElement("div");
      dragHandle.className = "tool-tile-drag-handle-wrapper";
      document.body.appendChild(dragHandle);

      try {
        act(() => {
          fireEvent.mouseDown(dragHandle);
        });
        expect(stores.ui.pickedUpTileId).toBe("t1");
      } finally {
        document.body.removeChild(dragHandle);
      }
    });

    it("click on child of .document-content does NOT cancel pick-up", () => {
      const { stores } = renderGhostWithPickedUpTile();

      const docContent = document.createElement("div");
      docContent.className = "document-content";
      const child = document.createElement("span");
      docContent.appendChild(child);
      document.body.appendChild(docContent);

      try {
        act(() => {
          fireEvent.mouseDown(child);
        });
        expect(stores.ui.pickedUpTileId).toBe("t1");
      } finally {
        document.body.removeChild(docContent);
      }
    });

    it("clearPickedUpTile removes the ghost from DOM", () => {
      const { stores } = renderGhostWithPickedUpTile();

      // Ghost should be present
      expect(document.body.querySelector("[aria-live='assertive']")).not.toBeNull();

      act(() => {
        stores.ui.clearPickedUpTile();
      });

      // Ghost should be gone
      expect(document.body.querySelector("[aria-live='assertive']")).toBeNull();
    });

    it("Escape key clears pick-up via clearPickedUpTile", () => {
      // The Escape key handler lives in DocumentContentComponent (private method).
      // We can't easily render that component, so we verify the underlying
      // action works correctly. The handler calls ui.clearPickedUpTile().
      const stores = specStores();
      stores.ui.pickUpTile("t1", "d1", "Text", 100, 200);
      stores.ui.setFocusedDropZoneIndex(2);
      expect(stores.ui.pickedUpTileId).toBe("t1");
      expect(stores.ui.focusedDropZoneIndex).toBe(2);

      // Simulate what the Escape handler does
      stores.ui.clearPickedUpTile();
      expect(stores.ui.pickedUpTileId).toBeUndefined();
      expect(stores.ui.focusedDropZoneIndex).toBeUndefined();
    });
  });

  describe("Placement (model layer)", () => {
    // The placement handler in DocumentContentComponent calls
    // content.userMoveTiles() for same-document moves and
    // content.handleDragCopyTiles() for cross-document copies.
    // Those methods are thoroughly tested in dc-tile-move-copy.test.ts.
    // Here we verify the UI state transitions that accompany placement.

    it("pick-up state is cleared after simulated placement", () => {
      const stores = specStores();
      stores.ui.pickUpTile("t1", "d1", "Text", 100, 200);
      stores.ui.setFocusedDropZoneIndex(3);

      // After placement, the handler calls clearPickedUpTile
      stores.ui.clearPickedUpTile();

      expect(stores.ui.pickedUpTileId).toBeUndefined();
      expect(stores.ui.pickedUpDocId).toBeUndefined();
      expect(stores.ui.pickedUpTileType).toBeUndefined();
      expect(stores.ui.pickedUpX).toBeUndefined();
      expect(stores.ui.pickedUpY).toBeUndefined();
      expect(stores.ui.focusedDropZoneIndex).toBeUndefined();
    });

    it("isTilePickedUp view reflects pick-up state", () => {
      const stores = specStores();
      expect(stores.ui.isTilePickedUp).toBe(false);

      stores.ui.pickUpTile("t1", "d1", "Text");
      expect(stores.ui.isTilePickedUp).toBe(true);

      stores.ui.clearPickedUpTile();
      expect(stores.ui.isTilePickedUp).toBe(false);
    });
  });
});
