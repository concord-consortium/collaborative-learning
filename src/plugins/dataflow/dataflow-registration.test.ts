// the tile component is not needed here and warns about missing CSS when imported under jest
jest.mock("./components/dataflow-tile", () => ({ __esModule: true, default: () => null }));

import { getTileContentInfo } from "../../models/tiles/tile-content-info";
import "./dataflow-registration";

describe("Dataflow schemaVersion", () => {
  const schemaVersion = getTileContentInfo("Dataflow")!.schemaVersion!;

  it("reports the program id as the version", () => {
    expect(schemaVersion.currentVersion).toBe("dataflow@1");
    expect(schemaVersion.getVersion({ content: { program: { id: "dataflow@0.1.0" } } })).toBe("dataflow@0.1.0");
    expect(schemaVersion.getVersion({ content: { program: { id: "dataflow@1" } } })).toBe("dataflow@1");
  });

  it("converts a legacy tile to the current version", () => {
    const legacy = { id: "t1", content: { type: "Dataflow", program: { id: "dataflow@0.1.0",
      nodes: { 1: { id: 1, name: "Number", data: { nodeValue: 3 }, inputs: {}, outputs: {}, x: 10, y: 20 } },
      values: { 1: { currentValues: { nodeValue: 3 } } } } } };
    const converted = schemaVersion.convertSnapshot(legacy);
    expect(schemaVersion.getVersion(converted)).toBe(schemaVersion.currentVersion);
    expect(Object.keys(converted.content.program.nodes)).toEqual(["1@t1"]);
  });

  it("treats a tile with no program as current", () => {
    expect(schemaVersion.getVersion({ content: {} })).toBe("dataflow@1");
  });
});
