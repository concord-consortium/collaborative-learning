// The highlight objects/state are derived from objectHighlightState, and that derivation is exported as
// collectHighlightedObjects so it can be unit tested directly. Rendering the drawing layer itself
// requires a full tile environment and SVG layout, which is not worth standing up here; the
// rendered result is covered by Cypress in highlight_references_spec.js.
import { DrawingObjectType } from "../objects/drawing-object";
import { collectHighlightedObjects, shouldRingObject } from "./drawing-layer";
import { HighlightState } from "../../../models/document/document-content-with-highlights";

// collectHighlightedObjects only reads `id`, so these stand in for real drawing objects.
const objectWithId = (id: string) => ({ id } as DrawingObjectType);
const ringCandidate = (props: Partial<DrawingObjectType>) =>
  ({ id: "obj1", visible: true, animating: false, ...props } as DrawingObjectType);
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

// The rule these cover is the whole reason the function exists: an object the drawing renderer
// omits must not be ringed, or the highlight is a rectangle around empty space. Nothing else
// asserts it — the Cypress fixture has no hidden or animating objects.
describe("shouldRingObject", () => {
  it("rings an object the drawing renderer draws", () => {
    expect(shouldRingObject(ringCandidate({}), false)).toBe(true);
  });

  it("does not ring a hidden object", () => {
    expect(shouldRingObject(ringCandidate({ visible: false }), false)).toBe(false);
  });

  it("rings a hidden object that is selected, which the renderer still draws", () => {
    expect(shouldRingObject(ringCandidate({ visible: false }), true)).toBe(true);
  });

  it("does not ring an animating object, selected or not", () => {
    expect(shouldRingObject(ringCandidate({ animating: true }), false)).toBe(false);
    expect(shouldRingObject(ringCandidate({ animating: true }), true)).toBe(false);
  });
});
