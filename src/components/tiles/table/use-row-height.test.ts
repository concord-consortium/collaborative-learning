import { renderHook } from "@testing-library/react";
import { addAttributeToDataSet } from "../../../models/data/data-set";
import { TableContentModel } from "../../../models/tiles/table/table-content";
import { TileModel } from "../../../models/tiles/tile-model";
import { kHeaderRowHeight } from "./table-types";
import { useRowHeight } from "./use-row-height";

// The table tile has to be registered for TileModel.create to accept its content.
import "../../../models/tiles/table/table-registration";

describe("useRowHeight headerHeight", () => {
  // jest-canvas-mock measures one pixel per character, so a 150-character heading needs 150px.
  // In a 200px column that is one line against the old 32px padding (168px of room) and two
  // against the 72px the controls actually take (128px of room).
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

  it("grows for a heading that does not fit the space left by the controls", () => {
    expect(heightFor("a".repeat(150))).toBeGreaterThan(kHeaderRowHeight);
  });
});
