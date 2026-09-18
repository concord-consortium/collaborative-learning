import { handleDataflowTile } from "./handle-dataflow-tile";

// handleDataflowTile reads only tile.model.content (type/program/outputConfig) and tile.sharedDataSet,
// so a minimal literal exercises the unit-config note without a full normalized tile.
function dataflowTile(content: Record<string, any>, sharedDataSet?: any) {
  return { tile: { model: { content: { type: "Dataflow", ...content } }, sharedDataSet } } as any;
}

describe("handleDataflowTile — unit output config note", () => {
  it("adds no config note for a default unit (no outputConfig)", () => {
    const result = handleDataflowTile(dataflowTile({}));
    expect(result).not.toContain("only Live Device types");
    expect(result).not.toContain("proportion");
  });

  it("notes the restricted Live Device list", () => {
    const result = handleDataflowTile(dataflowTile({ outputConfig: { allowedOutputTypes: ["Servo", "Fan"] } }));
    expect(result).toContain("only Live Device types available are: Servo, Fan");
  });

  it("notes the Servo proportion mode with the 0-1 mapping", () => {
    const result = handleDataflowTile(dataflowTile({ outputConfig: { servoInputMode: "proportion" } }));
    expect(result).toContain("Servo output accepts a value from 0 to 1");
    expect(result).toContain("1 = full rotation");
    expect(result).toContain("Compare-block outputs");
  });

  // These notes name blocks to the AI, so they have to use the palette's words. The internal type
  // strings must not survive anywhere in the summary.
  it("names blocks by their display name, never by their internal type", () => {
    const result = handleDataflowTile(dataflowTile({
      outputConfig: { allowedOutputTypes: ["Servo"], servoInputMode: "proportion" }
    }));
    expect(result).not.toContain("Live Output");
    expect(result).not.toContain("Logic");
  });

  it("returns undefined for a non-dataflow tile", () => {
    const result = handleDataflowTile({ tile: { model: { content: { type: "Table" } } } } as any);
    expect(result).toBeUndefined();
  });
});
