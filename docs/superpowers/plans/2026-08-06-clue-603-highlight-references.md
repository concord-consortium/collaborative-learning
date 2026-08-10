# CLUE-603 Highlight References — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a text-tile variable chip highlight the Dataflow nodes bound to that variable — hover to preview, click to pin — via an extensible reference system.

**Architecture:** A `HighlightReference` discriminated union is resolved by a registry of per-kind resolvers into a set of `{tileId, objectId}` targets. The active reference lives in volatile (non-persisted) state on the document content model, mirroring how `DataSet` holds `caseSelection` for table↔graph linked selection. Each tile renders its own emphasis by reading that state — Dataflow adds a CSS class to its node — so there is no overlay layer and no coordinate math.

**Tech Stack:** TypeScript 4.9, React 18, MobX State Tree (Concord fork), Jest, Cypress, SCSS.

**Spec:** `docs/superpowers/specs/2026-08-04-clue-603-linked-representation-references-design.md`

**Branch:** `CLUE-603-linked-representation-references` (already exists, spec already committed)

## Global Constraints

- **Nothing is persisted.** No MST `.props()` are added anywhere. All new state is `.volatile()`. No changes to snapshots, import/export, or the Firebase sync path. A reviewer seeing a new `.props()` entry should reject the task.
- **`classNames` is required** for any conditional or computed className (project `CLAUDE.md`). Never template literals or string concatenation.
- **Fail quiet.** An unresolvable reference produces no highlight and no user-facing error. No thrown exceptions, no error UI.
- **`getDocumentContentFromNode` returns `undefined`** for detached MST trees (tests, standalone editors). Every call site must null-check.
- **Scope is increment 1 only.** Do not implement bidirectional highlighting, AI references, the drawing tile, Dataflow wires/groups, or text ranges. The spec's "Planned increments" section owns those.
- Run `npm run lint:build` before every commit. Run `npm run check:types` before the final commit of each task.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/models/highlights/highlight-reference.ts` | *(new)* The `HighlightReference` union, `IHighlightTarget`, the resolver registry, and both resolvers. Pure functions, no MST. |
| `src/models/highlights/highlight-reference.test.ts` | *(new)* Unit tests for the registry and resolvers. |
| `src/models/document/document-content-with-highlights.ts` | *(new)* MST composition layer holding volatile hovered/pinned refs and the tile-facing query views. |
| `src/models/document/document-content-with-highlights.test.ts` | *(new)* Unit tests for precedence, toggle, and self-healing. |
| `src/models/document/document-content.ts` | Extend the new layer instead of `DocumentContentModelWithTileDragging`; update the chain comment. |
| `src/models/tiles/tile-model-hooks.ts` | Add the optional `getObjectsForVariable` tile-content hook with a `[]` default. |
| `src/plugins/dataflow/model/dataflow-content.ts` | Implement `getObjectsForVariable` by scanning Sensor and Live Output nodes. |
| `src/utilities/mst-utils.ts` | Add `getTileIdFromNode`. |
| `src/plugins/dataflow/nodes/dataflow-node.tsx` | Read `objectState` and apply emphasis classes. |
| `src/plugins/dataflow/nodes/node-states.scss` | Emphasis styles. |
| `src/plugins/shared-variables/slate/variables-plugin.tsx` | Chip hover/click handlers driving the state. |
| `src/public/demo/docs/emg-highlight-demo.json` | *(new)* Demo document with an authored variable chip; doubles as the Cypress fixture. |
| `cypress/e2e/functional/tile_tests/highlight_references_spec.js` | *(new)* End-to-end hover/pin test. |

**Dependency order:** Task 1 → 2 → 3 → 4 → 5 → 6 → 7. Task 3 needs Task 2's hook; Task 4 needs Tasks 1 and 3; Tasks 5 and 6 need Task 4; Task 7 needs Tasks 5 and 6.

---

## Task 1: Reference type and resolver registry

Creates the vocabulary the whole feature is built on. Ships the `object` resolver only; the `variable` resolver arrives in Task 3 because it depends on the tile hook from Task 2.

**Files:**
- Create: `src/models/highlights/highlight-reference.ts`
- Test: `src/models/highlights/highlight-reference.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type HighlightReference = { kind: "object"; tileId: string; objectId: string; objectType?: string } | { kind: "variable"; variableId: string }`
  - `interface IHighlightTarget { tileId: string; objectId: string; objectType?: string }`
  - `type ReferenceResolver = (ref: HighlightReference, content: DocumentContentModelType) => IHighlightTarget[]`
  - `function registerReferenceResolver(kind: HighlightReference["kind"], resolver: ReferenceResolver): void`
  - `function resolveHighlightReference(ref: HighlightReference, content: DocumentContentModelType): IHighlightTarget[]`
  - `function highlightTargetKey(tileId: string, objectId: string): string`
  - `function sameHighlightReference(a: HighlightReference, b: HighlightReference): boolean`

- [ ] **Step 1: Write the failing test**

Create `src/models/highlights/highlight-reference.test.ts`:

```ts
import {
  HighlightReference, highlightTargetKey, registerReferenceResolver,
  resolveHighlightReference, sameHighlightReference
} from "./highlight-reference";

// The resolvers take the document content model, but neither the object resolver nor these
// tests read anything off it, so a bare cast keeps this file free of MST setup. The variable
// resolver gets real document content in its own test (Task 3).
const noContent = {} as any;

describe("highlightTargetKey", () => {
  it("joins tileId and objectId", () => {
    expect(highlightTargetKey("tile1", "node7")).toBe("tile1/node7");
  });
});

describe("sameHighlightReference", () => {
  it("matches identical object references", () => {
    const a: HighlightReference = { kind: "object", tileId: "t1", objectId: "o1" };
    const b: HighlightReference = { kind: "object", tileId: "t1", objectId: "o1" };
    expect(sameHighlightReference(a, b)).toBe(true);
  });

  it("distinguishes different object ids", () => {
    const a: HighlightReference = { kind: "object", tileId: "t1", objectId: "o1" };
    const b: HighlightReference = { kind: "object", tileId: "t1", objectId: "o2" };
    expect(sameHighlightReference(a, b)).toBe(false);
  });

  it("matches identical variable references", () => {
    expect(sameHighlightReference(
      { kind: "variable", variableId: "v1" },
      { kind: "variable", variableId: "v1" }
    )).toBe(true);
  });

  it("never matches across kinds", () => {
    expect(sameHighlightReference(
      { kind: "object", tileId: "t1", objectId: "v1" },
      { kind: "variable", variableId: "v1" }
    )).toBe(false);
  });
});

