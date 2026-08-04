import { handleDataflowTile } from "./handle-dataflow-tile";

// handleDataflowTile reads only tile.model.content (type/program/outputConfig) and tile.sharedDataSet,
// so a minimal literal exercises the unit-config note without a full normalized tile.
function dataflowTile(content: Record<string, any>, sharedDataSet?: any) {
  return { tile: { model: { content: { type: "Dataflow", ...content } }, sharedDataSet } } as any;
}

describe("handleDataflowTile — unit output config note (CLUE-581)", () => {
  it("adds no config note for a default unit (no outputConfig)", () => {
    const result = handleDataflowTile(dataflowTile({}));
    expect(result).not.toContain("only Live Output types");
    expect(result).not.toContain("proportion");
  });

  it("notes the restricted Live Output list", () => {
    const result = handleDataflowTile(dataflowTile({ outputConfig: { allowedOutputTypes: ["Servo", "Fan"] } }));
    expect(result).toContain("only Live Output types available are: Servo, Fan");
  });

  it("notes the Servo proportion mode with the 0-1 mapping", () => {
    const result = handleDataflowTile(dataflowTile({ outputConfig: { servoInputMode: "proportion" } }));
    expect(result).toContain("Servo output accepts a value from 0 to 1");
    expect(result).toContain("1 = full rotation");
  });

  it("returns undefined for a non-dataflow tile", () => {
    const result = handleDataflowTile({ tile: { model: { content: { type: "Table" } } } } as any);
    expect(result).toBeUndefined();
  });
});
