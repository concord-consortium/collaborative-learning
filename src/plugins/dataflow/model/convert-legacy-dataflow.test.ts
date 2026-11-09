import { tileSnapshotPreProcessor } from "../dataflow-registration";
import legacyDataflow from "../test-docs/dataflow-0.1.0.json";
import { convertLegacyDataflowProgram } from "./convert-legacy-dataflow";
import { DataflowContentModel } from "./dataflow-content";
import { STATE_VERSION_CURRENT } from "./dataflow-state-versions";

describe("tileSnapshotPreProcessor", () => {
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

describe("convertLegacyDataflowProgram", () => {
  it("converts a legacy program added without an id", () => {
    const program = {
      nodes: { 1: { id: 1, name: "Number", x: 10, y: 20, inputs: {}, outputs: {}, data: { plot: false } } },
      values: { 1: { currentValues: { nodeValue: 4 } } }
    };
    const converted = convertLegacyDataflowProgram("t1", program);
    expect(converted.id).toBe(STATE_VERSION_CURRENT);
    expect(converted.nodes["1@t1"].data.value).toBe(4);
  });
  it("leaves a program without an id or a values map as it is", () => {
    const program = { nodes: {} };
    expect(convertLegacyDataflowProgram("t1", program)).toBe(program);
  });
});
