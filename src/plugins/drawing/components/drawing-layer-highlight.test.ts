// The highlight objects/state are derived from objectState, and that derivation is exported as
// collectHighlightedObjects so it can be unit tested directly. Rendering the drawing layer itself
// requires a full tile environment and SVG layout, which is not worth standing up here; the
// rendered result is covered by Cypress in highlight_references_spec.js.
import { DrawingObjectType } from "../objects/drawing-object";
import { collectHighlightedObjects } from "./drawing-layer";
import { HighlightState } from "../../../models/document/document-content-with-highlights";

// The helper only reads `id`, so these stand in for real drawing objects.
const objectWithId = (id: string) => ({ id } as DrawingObjectType);
const chip1 = objectWithId("chip1");
const chip2 = objectWithId("chip2");
const rect1 = objectWithId("rect1");

function stateMap(states: Record<string, HighlightState>) {
  return (objectId: string) => states[objectId];
}

describe("collectHighlightedObjects", () => {
  it("reports no objects and no state when the document highlights nothing", () => {
    expect(collectHighlightedObjects([chip1, rect1], stateMap({}))).toEqual({
      objects: [], state: undefined
    });
  });

  it("collects the highlighted objects and reports their shared state", () => {
    expect(collectHighlightedObjects([chip1, rect1], stateMap({ chip1: "preview" }))).toEqual({
      objects: [chip1], state: "preview"
    });
  });

  it("reports pinned when the active reference is pinned", () => {
    expect(collectHighlightedObjects([chip1], stateMap({ chip1: "pinned" }))).toEqual({
      objects: [chip1], state: "pinned"
    });
  });

  it("collects every highlighted object when a variable has several chips", () => {
    const result = collectHighlightedObjects(
      [chip1, rect1, chip2], stateMap({ chip1: "preview", chip2: "preview" })
    );
    expect(result.objects).toEqual([chip1, chip2]);
    expect(result.state).toBe("preview");
  });
});
