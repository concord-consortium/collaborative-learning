// The drawing tile is a highlight TARGET for variable references (CLUE-620). The binding lives
// on VariableChipObject.variableId, which is stored directly rather than derived — unlike
// Dataflow, which matches on simulatedChannelId ("SIM" + variable.name). See docs/highlights.md.
//
// This lives under shared-variables rather than next to drawing-content because the behavior only
// exists when both plugins are registered: VariableChipObject is registered INTO the drawing tile
// by shared-variables-registration.
import { createDrawingContent } from "../../drawing/model/drawing-content";
import { RectangleObjectSnapshotForAdd } from "../../drawing/objects/rectangle";
import { VariableChipObjectSnapshotForAdd } from "./variable-object";
import {
  DocumentContentModel, DocumentContentSnapshotType
} from "../../../models/document/document-content";
import { IDocumentImportSnapshot } from "../../../models/document/document-content-import-types";
import { SharedModelDocumentManager } from "../../../models/document/shared-model-document-manager";
import { ITileEnvironment } from "../../../models/tiles/tile-content";

import "../../drawing/drawing-registration";
import "../shared-variables-registration";

function variableChip(id: string, variableId: string): VariableChipObjectSnapshotForAdd {
  return { id, type: "variable", x: 10, y: 10, variableId };
}

const rectangle: RectangleObjectSnapshotForAdd = {
  id: "rect1", type: "rectangle", x: 0, y: 0, width: 20, height: 20,
  fill: "#666666", stroke: "#888888", strokeDashArray: "3,3", strokeWidth: 5
};

describe("drawing content getObjectsForVariable", () => {
  it("returns the variable chip objects bound to the requested variable", () => {
    const content = createDrawingContent();
    content.addObject(variableChip("chip1", "v1"));
    content.addObject(variableChip("chip2", "v2"));

    expect(content.getObjectsForVariable("v1")).toEqual([
      { objectId: "chip1", objectType: "variable" }
    ]);
  });

  it("returns every chip bound to the variable when there is more than one", () => {
    const content = createDrawingContent();
    content.addObject(variableChip("chip1", "v1"));
    content.addObject(variableChip("chip2", "v1"));

    expect(content.getObjectsForVariable("v1").map(o => o.objectId)).toEqual(["chip1", "chip2"]);
  });

  it("ignores drawing objects that are not variable chips", () => {
    const content = createDrawingContent();
    content.addObject(rectangle);
    content.addObject(variableChip("chip1", "v1"));

    expect(content.getObjectsForVariable("v1")).toEqual([
      { objectId: "chip1", objectType: "variable" }
    ]);
  });

  it("returns nothing for a variable no chip references", () => {
    const content = createDrawingContent();
    content.addObject(variableChip("chip1", "v1"));

    expect(content.getObjectsForVariable("nope")).toEqual([]);
  });
});

// A composition guard rather than a unit test: it asserts the tile is reachable from a
// document-level variable reference at all, which depends on drawing-content routing through
// tileContentAPIViews. Unhooking that would leave the unit tests above green.
describe("a variable reference in the document", () => {
  function documentWithDrawingTile() {
    const sharedModelManager = new SharedModelDocumentManager();
    const environment: ITileEnvironment = { sharedModelManager };
    const snapshot: IDocumentImportSnapshot = {
      tiles: [{ id: "draw1", content: { type: "Drawing" } as any }]
    };
    const content = DocumentContentModel.create(snapshot as DocumentContentSnapshotType, environment);
    sharedModelManager.setDocument(content);
    return content;
  }

  it("highlights the drawing tile's chips for that variable, and nothing else", () => {
    const document = documentWithDrawingTile();
    const drawing = document.tileMap.get("draw1")!.content as any;
    drawing.addObject(variableChip("chip1", "v1"));
    drawing.addObject(variableChip("chip2", "v2"));

    document.setHoveredRef({ kind: "variable", variableId: "v1" });

    expect(document.objectState("draw1", "chip1")).toBe("preview");
    expect(document.objectState("draw1", "chip2")).toBeUndefined();
  });

  it("reports the pinned state for every chip bound to the variable", () => {
    const document = documentWithDrawingTile();
    const drawing = document.tileMap.get("draw1")!.content as any;
    drawing.addObject(variableChip("chip1", "v1"));
    drawing.addObject(variableChip("chip2", "v1"));

    document.setPinnedRef({ kind: "variable", variableId: "v1" });

    expect(document.objectState("draw1", "chip1")).toBe("pinned");
    expect(document.objectState("draw1", "chip2")).toBe("pinned");
  });
});
