import { renderHook } from "@testing-library/react";
import { addAttributeToDataSet } from "../../../models/data/data-set";
import { TableContentModel } from "../../../models/tiles/table/table-content";
import { TileModel } from "../../../models/tiles/tile-model";
import { kHeaderRowHeight } from "./table-types";
import { useRowHeight } from "./use-row-height";

// The table tile has to be registered for TileModel.create to accept its content.
import "../../../models/tiles/table/table-registration";

describe("useRowHeight headerHeight", () => {
  // jest-canvas-mock measures one pixel per character, so a heading needs one pixel per character.
  // The text wraps inside `.header-name`'s margins, which leave the column width less 32px.
  function heightFor(name: string, columnWidth = 200) {
    const content = TableContentModel.create();
    addAttributeToDataSet(content.dataSet, { id: "attr", name });
    const model = TileModel.create({ content });
    const { result } = renderHook(() => useRowHeight({
      dataSet: content.dataSet,
      measureColumnWidth: () => columnWidth,
      model
    }));
    return result.current.headerHeight();
  }

  it("leaves a short heading at one row", () => {
    expect(heightFor("x")).toBe(kHeaderRowHeight);
  });

  it("leaves a heading that just fits at one row", () => {
    expect(heightFor("a".repeat(160))).toBe(kHeaderRowHeight);
  });

  it("grows for a heading too long to fit on one line", () => {
    expect(heightFor("a".repeat(400))).toBeGreaterThan(kHeaderRowHeight);
  });
});
