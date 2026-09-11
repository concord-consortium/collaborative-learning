// The variable resolver is registered by the shared-variables plugin, not by the highlight core —
// core code should not have to know what a variable is. Importing the registration below is what
// puts the resolver in the registry; without it, a variable reference resolves to nothing.
import { resolveHighlightReference } from "../../models/highlights/highlight-reference";

import "./shared-variables-registration";

describe("the variable resolver", () => {
  // A minimal stand-in for the content model. The resolver only walks tileMap and calls
  // getObjectsForVariable, so this is the entire surface it touches.
  // Every tile content model extends TileContentModel, which supplies a default
  // getObjectsForVariable returning [] (see the "empty apis" note in tile-content.ts), so a tile
  // that has no relationship to variables answers with [] rather than not answering at all.
  const contentWithTiles = (tiles: Array<{ id: string; objects?: any[] }>) => ({
    tileMap: new Map(tiles.map(t => [t.id, {
      id: t.id,
      content: { getObjectsForVariable: () => t.objects ?? [] }
    }]))
  }) as any;

  it("collects objects from every tile that implements the hook", () => {
    const content = contentWithTiles([
      { id: "df1", objects: [{ objectId: "n1", objectType: "Node" }] },
      { id: "df2", objects: [{ objectId: "n2", objectType: "Node" }] }
    ]);
    expect(resolveHighlightReference({ kind: "variable", variableId: "v1" }, content)).toEqual([
      { tileId: "df1", objectId: "n1", objectType: "Node" },
      { tileId: "df2", objectId: "n2", objectType: "Node" }
    ]);
  });

  it("contributes nothing for tiles with no objects for the variable", () => {
    const content = contentWithTiles([
      { id: "text1" },
      { id: "df1", objects: [{ objectId: "n1", objectType: "Node" }] }
    ]);
    expect(resolveHighlightReference({ kind: "variable", variableId: "v1" }, content))
      .toEqual([{ tileId: "df1", objectId: "n1", objectType: "Node" }]);
  });

  it("returns [] when no tile has a matching object", () => {
    const content = contentWithTiles([{ id: "df1", objects: [] }]);
    expect(resolveHighlightReference({ kind: "variable", variableId: "v1" }, content)).toEqual([]);
  });

  // Self-healing: resolution is re-run against current state every time, so a target that
  // disappears simply stops being returned. This is why a deleted node cannot leave a stale
  // highlight behind — unlike sparrows, which orphan because deleteTile never touches
  // `annotations` (base-document-content.ts:950-984).
  it("drops targets that no longer exist", () => {
    const objects = [{ objectId: "n1", objectType: "Node" }];
    const content = contentWithTiles([{ id: "df1", objects }]);
    expect(resolveHighlightReference({ kind: "variable", variableId: "v1" }, content)).toHaveLength(1);

    objects.length = 0;   // the node was deleted from the program
    expect(resolveHighlightReference({ kind: "variable", variableId: "v1" }, content)).toEqual([]);
  });
});
