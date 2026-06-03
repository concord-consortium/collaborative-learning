import { act, fireEvent, render } from "@testing-library/react";
import { Provider } from "mobx-react";
import React from "react";
import { specStores } from "../models/stores/spec-stores";
import { PickedUpTileGhost } from "./picked-up-tile-ghost";

describe("PickedUpTileGhost", () => {

  afterEach(() => {
    document.body.classList.remove("tile-picked-up");
  });

  it("renders nothing when no tile picked up", () => {
    const stores = specStores();
    const { container } = render(
      <Provider stores={stores}>
        <PickedUpTileGhost />
      </Provider>
    );
    expect(container.innerHTML).toBe("");
    expect(document.body.querySelector("[aria-live]")).toBeNull();
  });

  it("renders ghost when tile is picked up", () => {
    const stores = specStores();
    render(
      <Provider stores={stores}>
        <PickedUpTileGhost />
      </Provider>
    );
    act(() => {
      stores.ui.pickUpTile("t1", "d1", "Text", 100, 200);
    });
    const ghost = document.body.querySelector<HTMLElement>("[style*='position: fixed']");
    expect(ghost).not.toBeNull();
    expect(ghost!.style.position).toBe("fixed");
  });

  it("includes aria-live announcement", () => {
    const stores = specStores();
    render(
      <Provider stores={stores}>
        <PickedUpTileGhost />
      </Provider>
    );
    act(() => {
      stores.ui.pickUpTile("t1", "d1", "Text", 100, 200);
    });
    const announcement = document.body.querySelector("[aria-live='assertive']");
    expect(announcement).not.toBeNull();
    expect(announcement!.textContent).toContain("Tile picked up");
  });

  it("adds tile-picked-up class to body", () => {
    const stores = specStores();
    render(
      <Provider stores={stores}>
        <PickedUpTileGhost />
      </Provider>
    );
    act(() => {
      stores.ui.pickUpTile("t1", "d1", "Text", 100, 200);
    });
    expect(document.body.classList.contains("tile-picked-up")).toBe(true);
  });

  it("removes class when pick-up cleared", () => {
    const stores = specStores();
    render(
      <Provider stores={stores}>
        <PickedUpTileGhost />
      </Provider>
    );
    act(() => {
      stores.ui.pickUpTile("t1", "d1", "Text", 100, 200);
    });
    expect(document.body.classList.contains("tile-picked-up")).toBe(true);

    act(() => {
      stores.ui.clearPickedUpTile();
    });
    expect(document.body.classList.contains("tile-picked-up")).toBe(false);
  });

  it("initializes position from focused element on keyboard pick-up (no x/y)", () => {
    const stores = specStores();
    // Create a focusable element to act as the drag handle
    const handle = document.createElement("div");
    handle.className = "tool-tile-drag-handle-wrapper";
    handle.setAttribute("tabindex", "0");
    document.body.appendChild(handle);
    handle.getBoundingClientRect = () => ({
      left: 50, top: 80, width: 40, height: 20,
      right: 90, bottom: 100, x: 50, y: 80, toJSON: () => ""
    });
    handle.focus();

    render(
      <Provider stores={stores}>
        <PickedUpTileGhost />
      </Provider>
    );
    // Pick up without x/y to trigger keyboard path
    act(() => {
      stores.ui.pickUpTile("t1", "d1", "Text");
    });
    const ghost = document.body.querySelector<HTMLElement>("[style*='position: fixed']");
    expect(ghost).not.toBeNull();
    // Position should be center of handle (50+20=70, 80+10=90) plus offsets (-80, -4)
    expect(ghost!.style.left).toBe("-10px");
    expect(ghost!.style.top).toBe("86px");

    document.body.removeChild(handle);
  });

  it("ghost follows focusedDropZone position during keyboard navigation", () => {
    const stores = specStores();
    render(
      <Provider stores={stores}>
        <PickedUpTileGhost />
      </Provider>
    );
    act(() => {
      stores.ui.pickUpTile("t1", "d1", "Text", 100, 200);
    });

    // Simulate keyboard navigation setting drop zone position
    act(() => {
      stores.ui.setFocusedDropZonePosition(500, 300);
    });
    const ghost = document.body.querySelector<HTMLElement>("[style*='position: fixed']");
    expect(ghost).not.toBeNull();
    // 500 + (-80) = 420, 300 + (-4) = 296
    expect(ghost!.style.left).toBe("420px");
    expect(ghost!.style.top).toBe("296px");

    // Move to a different drop zone
    act(() => {
      stores.ui.setFocusedDropZonePosition(200, 150);
    });
    // 200 + (-80) = 120, 150 + (-4) = 146
    expect(ghost!.style.left).toBe("120px");
    expect(ghost!.style.top).toBe("146px");
  });

  it("clearPickedUpTile clears drop zone position", () => {
    const stores = specStores();
    act(() => {
      stores.ui.pickUpTile("t1", "d1", "Text", 100, 200);
      stores.ui.setFocusedDropZonePosition(500, 300);
    });
    expect(stores.ui.focusedDropZoneX).toBe(500);
    expect(stores.ui.focusedDropZoneY).toBe(300);

    act(() => {
      stores.ui.clearPickedUpTile();
    });
    expect(stores.ui.focusedDropZoneX).toBeUndefined();
    expect(stores.ui.focusedDropZoneY).toBeUndefined();
  });

  it("updates ghost position on mouse move", () => {
    const stores = specStores();
    render(
      <Provider stores={stores}>
        <PickedUpTileGhost />
      </Provider>
    );
    act(() => {
      stores.ui.pickUpTile("t1", "d1", "Text", 100, 200);
    });

    act(() => {
      fireEvent.mouseMove(document, { clientX: 300, clientY: 400 });
    });
    const ghost = document.body.querySelector<HTMLElement>("[style*='position: fixed']");
    expect(ghost).not.toBeNull();
    // 300 + (-80) = 220, 400 + (-4) = 396
    expect(ghost!.style.left).toBe("220px");
    expect(ghost!.style.top).toBe("396px");
  });
});
