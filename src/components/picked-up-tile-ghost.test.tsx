import { act, render } from "@testing-library/react";
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
});
