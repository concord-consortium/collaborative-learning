import { describeTextObject } from "./handle-text-tile";

const content = {
  type: "Text",
  format: "slate",
  highlightedText: [{ id: "h1", text: "goes up by 10" }]
};

function describe_(objectId: string, objectType: string, variables: any[] = []) {
  return describeTextObject({
    tile: { id: "tx1", content }, objectId, objectType, dataSets: [], variables
  });
}

describe("describeTextObject", () => {
  it("quotes the words the student highlighted", () => {
    expect(describe_("h1", "highlight")).toBe('the highlighted text "goes up by 10"');
  });

  it("reports nothing for a highlight the tile no longer holds", () => {
    expect(describe_("gone", "highlight")).toBeUndefined();
  });

  // A variable chip's object id is the variable's id, and the variable itself lives in a shared
  // model, which normalize() has already collected.
  it("names a variable chip by the variable it shows", () => {
    expect(describe_("v1", "m2s-variable", [{ id: "v1", name: "speed", value: 12, unit: "m/s" }]))
      .toBe("the variable chip for speed (12 m/s)");
  });

  it("names a variable chip with no value by name alone", () => {
    expect(describe_("v1", "m2s-variable", [{ id: "v1", name: "speed" }]))
      .toBe("the variable chip for speed");
  });

  it("reports nothing for a chip whose variable is gone", () => {
    expect(describe_("v9", "m2s-variable", [{ id: "v1", name: "speed" }])).toBeUndefined();
  });
});
