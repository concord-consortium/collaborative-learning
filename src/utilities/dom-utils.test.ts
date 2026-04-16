import { getEditableTitleElement } from "./dom-utils";

describe("getEditableTitleElement", () => {
  it("returns undefined for null input", () => {
    expect(getEditableTitleElement(null)).toBeUndefined();
    expect(getEditableTitleElement(undefined)).toBeUndefined();
  });

  it("returns undefined when no .editable-tile-title wrapper exists", () => {
    const tile = document.createElement("div");
    tile.innerHTML = "<div>some content</div>";
    expect(getEditableTitleElement(tile)).toBeUndefined();
  });

  it("returns .editable-tile-title-text in view mode", () => {
    const tile = document.createElement("div");
    tile.innerHTML = `
      <div class="editable-tile-title">
        <div class="editable-tile-title-text" tabindex="0" role="button">My Title</div>
      </div>
    `;
    const result = getEditableTitleElement(tile);
    expect(result).toBe(tile.querySelector(".editable-tile-title-text"));
  });

  it("returns input element in edit mode", () => {
    const tile = document.createElement("div");
    tile.innerHTML = `
      <div class="editable-tile-title">
        <input type="text" value="My Title" />
      </div>
    `;
    const result = getEditableTitleElement(tile);
    expect(result).toBe(tile.querySelector("input"));
  });

  it("prefers input over title-text when both exist", () => {
    const tile = document.createElement("div");
    tile.innerHTML = `
      <div class="editable-tile-title">
        <input type="text" value="Editing" />
        <div class="editable-tile-title-text" tabindex="0">View Text</div>
      </div>
    `;
    const result = getEditableTitleElement(tile);
    expect(result).toBe(tile.querySelector("input"));
  });
});
