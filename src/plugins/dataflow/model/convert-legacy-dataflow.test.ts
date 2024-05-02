import { tileSnapshotPreProcessor } from "../dataflow-registration";
import legacyDataflow from "../test-docs/dataflow-0.1.0.json";
import { DataflowContentModel } from "./dataflow-content";
import { STATE_VERSION_CURRENT } from "./dataflow-state-versions";

describe("convertLegacyDataflowContent", () => {
  it("should handle a legacy document", () => {
    const tile = legacyDataflow.tileMap.CIUYXl4cwYYrfP5t;
    const newTile = tileSnapshotPreProcessor(tile);
    // Make sure MST is happy loading the converted content
    // MST is pretty lax about this so this is not a guarantee this converted
    // document will display correctly
    DataflowContentModel.create(newTile.content);
  });
  it("should just return current document", () => {
    const mockTile = {content: {program: { id: STATE_VERSION_CURRENT }}};
    const convertedTile = tileSnapshotPreProcessor(mockTile);
    expect(convertedTile).toBe(mockTile);
  });
});