describe("resolveHighlightReference", () => {
  it("resolves an object reference to itself", () => {
    const ref: HighlightReference = {
      kind: "object", tileId: "tile1", objectId: "node7", objectType: "Node"
    };
    expect(resolveHighlightReference(ref, noContent))
      .toEqual([{ tileId: "tile1", objectId: "node7", objectType: "Node" }]);
  });

  it("returns [] for a kind with no registered resolver", () => {
    // "variable" has no resolver until Task 3.
    expect(resolveHighlightReference({ kind: "variable", variableId: "v1" }, noContent)).toEqual([]);
  });

  it("uses the most recently registered resolver for a kind", () => {
    // The registry is module-global, so this test must restore the real resolver rather than
    // leaving a stub behind for every test that runs after it in this file.
    const originalResults = resolveHighlightReference(
      { kind: "object", tileId: "t", objectId: "o" }, noContent
    );
    const restore = () => registerReferenceResolver("object", ref => {
      if (ref.kind !== "object") return [];
      return [{ tileId: ref.tileId, objectId: ref.objectId, objectType: ref.objectType }];
    });

    try {
      registerReferenceResolver("object", () => [{ tileId: "stub", objectId: "stub" }]);
      expect(resolveHighlightReference(
        { kind: "object", tileId: "t", objectId: "o" }, noContent
      )).toEqual([{ tileId: "stub", objectId: "stub" }]);
    } finally {
      restore();
    }

    // The real resolver is back in place for anything that runs after this.
    expect(resolveHighlightReference(
      { kind: "object", tileId: "t", objectId: "o" }, noContent
    )).toEqual(originalResults);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/models/highlights/highlight-reference.test.ts`
Expected: FAIL — "Cannot find module './highlight-reference'"

- [ ] **Step 3: Write the implementation**

Create `src/models/highlights/highlight-reference.ts`:

```ts
// The type-only import is deliberate. document-content.ts -> document-content-with-highlights.ts
// -> this file, so a value import would close a runtime require cycle. `import type` is erased
// at compile time and breaks it. Do not change this to a value import.
import type { DocumentContentModelType } from "../document/document-content";

/**
 * A resolved, concrete thing a tile can render emphasis on.
 */
export interface IHighlightTarget {
  tileId: string;
  objectId: string;
  objectType?: string;
}

/**
 * A reference to something that should be highlighted. Deliberately NOT named
 * TileReference/TileObjectReference: the "variable" kind carries no tileId and resolves
 * across multiple tiles, and a future "textRange" kind is not an object in CLUE's sense
 * (ClueObject / annotatableObjects all mean a discrete addressable thing with an id).
 */
export type HighlightReference =
  | { kind: "object"; tileId: string; objectId: string; objectType?: string }
  | { kind: "variable"; variableId: string };

export type ReferenceResolver =
  (ref: HighlightReference, content: DocumentContentModelType) => IHighlightTarget[];

const gResolvers = new Map<HighlightReference["kind"], ReferenceResolver>();

export function registerReferenceResolver(
  kind: HighlightReference["kind"], resolver: ReferenceResolver
) {
  gResolvers.set(kind, resolver);
}

/**
 * Resolve a reference to its targets. Fails quiet: an unknown kind yields no targets.
 */
export function resolveHighlightReference(
  ref: HighlightReference, content: DocumentContentModelType
): IHighlightTarget[] {
  return gResolvers.get(ref.kind)?.(ref, content) ?? [];
}

/**
 * Internal key for the resolved-target set. Dataflow node ids are nanoid(16), whose alphabet
 * excludes "/", so the separator is unambiguous for the ids handled today. A future kind
 * whose object ids may contain "/" needs a structural key instead.
 */
export function highlightTargetKey(tileId: string, objectId: string) {
  return `${tileId}/${objectId}`;
}

export function sameHighlightReference(a: HighlightReference, b: HighlightReference) {
  if (a.kind !== b.kind) return false;
  if (a.kind === "variable" && b.kind === "variable") return a.variableId === b.variableId;
  if (a.kind === "object" && b.kind === "object") {
    return a.tileId === b.tileId && a.objectId === b.objectId;
  }
  return false;
}

registerReferenceResolver("object", ref => {
  if (ref.kind !== "object") return [];
  return [{ tileId: ref.tileId, objectId: ref.objectId, objectType: ref.objectType }];
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/models/highlights/highlight-reference.test.ts`
Expected: PASS, 7 tests.

Note: the registry is module-global, so the last test restores the real `object` resolver in a `finally` block and then asserts the restoration took. Keep that structure — without it the stub leaks into every test that runs after it.

- [ ] **Step 5: Lint and type-check**

Run: `npm run lint:build && npm run check:types`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/models/highlights/highlight-reference.ts src/models/highlights/highlight-reference.test.ts
git commit -m "CLUE-603: add HighlightReference type and resolver registry"
```

---

## Task 2: `getObjectsForVariable` tile hook and Dataflow implementation

Adds the extension seam that keeps Dataflow knowledge out of core, and implements it for Dataflow.

The tile is asked for a **variableId**, not a `Variable` object, so the tile does its own lookup via its existing `sharedVariables` accessor. That keeps the resolver in Task 3 from needing any shared-model plumbing.

**Files:**
- Modify: `src/models/tiles/tile-model-hooks.ts:74-114`
- Modify: `src/plugins/dataflow/model/dataflow-content.ts:232-242`
- Test: `src/plugins/dataflow/model/dataflow-content.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `ITileContentAPIViews.getObjectsForVariable(variableId: string): IClueTileObject[]`, defaulting to `[]` for every tile that does not implement it. `IClueTileObject` is the existing `{ objectId: string, objectType?: string }` from `src/models/annotations/clue-object.ts`.

**Background the implementer needs:** Dataflow nodes never store a variable id. Only 2 of the 11 node types bind to a variable, and both do it through a derived string:

| Node type | Field | Value |
|---|---|---|
| `"Sensor"` | `sensor` | `simulatedChannel(variable).channelId`, i.e. `"SIM" + variable.name` |
| `"Live Output"` | `hubSelect` | `simulatedHubName(variable)`, i.e. `"Simulated " + variable.displayName` |

Always call the existing helpers rather than rebuilding those strings inline — they are the single definition and are already imported elsewhere in the plugin.

- [ ] **Step 1: Write the failing test**

Append to `src/plugins/dataflow/model/dataflow-content.test.ts`, inside the existing top-level `describe("DataflowContentModel", ...)` block:

```ts
  describe("getObjectsForVariable", () => {
    // A DataflowContentModel with no shared model attached: sharedVariables is undefined, so the
    // variable lookup fails and the scan must not run.
    it("returns [] when the tile has no shared variables", () => {
      const dcm = defaultDataflowContent();
      expect(dcm.getObjectsForVariable("anyId")).toEqual([]);
    });

    // Stub the sharedVariables view so this test exercises the matching logic without standing up
    // a whole document + SharedModelDocumentManager. The real wiring is covered by the Cypress
    // spec in Task 7.
    const withStubbedVariables = (dcm: any, variable: any) => {
      Object.defineProperty(dcm, "sharedVariables", {
        configurable: true,
        get: () => ({ getVariableById: (id: string) => (id === variable.id ? variable : undefined) })
      });
      return dcm;
    };

    const emgVariable = {
      id: "var-emg",
      name: "emg_key",
      displayName: "EMG",
      getType: () => undefined,
      computedUnit: "",
      computedValue: 0
    };

    it("matches a Sensor node bound to the variable's simulated channel", () => {
      const dcm = defaultDataflowContent();
      dcm.program.addNodeSnapshot({
        id: "sensor-1", name: "Sensor", x: 0, y: 0,
        data: { type: "Sensor", sensor: "SIMemg_key" }
      } as any);
      withStubbedVariables(dcm, emgVariable);
      expect(dcm.getObjectsForVariable("var-emg"))
        .toEqual([{ objectId: "sensor-1", objectType: "Node" }]);
    });

    it("matches a Live Output node bound to the variable's simulated hub", () => {
      const dcm = defaultDataflowContent();
      dcm.program.addNodeSnapshot({
        id: "output-1", name: "Live Output", x: 0, y: 0,
        data: { type: "Live Output", liveOutputType: "Grabber", hubSelect: "Simulated EMG" }
      } as any);
      withStubbedVariables(dcm, emgVariable);
      expect(dcm.getObjectsForVariable("var-emg"))
        .toEqual([{ objectId: "output-1", objectType: "Node" }]);
    });

    it("excludes node types that cannot bind to a variable", () => {
      const dcm = defaultDataflowContent();
      dcm.program.addNodeSnapshot({
        id: "number-1", name: "Number", x: 0, y: 0, data: { type: "Number", nodeValue: 5 }
      } as any);
      withStubbedVariables(dcm, emgVariable);
      expect(dcm.getObjectsForVariable("var-emg")).toEqual([]);
    });

    it("returns [] for an unknown variable id", () => {
      const dcm = defaultDataflowContent();
      dcm.program.addNodeSnapshot({
        id: "sensor-1", name: "Sensor", x: 0, y: 0,
        data: { type: "Sensor", sensor: "SIMemg_key" }
      } as any);
      withStubbedVariables(dcm, emgVariable);
      expect(dcm.getObjectsForVariable("no-such-variable")).toEqual([]);
    });

    // Documents the known pre-existing fragility rather than hiding it: because the binding is a
    // derived string rather than an id, renaming a variable silently orphans its nodes. If this
    // test starts failing, someone has changed the binding to be id-based — update the spec's
    // "variable<->node binding" section before changing this test.
    it("misses a renamed variable, because binding is by derived string", () => {
      const dcm = defaultDataflowContent();
      dcm.program.addNodeSnapshot({
        id: "sensor-1", name: "Sensor", x: 0, y: 0,
        data: { type: "Sensor", sensor: "SIMemg_key" }
      } as any);
      withStubbedVariables(dcm, { ...emgVariable, name: "renamed_key" });
      expect(dcm.getObjectsForVariable("var-emg")).toEqual([]);
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/plugins/dataflow/model/dataflow-content.test.ts -t getObjectsForVariable`
Expected: FAIL — `dcm.getObjectsForVariable is not a function`.

If instead it fails on `addNodeSnapshot`, check the actual action name on `DataflowProgram` in `src/plugins/dataflow/model/dataflow-program-model.ts` and use that; the node-creation call in `rete-manager.tsx:1217` shows the real usage.

- [ ] **Step 3: Add the hook to the tile-content API**

In `src/models/tiles/tile-model-hooks.ts`, extend the `ITileContentAPIViews` interface (currently ends at line 87):

```ts
export interface ITileContentAPIViews {
  /**
   * If the TileModel has no stored title,
   * the TileModel will call contentTitle on the content model.
   * This can be used so a content model can provide a computed title.
   */
  get contentTitle(): string | undefined,

  /**
   * Return a list of objects in the tile which can be annotated
   * see annotations.md for more info.
   */
  get annotatableObjects(): IClueTileObject[],

  /**
   * Return the objects in this tile associated with the given shared variable, for
   * highlighting. The tile resolves the id against its own shared model, because tiles
   * bind to variables in tile-specific ways (Dataflow, for instance, matches on a derived
   * string rather than the variable id).
   *
   * Defaults to [] — a tile that has no relationship to variables need not implement it.
   */
  getObjectsForVariable(variableId: string): IClueTileObject[],
}
```

And add the default to `tileContentAPIViews` (currently lines 102-109):

```ts
  const defaultHooks: ITileContentAPIViews = {
    get contentTitle() {
      return undefined;
    },
    get annotatableObjects(): IClueTileObject[] {
      return [];
    },
    getObjectsForVariable(variableId: string): IClueTileObject[] {
      return [];
    },
  };
```

`Object.defineProperties(..., Object.getOwnPropertyDescriptors(clientViews))` copies value descriptors as well as getters, so a plain method overrides correctly.

- [ ] **Step 4: Implement it for Dataflow**

In `src/plugins/dataflow/model/dataflow-content.ts`, add these imports alongside the existing ones:

```ts
import { simulatedChannel } from "./utilities/simulated-channel";
import { simulatedHubName } from "./utilities/simulated-output";
```

Then extend the existing `tileContentAPIViews` block (currently lines 232-242) to:

```ts
  .views(self => tileContentAPIViews({
    get contentTitle() {
      return self.dataSet.name;
    },
    get annotatableObjects(): IClueTileObject[] {
      return [...self.program.nodes.values()].map(node => ({
        objectId: node.id,
        objectType: "Node",
      }));
    },
    // Only Sensor and Live Output nodes bind to a variable, and both do it via a derived string
    // rather than the variable id. simulatedChannel/simulatedHubName are the single definition of
    // those strings — always go through them rather than rebuilding "SIM"/"Simulated " inline.
    getObjectsForVariable(variableId: string): IClueTileObject[] {
      const variable = self.sharedVariables?.getVariableById(variableId);
      if (!variable) return [];
      const channelId = simulatedChannel(variable).channelId;
      const hubName = simulatedHubName(variable);
      return [...self.program.nodes.values()]
        .filter(node => {
          const data = node.data as any;
          return (data.type === "Sensor" && data.sensor === channelId)
            || (data.type === "Live Output" && data.hubSelect === hubName);
        })
        .map(node => ({ objectId: node.id, objectType: "Node" }));
    },
  }))
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- src/plugins/dataflow/model/dataflow-content.test.ts`
Expected: PASS, including the 6 new `getObjectsForVariable` tests and all pre-existing ones.

- [ ] **Step 6: Lint and type-check**

Run: `npm run lint:build && npm run check:types`
Expected: no errors. If ESLint flags the unused `variableId` parameter in the default hook, rename it `_variableId`.

- [ ] **Step 7: Commit**

```bash
git add src/models/tiles/tile-model-hooks.ts src/plugins/dataflow/model/dataflow-content.ts \
        src/plugins/dataflow/model/dataflow-content.test.ts
git commit -m "CLUE-603: add getObjectsForVariable tile hook and Dataflow implementation"
```

---

## Task 3: The `variable` resolver

Closes the loop between Task 1's registry and Task 2's hook.

**Files:**
- Modify: `src/models/highlights/highlight-reference.ts`
- Test: `src/models/highlights/highlight-reference.test.ts`

**Interfaces:**
- Consumes: `registerReferenceResolver` (Task 1), `getObjectsForVariable` (Task 2).
- Produces: no new exports — registers the `"variable"` resolver as a side effect of importing the module.

- [ ] **Step 1: Write the failing test**

In `src/models/highlights/highlight-reference.test.ts`, add this block **before** the existing `describe("resolveHighlightReference", ...)` block, so the "uses the most recently registered resolver" test still runs last:

```ts
describe("the variable resolver", () => {
  // A minimal stand-in for DocumentContentModelType. The resolver only walks tileMap and calls
  // getObjectsForVariable, so this is the entire surface it touches.
  const contentWithTiles = (tiles: Array<{ id: string; objects?: any[] }>) => ({
    tileMap: new Map(tiles.map(t => [t.id, {
      id: t.id,
      content: t.objects
        ? { getObjectsForVariable: () => t.objects }
        : {} // a tile that does not implement the hook at all
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

  it("skips tiles that do not implement the hook", () => {
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
```

Also delete the now-obsolete assertion in the existing `resolveHighlightReference` block:

```ts
  it("returns [] for a kind with no registered resolver", () => {
    // "variable" has no resolver until Task 3.
    expect(resolveHighlightReference({ kind: "variable", variableId: "v1" }, noContent)).toEqual([]);
  });
```

and replace it with a check that does not depend on an unregistered kind:

```ts
  it("returns [] for an unregistered kind", () => {
    expect(resolveHighlightReference({ kind: "nope" } as any, noContent)).toEqual([]);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/models/highlights/highlight-reference.test.ts`
Expected: FAIL — the three new tests return `[]` instead of the expected targets.

- [ ] **Step 3: Write the implementation**

Append to `src/models/highlights/highlight-reference.ts`, after the `"object"` registration:

```ts
registerReferenceResolver("variable", (ref, content) => {
  if (ref.kind !== "variable") return [];
  const targets: IHighlightTarget[] = [];
  content.tileMap.forEach(tile => {
    // Tiles opt in by implementing getObjectsForVariable; the rest are skipped. The cast is
    // needed because tile.content is the union of every registered tile content model.
    const tileContent = tile.content as any;
    const objects = tileContent?.getObjectsForVariable?.(ref.variableId);
    objects?.forEach((object: { objectId: string; objectType?: string }) => {
      targets.push({ tileId: tile.id, objectId: object.objectId, objectType: object.objectType });
    });
  });
  return targets;
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/models/highlights/highlight-reference.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Lint and type-check**

Run: `npm run lint:build && npm run check:types`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/models/highlights/highlight-reference.ts src/models/highlights/highlight-reference.test.ts
git commit -m "CLUE-603: add the variable reference resolver"
```

---

## Task 4: Volatile highlight state on the document content model

**Files:**
- Create: `src/models/document/document-content-with-highlights.ts`
- Create: `src/models/document/document-content-with-highlights.test.ts`
- Modify: `src/models/document/document-content.ts:55-77`

**Interfaces:**
- Consumes: `HighlightReference`, `resolveHighlightReference`, `highlightTargetKey`, `sameHighlightReference` (Tasks 1 and 3).
- Produces, on `DocumentContentModelType`:
  - actions `setHoveredRef(ref)`, `clearHoveredRef()`, `setPinnedRef(ref)`, `clearPinnedRef()`, `togglePinnedRef(ref)`
  - views `activeRef`, `activeSource`, `isObjectActive(tileId, objectId): boolean`, `objectState(tileId, objectId): "preview" | "pinned" | undefined`

**Two rules the implementer must not get wrong:**

1. **Hover replaces pin; it does not add to it.** Exactly one reference is active at a time. While `hoveredRef` is set, the pinned reference's targets are *not* highlighted. On mouse-out the active reference reverts to `pinnedRef` rather than clearing.
2. **The resolved-target `Set` stays private.** Expose only `isObjectActive` / `objectState`. A future text-range kind has no id and cannot be represented as a `tileId/objectId` pair, so exposing the collection would make that a breaking refactor.

- [ ] **Step 1: Write the failing test**

Create `src/models/document/document-content-with-highlights.test.ts`:

```ts
// Must be first so mocks are set up before any other imports
import "./document-content-tests/dc-test-utils";
import { getSnapshot } from "mobx-state-tree";
import { DocumentContentModel, DocumentContentSnapshotType } from "./document-content";
import { registerTileTypes } from "../../register-tile-types";
import { IDocumentImportSnapshot } from "./document-content-import-types";
import { SharedModelDocumentManager } from "./shared-model-document-manager";
import { ITileEnvironment } from "../tiles/tile-content";
import { HighlightReference } from "../highlights/highlight-reference";

registerTileTypes(["Text"]);

function createDocumentContentModel(snapshot: IDocumentImportSnapshot) {
  const sharedModelManager = new SharedModelDocumentManager();
  const environment: ITileEnvironment = { sharedModelManager };
  const content = DocumentContentModel.create(snapshot as DocumentContentSnapshotType, environment);
  sharedModelManager.setDocument(content);
  return content;
}

// Object references resolve without any tile cooperation (the object resolver is the identity
// function), which lets these tests exercise precedence and toggling without a Dataflow tile.
const refA: HighlightReference = { kind: "object", tileId: "t1", objectId: "a" };
const refB: HighlightReference = { kind: "object", tileId: "t1", objectId: "b" };

describe("DocumentContentModelWithHighlights", () => {
  let content: ReturnType<typeof createDocumentContentModel>;

  beforeEach(() => {
    content = createDocumentContentModel({ tiles: [] });
  });

  it("has no active highlight by default", () => {
    expect(content.activeRef).toBeUndefined();
    expect(content.activeSource).toBeUndefined();
    expect(content.isObjectActive("t1", "a")).toBe(false);
  });

  it("reports a hovered reference as a preview", () => {
    content.setHoveredRef(refA);
    expect(content.isObjectActive("t1", "a")).toBe(true);
    expect(content.objectState("t1", "a")).toBe("preview");
  });

  it("reports a pinned reference as pinned", () => {
    content.setPinnedRef(refA);
    expect(content.objectState("t1", "a")).toBe("pinned");
  });

  it("returns undefined objectState for an object that is not active", () => {
    content.setPinnedRef(refA);
    expect(content.objectState("t1", "b")).toBeUndefined();
  });

  // The precedence rule: hover REPLACES pin rather than adding to it.
  it("hides the pinned targets while a different reference is hovered", () => {
    content.setPinnedRef(refA);
    content.setHoveredRef(refB);
    expect(content.isObjectActive("t1", "b")).toBe(true);
    expect(content.isObjectActive("t1", "a")).toBe(false);
  });

  it("reverts to the pinned reference on mouse-out rather than clearing", () => {
    content.setPinnedRef(refA);
    content.setHoveredRef(refB);
    content.clearHoveredRef();
    expect(content.isObjectActive("t1", "a")).toBe(true);
    expect(content.objectState("t1", "a")).toBe("pinned");
  });

  it("toggles a pinned reference off when the same reference is toggled again", () => {
    content.togglePinnedRef(refA);
    expect(content.isObjectActive("t1", "a")).toBe(true);
    content.togglePinnedRef(refA);
    expect(content.isObjectActive("t1", "a")).toBe(false);
  });

  it("replaces the pinned reference when a different one is toggled", () => {
    content.togglePinnedRef(refA);
    content.togglePinnedRef(refB);
    expect(content.isObjectActive("t1", "a")).toBe(false);
    expect(content.isObjectActive("t1", "b")).toBe(true);
  });

  it("reports the pinned state while hovering the reference that is already pinned", () => {
    content.setPinnedRef(refA);
    content.setHoveredRef(refA);
    // Not "preview" — hovering your own pinned chip must not visually downgrade it.
    expect(content.objectState("t1", "a")).toBe("pinned");
  });

  it("does not expose the resolved target collection", () => {
    // Guards rule 2 above: a future textRange kind cannot be expressed as tileId/objectId, so
    // the collection must stay private. Probe the REAL name — an earlier version of this test
    // probed a name the implementation never used, so it could not fail.
    expect((content as any).activeTargetKeys).toBeUndefined();
  });

  it("keeps highlight state out of the document snapshot", () => {
    // Guards the plan's single most important constraint. Without this, a future `.props()`
    // addition would make highlights persist to Firebase and pass the entire suite silently.
    const before = JSON.stringify(getSnapshot(content));
    content.setPinnedRef(refA);
    content.setHoveredRef(refB);
    expect(JSON.stringify(getSnapshot(content))).toBe(before);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/models/document/document-content-with-highlights.test.ts`
Expected: FAIL — `content.setHoveredRef is not a function`.

- [ ] **Step 3: Create the composition layer**

Create `src/models/document/document-content-with-highlights.ts`:

```ts
import { computed } from "mobx";
import { DocumentContentModelWithTileDragging } from "./drag-tiles";
import type { DocumentContentModelType } from "./document-content";
import {
  HighlightReference, highlightTargetKey, resolveHighlightReference, sameHighlightReference
} from "../highlights/highlight-reference";

/** The two ways an object can be emphasized. Task 5 imports this for its CSS-class mapping. */
export type HighlightState = "preview" | "pinned";

/**
 * This is one part of the DocumentContentModel. It holds the ephemeral highlight state that
 * lets one part of a document point at objects inside another tile.
 *
 * Everything here is VOLATILE and must stay that way. Highlights are per-user and
 * per-session: they are never persisted, never synced to Firebase, and never visible to
 * other people viewing the same document. Adding a `.props()` entry to this file would
 * change all three of those things.
 *
 * The pattern mirrors DataSet's volatile caseSelection/attributeSelection, which is how
 * table<->graph linked selection already works.
 */
export const DocumentContentModelWithHighlights = DocumentContentModelWithTileDragging
  .named("DocumentContentModelWithHighlights")
  .volatile(self => ({
    hoveredRef: undefined as HighlightReference | undefined,
    pinnedRef: undefined as HighlightReference | undefined,
  }))
  .views(self => ({
    /**
     * Exactly one reference is active at a time. Hover REPLACES pin rather than adding to it:
     * while previewing you want to see what you are previewing, and on mouse-out this reverts
     * to the pinned reference rather than clearing.
     */
    get activeRef(): HighlightReference | undefined {
      return self.hoveredRef ?? self.pinnedRef;
    },
    /**
     * Hovering the reference that is already pinned keeps reporting "pinned" — otherwise a user
     * mousing over the chip they just pinned would see the emphasis downgrade to preview and
     * restore on mouse-out, which is flicker with no meaning. Hover still replaces pin for any
     * DIFFERENT reference.
     */
    get activeSource(): HighlightState | undefined {
      if (self.hoveredRef) {
        return self.pinnedRef && sameHighlightReference(self.hoveredRef, self.pinnedRef)
          ? "pinned"
          : "preview";
      }
      if (self.pinnedRef) return "pinned";
      return undefined;
    },
  }))
  .views(self => {
    /**
     * PRIVATE BY CONSTRUCTION — a closure local, not a view. MST publishes every `.views()`
     * getter as an instance member, so writing this as a getter would make it public, typed API
     * on every document in the app. A text range (a planned later increment) has no id and
     * cannot be expressed as a tileId/objectId pair, so exposing this collection would make that
     * a breaking refactor.
     *
     * Memoization caveat: MobX only caches a computed while some reaction observes it. Read from
     * inside an observer/reaction — which is how Task 5's Dataflow node reads it — this resolves
     * once per reference change. Read outside any reaction, EVERY access re-resolves, sweeping
     * every tile's getObjectsForVariable. `objectState` reads it again after `isObjectActive`
     * already did, so an outside-reaction caller pays that twice. Callers must be observers.
     */
    const activeTargetKeys = computed(() => {
      const ref = self.activeRef;
      if (!ref) return new Set<string>();
      const targets = resolveHighlightReference(ref, self as unknown as DocumentContentModelType);
      return new Set(targets.map(target => highlightTargetKey(target.tileId, target.objectId)));
    });

    return {
      isObjectActive(tileId: string, objectId: string) {
        return activeTargetKeys.get().has(highlightTargetKey(tileId, objectId));
      },
      /**
       * Every active target shares one state, because only one reference is active at a time.
       * This can never return "pinned" for one object while returning "preview" for another in
       * the same render.
       */
      objectState(tileId: string, objectId: string): HighlightState | undefined {
        return activeTargetKeys.get().has(highlightTargetKey(tileId, objectId))
          ? self.activeSource
          : undefined;
      },
    };
  })
  .actions(self => ({
    setHoveredRef(ref: HighlightReference) {
      self.hoveredRef = ref;
    },
    clearHoveredRef() {
      self.hoveredRef = undefined;
    },
    setPinnedRef(ref: HighlightReference) {
      self.pinnedRef = ref;
    },
    clearPinnedRef() {
      self.pinnedRef = undefined;
    },
  }))
  .actions(self => ({
    togglePinnedRef(ref: HighlightReference) {
      if (self.pinnedRef && sameHighlightReference(self.pinnedRef, ref)) {
        self.clearPinnedRef();
      } else {
        self.setPinnedRef(ref);
      }
    },
  }));
```

- [ ] **Step 4: Slot the layer into the composition chain**

In `src/models/document/document-content.ts`, change the import on line 6:

```ts
import { DocumentContentModelWithHighlights } from "./document-content-with-highlights";
```

This replaces `import { DocumentContentModelWithTileDragging } from "./drag-tiles";` outright — that symbol appears only on lines 6, 58 (a comment) and 77 of this file, so nothing else needs it.

Change line 77 from `DocumentContentModelWithTileDragging.named("DocumentContent")` to:

```ts
export const DocumentContentModel = DocumentContentModelWithHighlights.named("DocumentContent")
```

And update the chain comment at lines 55-60 so it stays accurate:

```ts
/**
 * The DocumentContentModel builds on the combination of 4 other parts:
 * - BaseDocumentContentModel
 * - DocumentContentModelWithAnnotations
 * - DocumentContentModelWithTileDragging
 * - DocumentContentModelWithHighlights
 *
```

**Do not change the `.named("DocumentContent")` string** — `getDocumentContentFromNode` finds the model by that exact type name.

- [ ] **Step 5: Run the new tests and the existing document-content suite**

Run: `npm test -- src/models/document/`
Expected: PASS. The 9 new tests pass, and every pre-existing document test still passes — inserting a layer into the chain must not change any existing behavior.

- [ ] **Step 6: Lint and type-check**

Run: `npm run lint:build && npm run check:types`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/models/document/document-content-with-highlights.ts \
        src/models/document/document-content-with-highlights.test.ts \
        src/models/document/document-content.ts
git commit -m "CLUE-603: add volatile highlight state to the document content model"
```

---

## Task 5: Dataflow node emphasis rendering

**Files:**
- Modify: `src/utilities/mst-utils.ts` (add `getTileIdFromNode` next to `getDocumentContentFromNode` at line 35)
- Modify: `src/plugins/dataflow/nodes/dataflow-node.tsx:155-200`
- Modify: `src/plugins/dataflow/nodes/node-states.scss`

**Interfaces:**
- Consumes: `objectState` (Task 4).
- Produces: `getTileIdFromNode(target: IAnyStateTreeNode): string | undefined`; CSS classes `highlight-pinned` and `highlight-preview` on `.node`.

**Why this is cheap:** `CustomDataflowNode` is already a MobX `observer` (`dataflow-node.tsx:155`), already has the node id in scope (`const { id } = data;`, line 162), already builds `dynamicClasses` with `classNames` (line 184), and already reads MST observables mid-render to stay reactive — see the `inCollapsedGroup` comment at lines 179-182 documenting exactly that pattern.

- [ ] **Step 1: Add the tile-id helper**

In `src/utilities/mst-utils.ts`, add immediately after `getDocumentContentFromNode` (line 37):

```ts
/**
 * Returns the id of the TileModel containing `target`, if any. "TileModel" is the MST type
 * name; see getParentWithTypeName for why we match on the name rather than the type.
 */
export function getTileIdFromNode(target: IAnyStateTreeNode): string | undefined {
  return getParentWithTypeName(target, "TileModel")?.id;
}
```

- [ ] **Step 2: Write the failing test**

Create `src/plugins/dataflow/nodes/dataflow-node-highlight.test.ts`:

```ts
// The emphasis class is derived from objectState, which is what this test pins down. Rendering
// CustomDataflowNode itself requires a full rete editor + area plugin, which is not worth
// standing up for a class-name mapping; the rendered result is covered by Cypress in Task 7.
import { getTileIdFromNode } from "../../../utilities/mst-utils";
import { DocumentContentModel, DocumentContentSnapshotType } from "../../../models/document/document-content";
import { registerTileTypes } from "../../../register-tile-types";
import { IDocumentImportSnapshot } from "../../../models/document/document-content-import-types";
import { SharedModelDocumentManager } from "../../../models/document/shared-model-document-manager";
import { ITileEnvironment } from "../../../models/tiles/tile-content";

registerTileTypes(["Dataflow"]);

function createDocumentContentModel(snapshot: IDocumentImportSnapshot) {
  const sharedModelManager = new SharedModelDocumentManager();
  const environment: ITileEnvironment = { sharedModelManager };
  const content = DocumentContentModel.create(snapshot as DocumentContentSnapshotType, environment);
  sharedModelManager.setDocument(content);
  return content;
}

describe("Dataflow node highlight wiring", () => {
  it("finds the containing tile id from a node model", () => {
    const content = createDocumentContentModel({
      tiles: [{ id: "df1", content: { type: "Dataflow" } as any }]
    });
    const dataflowContent = content.getTileContent("df1") as any;
    dataflowContent.program.addNodeSnapshot({
      id: "node-1", name: "Number", x: 0, y: 0, data: { type: "Number", nodeValue: 1 }
    } as any);
    const node = dataflowContent.program.nodes.get("node-1");
    expect(getTileIdFromNode(node.data)).toBe("df1");
  });

  it("reports the emphasis state for a targeted node", () => {
    const content = createDocumentContentModel({
      tiles: [{ id: "df1", content: { type: "Dataflow" } as any }]
    });
    content.setPinnedRef({ kind: "object", tileId: "df1", objectId: "node-1" });
    expect(content.objectState("df1", "node-1")).toBe("pinned");
    expect(content.objectState("df1", "node-2")).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run test to verify it passes**

Run: `npm test -- src/plugins/dataflow/nodes/dataflow-node-highlight.test.ts`
Expected: PASS — Step 1 already added the helper, and Task 4 already supplied `objectState`.

This test is written after its implementation rather than before because it pins down the two *wiring* facts the component depends on — that a node model can find its tile id, and that highlight state reaches a real Dataflow tile — neither of which is new logic. The class-name mapping it feeds is verified end-to-end by Cypress in Task 7, since rendering `CustomDataflowNode` in Jest would require standing up a full rete editor and area plugin.

If it fails on `getTileIdFromNode is not a function`, Step 1 was skipped — go back and do it.

- [ ] **Step 4: Apply the classes in the component**

In `src/plugins/dataflow/nodes/dataflow-node.tsx`, add the import:

```ts
import { getDocumentContentFromNode, getTileIdFromNode } from "../../../utilities/mst-utils";
```

Replace lines 184-199 (the `dynamicClasses` assignment and the opening `<div>`) with:

```tsx
  // Reading these observables inside the observer's render is what keeps emphasis reactive —
  // the same pattern as inCollapsedGroup above. getDocumentContentFromNode returns undefined
  // for detached trees (tests, standalone editors), so both lookups are optional.
  const tileId = getTileIdFromNode(model);
  const documentContent = getDocumentContentFromNode(model);
  const emphasis = tileId ? documentContent?.objectState(tileId, id) : undefined;

  const dynamicClasses = classNames(
    "node",
    model.type.toLowerCase().replace(/ /g, "-"),
    {
      "selected": data.selected,
      "gate-active": node instanceof ControlNode && node.model.gateActive,
      "has-flow-in": node instanceof ControlNode && node.hasFlowIn(),
      "plot-open": showPlot,
      "collapsed-hidden": inCollapsedGroup,
      "highlight-pinned": emphasis === "pinned",
      "highlight-preview": emphasis === "preview",
    }
  );

  return (
    <div
      className={dynamicClasses}
      data-testid="node"
      tabIndex={0}
      role="group"
      aria-roledescription="block"
      aria-label={`${model.type} block: ${model.orderedDisplayName}`}
      onKeyDown={e => handleNodeKeyDown(e, node, reteManager)}
    >
```

This also completes the `CLAUDE.md` cleanup: the old line 194 built `className` with a template literal wrapping the `dynamicClasses` string, which is exactly what the project's `classNames` rule prohibits. Folding the static classes into the same call fixes it.

- [ ] **Step 5: Add the styles**

Append to `src/plugins/dataflow/nodes/node-states.scss` (it already imports `../components/dataflow-vars`, which defines the colors used here):

```scss
// Ephemeral highlight driven by a HighlightReference. Never persisted; see
// document-content-with-highlights.ts. Preview (hover) reads lighter than pinned (click) so a
// hover does not look like a commitment. outline is used rather than border so the node's own
// box model and rete's positioning are unaffected.
.node.highlight-preview {
  outline: 3px dashed $input-purple;
  outline-offset: 2px;
}

.node.highlight-pinned {
  outline: 3px solid $input-purple-outline;
  outline-offset: 2px;
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- src/plugins/dataflow/`
Expected: PASS, including all pre-existing Dataflow tests.

- [ ] **Step 7: Lint and type-check**

Run: `npm run lint:build && npm run check:types`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/utilities/mst-utils.ts src/plugins/dataflow/nodes/dataflow-node.tsx \
        src/plugins/dataflow/nodes/dataflow-node-highlight.test.ts \
        src/plugins/dataflow/nodes/node-states.scss
git commit -m "CLUE-603: render highlight emphasis on Dataflow nodes"
```

---

## Task 6: Text variable chip as the highlight source

**Files:**
- Modify: `src/plugins/shared-variables/slate/variables-plugin.tsx:254-304`
- Modify: `src/components/tiles/text/text-tile.scss`

**Interfaces:**
- Consumes: `setHoveredRef`, `clearHoveredRef`, `togglePinnedRef` (Task 4).
- Produces: `makeChipHighlightHandlers(documentContent: DocumentContentModelType | undefined, variableId: string | undefined): { onMouseEnter(): void; onMouseLeave(): void; onClick(): void }`, exported from `variables-plugin.tsx`. No later task consumes it; it is exported so the behavior is unit-testable without a Slate editor.

**The Slate risk, and the rule that manages it:** the chip is an inline void element inside a `contentEditable` region, so clicking it already means something to Slate. The click handler must **not** call `preventDefault()` or `stopPropagation()` — pinning and Slate's own chip selection have to coexist. Verify manually (Step 5) that typing, selecting, and deleting text in the tile still behave normally. If they do not, fall back to hover-only while editable and click-to-pin only when read-only.

- [ ] **Step 1: Write the failing test**

Create `src/plugins/shared-variables/slate/variables-plugin-highlight.test.ts`:

The handlers must be **testable without a Slate editor**, so they are built by an exported factory rather than defined inline in the component. Write the test against that factory.

```ts
// The chip's handlers are extracted into makeChipHighlightHandlers so they can be tested
// without standing up a Slate editor. The rendered interaction (that the handlers are actually
// attached to the right element) is covered by Cypress in Task 7.
import "../../../models/document/document-content-tests/dc-test-utils";
import {
  DocumentContentModel, DocumentContentSnapshotType
} from "../../../models/document/document-content";
import { registerTileTypes } from "../../../register-tile-types";
import { IDocumentImportSnapshot } from "../../../models/document/document-content-import-types";
import { SharedModelDocumentManager } from "../../../models/document/shared-model-document-manager";
import { ITileEnvironment } from "../../../models/tiles/tile-content";
import { makeChipHighlightHandlers } from "./variables-plugin";

registerTileTypes(["Text"]);

function createDocumentContentModel(snapshot: IDocumentImportSnapshot) {
  const sharedModelManager = new SharedModelDocumentManager();
  const environment: ITileEnvironment = { sharedModelManager };
  const content = DocumentContentModel.create(snapshot as DocumentContentSnapshotType, environment);
  sharedModelManager.setDocument(content);
  return content;
}

describe("makeChipHighlightHandlers", () => {
  it("previews on mouse-enter and clears on mouse-leave", () => {
    const content = createDocumentContentModel({ tiles: [] });
    const handlers = makeChipHighlightHandlers(content, "var-emg");

    handlers.onMouseEnter();
    expect(content.activeRef).toEqual({ kind: "variable", variableId: "var-emg" });
    expect(content.activeSource).toBe("preview");

    handlers.onMouseLeave();
    expect(content.activeRef).toBeUndefined();
  });

  it("pins on click and unpins on a second click", () => {
    const content = createDocumentContentModel({ tiles: [] });
    const handlers = makeChipHighlightHandlers(content, "var-emg");

    handlers.onClick();
    expect(content.activeSource).toBe("pinned");

    handlers.onClick();
    expect(content.activeRef).toBeUndefined();
  });

  it("lets a hovered chip take over from a pinned one, then restores the pin", () => {
    const content = createDocumentContentModel({ tiles: [] });
    const emg = makeChipHighlightHandlers(content, "var-emg");
    const gripper = makeChipHighlightHandlers(content, "var-gripper");

    emg.onClick();
    gripper.onMouseEnter();
    expect(content.activeRef).toEqual({ kind: "variable", variableId: "var-gripper" });

    gripper.onMouseLeave();
    expect(content.activeRef).toEqual({ kind: "variable", variableId: "var-emg" });
  });

  // A chip whose element has no reference, or that lives in a detached tree, must no-op rather
  // than throw. getDocumentContentFromNode returns undefined for detached trees.
  it("no-ops when there is no document content", () => {
    const handlers = makeChipHighlightHandlers(undefined, "var-emg");
    expect(() => {
      handlers.onMouseEnter();
      handlers.onMouseLeave();
      handlers.onClick();
    }).not.toThrow();
  });

  it("no-ops when there is no variable reference", () => {
    const content = createDocumentContentModel({ tiles: [] });
    const handlers = makeChipHighlightHandlers(content, undefined);

    handlers.onMouseEnter();
    handlers.onClick();
    expect(content.activeRef).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/plugins/shared-variables/slate/variables-plugin-highlight.test.ts`
Expected: FAIL — `makeChipHighlightHandlers is not a function` / has no exported member.

- [ ] **Step 3: Wire the handlers into the chip**

In `src/plugins/shared-variables/slate/variables-plugin.tsx`, add the import:

```ts
import { getDocumentContentFromNode } from "../../../utilities/mst-utils";
import { DocumentContentModelType } from "../../../models/document/document-content";
```

Add the exported factory at module scope, above `VariableComponent`:

```ts
/**
 * Builds the chip's highlight handlers. Exported and parameterized rather than defined inline
 * so the behavior is unit-testable without standing up a Slate editor.
 *
 * Both arguments are optional because either can legitimately be absent: getDocumentContentFromNode
 * returns undefined for detached trees (tests, standalone editors), and a malformed chip element
 * may carry no reference. Both cases no-op rather than throw.
 */
export function makeChipHighlightHandlers(
  documentContent: DocumentContentModelType | undefined,
  variableId: string | undefined
) {
  return {
    onMouseEnter: () => {
      if (variableId) documentContent?.setHoveredRef({ kind: "variable", variableId });
    },
    onMouseLeave: () => {
      documentContent?.clearHoveredRef();
    },
    onClick: () => {
      if (variableId) documentContent?.togglePinnedRef({ kind: "variable", variableId });
    },
  };
}
```

Then inside `VariableComponent`, after the existing `const reference = ...` line (264), add:

```tsx
  // The chip drives the document's ephemeral highlight state: hovering previews the Dataflow
  // nodes bound to this variable, clicking pins them. Nothing here is persisted.
  //
  // Deliberately no preventDefault/stopPropagation: the chip is an inline void inside a
  // contentEditable, and Slate's own selection handling has to keep working alongside this.
  const documentContent = variablesPlugin
    ? getDocumentContentFromNode(variablesPlugin.textContent)
    : undefined;
  const highlightHandlers = makeChipHighlightHandlers(documentContent, reference);
```

Then attach them to the outer span in the returned JSX (lines 293-303), leaving everything else unchanged:

```tsx
  return (
    <span
      className={classes}
      {...attributes}
      contentEditable={false}
      onMouseEnter={highlightHandlers.onMouseEnter}
      onMouseLeave={highlightHandlers.onMouseLeave}
      onClick={highlightHandlers.onClick}
    >
      {children}
      { variable ?
        <span ref={setChipEl} className="variable-chip-measure-wrapper">
          <VariableChip variable={variable} className={selectedClass} />
        </span> :
        `invalid reference: ${element.reference}`
      }
    </span>
  );
```

`variablesPlugin.textContent` is declared `public textContent` at `variables-plugin.tsx:45`, so no accessor change is needed.

Do **not** add handlers to the `isSerializing` branch above — that path emits the marker span for HTML export and must stay inert.

- [ ] **Step 4: Add a cursor affordance**

In `src/components/tiles/text/text-tile.scss`, near the existing `.highlight-chip` rules (around line 64-79), add:

```scss
// The variable chip is clickable (it pins a highlight), so it should not present a text cursor.
.slate-variable-chip {
  cursor: pointer;
}
```

- [ ] **Step 5: Manually verify Slate is undisturbed**

Run: `npm start`, open a unit that enables variable chips (`?unit=./demo/units/qa/content.json`), add a Text tile and a Simulator tile, insert a variable chip via the text toolbar's Insert Variable button, then confirm:

- typing before, after, and around the chip works
- selecting a range across the chip works
- backspace deletes the chip as a single unit
- clicking the chip does not scroll, jump the caret, or enter an odd selection state

If any of these regress, revert Step 3's `onClick` and apply the fallback: keep `onMouseEnter`/`onMouseLeave` unconditionally, and add `onClick` only when the tile is read-only. Record which path was taken in the commit message.

- [ ] **Step 6: Run tests, lint, type-check**

Run: `npm test -- src/plugins/shared-variables/ && npm run lint:build && npm run check:types`
Expected: PASS, no errors.

- [ ] **Step 7: Commit**

```bash
git add src/plugins/shared-variables/slate/variables-plugin.tsx \
        src/plugins/shared-variables/slate/variables-plugin-highlight.test.ts \
        src/components/tiles/text/text-tile.scss
git commit -m "CLUE-603: drive highlights from the text variable chip"
```

---

## Task 7: EMG demo document and end-to-end test

Produces the thing a person can actually look at, and the deterministic fixture the Cypress spec needs.

**Files:**
- Create: `src/public/demo/docs/emg-highlight-demo.json`
- Create: `cypress/e2e/functional/tile_tests/highlight_references_spec.js`

**Interfaces:**
- Consumes: everything from Tasks 1-6.
- Produces: nothing.

**Why an authored chip:** nothing in `src/public` currently contains an `m2s-variable` chip, so this is the first content exercising that path. Authoring the chip rather than inserting it at test time makes the Cypress run deterministic. Authored variable ids are stable because `simulator-content.ts:190` looks variables up **by name** first and only mints a `nanoid` when none is found — so a document shipping its own `SharedVariables` snapshot keeps the ids it declares.

- [ ] **Step 1: Build the demo document**

Start from `src/public/demo/docs/chipsimsetup.json`, which already has the exact structure needed — a text tile, a Dataflow tile with a Sensor and a Live Output, a Simulator tile, and a persisted `SharedVariables` whose `tiles` array already includes the text tile. Copy it to `src/public/demo/docs/emg-highlight-demo.json`, then make these changes:

1. Change the Simulator tile's `"simulation"` value to `"EMG_and_claw"`.
2. Replace the `SharedVariables` entry's `variables` array with the EMG set. Take the shape from `src/public/demo/docs/old-format-test-document.json`, which already carries EMG with fixed ids — read its shared model block and reuse the variable objects verbatim (`emg_key` / "EMG" with labels including `"input"` and `"sensor:emg-reading"`, and `gripper_key` with labels including `"output"` and `"live-output:Grabber"`). **Do not modify `old-format-test-document.json`** — it is used by `cypress/e2e/smoke/single_student_canvas_test.js:269`.
3. Point the Dataflow Sensor node's `data.sensor` at `"SIMemg_key"`.
4. Point the Dataflow Live Output node's `data.hubSelect` at `"Simulated Gripper"` and its `data.liveOutputType` at `"Grabber"`.
5. Replace the text tile's text with a paragraph containing an authored chip referencing the EMG variable's id:

```json
"text": ["<p>Watch the <span data-slate-type=\"m2s-variable\" data-slate-reference=\"PUT_EMG_VARIABLE_ID_HERE\"></span> signal drive your program.</p>"]
```

Substitute the EMG variable's actual `id` from step 2 for `PUT_EMG_VARIABLE_ID_HERE`. The attribute names are defined in `src/components/tiles/text/plugins/chip-serialization.ts:9-11`; do not invent different ones.

6. Confirm the `SharedVariables` entry's `tiles` array lists all three tile ids (text, dataflow, simulator).

- [ ] **Step 2: Verify the document loads and the demo works by hand**

Run: `npm start`, then open:

```
http://localhost:8080/editor/?appMode=qa&unit=./demo/units/qa/content.json&document=./demo/docs/emg-highlight-demo.json
```

Confirm:
- the text tile renders a chip reading "EMG" rather than `invalid reference: ...` (if it shows the error, the `data-slate-reference` id does not match the variable id in the shared model)
- hovering the chip outlines the Sensor node with a dashed outline
- moving the mouse away clears it
- clicking the chip outlines it solid, and it stays
- clicking again clears it

If nothing highlights but the chip renders, check that the Sensor node's `data.sensor` is exactly `"SIM" + variable.name`.

- [ ] **Step 3: Write the Cypress spec**

Create `cypress/e2e/functional/tile_tests/highlight_references_spec.js`:

```js
// NOTE: this spec deliberately does NOT use DataflowToolTile.getNode(). That helper builds the
// selector `.primary-workspace .node.<type>` (see getNodeText at DataflowToolTile.js:1), and
// `.primary-workspace` is a CLUE workspace class that does not exist on the standalone /editor/
// route this spec loads. The node class itself is what we assert on, so select it directly.
//
// The node's type class comes from `model.type.toLowerCase().replace(/ /g, "-")` in
// dataflow-node.tsx, so "Sensor" -> .sensor and "Live Output" -> .live-output.
const SENSOR_NODE = ".node.sensor";

// The demo document ships an authored variable chip, so this spec never has to drive the
// Insert Variable dialog — the starting state is deterministic.
const documentUrl = "/editor/?appMode=qa&unit=./demo/units/qa/content.json" +
  "&document=./demo/docs/emg-highlight-demo.json";

context("Highlight references", () => {
  beforeEach(() => {
    cy.visit(documentUrl);
    cy.get(SENSOR_NODE).should("exist");   // the document has finished loading
  });

  it("previews highlighted Dataflow nodes on chip hover and pins them on click", () => {
    cy.get(".slate-variable-chip").first().as("chip");

    // Nothing highlighted to start.
    cy.get(SENSOR_NODE).should("not.have.class", "highlight-preview");
    cy.get(SENSOR_NODE).should("not.have.class", "highlight-pinned");

    // Hover previews.
    cy.get("@chip").trigger("mouseenter");
    cy.get(SENSOR_NODE).should("have.class", "highlight-preview");

    // Mouse-out clears the preview.
    cy.get("@chip").trigger("mouseleave");
    cy.get(SENSOR_NODE).should("not.have.class", "highlight-preview");

    // Click pins, and it survives moving the mouse away.
    cy.get("@chip").click();
    cy.get("@chip").trigger("mouseleave");
    cy.get(SENSOR_NODE).should("have.class", "highlight-pinned");

    // Clicking again unpins.
    cy.get("@chip").click();
    cy.get(SENSOR_NODE).should("not.have.class", "highlight-pinned");
  });
});
```

If `cy.visit` on the `/editor/` route does not settle reliably, add `cy.waitForLoad()` in
`beforeEach` — but the `should("exist")` guard above is usually sufficient and is cheaper.

- [ ] **Step 4: Run the Cypress spec**

Run (with `npm start` already running on 8080):

```bash
npx cypress run --spec 'cypress/e2e/functional/tile_tests/highlight_references_spec.js'
```

Expected: PASS.

If the dev server is on a non-default port, per the project `CLAUDE.md`, invoke Cypress **without** `--env testEnv=local` and pass the port explicitly:

```bash
npx cypress run --spec 'cypress/e2e/functional/tile_tests/highlight_references_spec.js' \
  --config baseUrl=http://localhost:8083/
```

- [ ] **Step 5: Run the full unit-test suite**

Run: `npm test`
Expected: PASS. This is the last task, so nothing may be left broken.

- [ ] **Step 6: Lint and type-check**

Run: `npm run lint:build && npm run check:types`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/public/demo/docs/emg-highlight-demo.json \
        cypress/e2e/functional/tile_tests/highlight_references_spec.js
git commit -m "CLUE-603: add EMG highlight demo document and end-to-end test"
```

---

## Definition of done

- [ ] Hovering a text variable chip previews the Dataflow nodes bound to that variable; mouse-out reverts.
- [ ] Clicking pins the highlight; clicking again unpins.
- [ ] Hovering a second chip while one is pinned shows only the hovered chip's targets, and mouse-out restores the pinned set.
- [ ] No `.props()` were added anywhere — highlights are entirely volatile and appear in no snapshot.
- [ ] The resolved-target collection is not exposed on the public API.
- [ ] `npm test`, `npm run lint:build`, and `npm run check:types` all pass.
- [ ] The Cypress spec passes.
- [ ] Text editing in a tile containing a variable chip is unchanged (Task 6 Step 5), and any fallback taken is recorded in the commit message.
