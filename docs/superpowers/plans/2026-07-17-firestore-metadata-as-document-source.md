# Firestore Metadata as Document Source — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the client a single, shared, class-scoped store for Firestore `documents/<key>` metadata, then make `openDocument` source metadata from it — proven end-to-end by a new `contextId` field flowing from Firestore onto the live `DocumentModel`.

**Architecture:** Two independently shippable PRs. **Stage 1 (PR 1)** extracts a `DocumentMetadataStore` that owns the reactive `documents`-collection watch (moved from `SortedDocuments`) and exposes `getMetadata`/`fetchMetadata` point reads; `db.findFirestoreMetadata` is rerouted through it. **Stage 2 (PR 2)** makes `openDocument` require Firestore metadata (from a passed-in value or `store.fetchMetadata`, erroring if absent) and apply the `context_id` field to a new `DocumentModel.contextId` prop.

**Tech Stack:** TypeScript 4.9, MobX + MobX-State-Tree (Concord fork), Firebase 8 (Firestore + RTDB), Jest.

## Global Constraints

- **No CLUE-550 references in committed code, comments, or docs.** CLUE-550 is unfinished; its design/plan docs may never land. Do not name CLUE-550, its tasks, or link its docs anywhere in code or committed docs. Big-picture/precursor context belongs only in the PR description. (Light, self-explanatory references to CLUE-524 and CLUE-554 — both merged — are fine.)
- **Do not add or extend RTDB document metadata.** This effort sources *from* Firestore; RTDB metadata is being retired. Never write new fields to the RTDB `DBDocumentMetadata` envelope.
- **Do not change reactive-field sourcing.** `visibility`, `title`, `properties`, `groupId`, `content` keep their current RTDB initial value and RTDB listeners, untouched. Only the Firestore-only `context_id` field is added to the model here.
- **TDD, DRY, YAGNI, frequent commits.** Write the failing test first every time.
- **Single-test command:** `npm test -- <path/to/test.ts>` (Jest). Type-check with `npm run check:types`.
- **Two PRs:** all Stage 1 tasks land in PR 1; all Stage 2 tasks land in PR 2. Stage 2 depends on Stage 1.

**Reference (design):** [`../specs/2026-07-17-firestore-metadata-as-document-source-design.md`](../specs/2026-07-17-firestore-metadata-as-document-source-design.md). **Roadmap:** [`../../document-metadata/firestore-sourcing-roadmap.md`](../../document-metadata/firestore-sourcing-roadmap.md).

---

## File Structure

**Stage 1**
- Create: `src/models/stores/document-metadata-store.ts` — the class-scoped Firestore metadata store (watch + maps + `getMetadata`/`fetchMetadata`).
- Create: `src/models/stores/document-metadata-store.test.ts` — unit tests for the point-read API.
- Modify: `src/models/stores/sorted-documents.ts` — move the watch/maps/getters out; delegate to the store.
- Modify: `src/models/stores/sorted-documents.test.ts` — set the store's maps instead of `SortedDocuments`' own.
- Modify: `src/models/stores/stores.ts` — construct `documentMetadata` before `sortedDocuments`; add to `IStores`.
- Modify: `src/lib/db.ts` — `findFirestoreMetadata` delegates to `store.fetchMetadata`.

**Stage 2**
- Modify: `shared/shared.ts` — add `context_id` to `IDocumentMetadata`.
- Modify: `src/models/document/document-metadata-model.ts` — add `context_id` to `DocumentMetadataModel`.
- Modify: `src/models/document/document.ts` — add `contextId` prop to `DocumentModel`.
- Modify: `src/lib/db.ts` — `OpenDocumentOptions.firestoreMetadata`; `openDocument` requires + applies it; `openDocumentFromFirestoreMetadata` passes it through.
- Modify: `src/lib/db.test.ts` — tests for the new open behavior.

---

# STAGE 1 (PR 1) — Extract `DocumentMetadataStore`

Goal of this PR: a shared store for Firestore document metadata, with `SortedDocuments` and `db.findFirestoreMetadata` reading through it. No user-visible behavior change.

### Task 1.1: Create `DocumentMetadataStore` with point-read API + wire into stores

**Files:**
- Create: `src/models/stores/document-metadata-store.ts`
- Create: `src/models/stores/document-metadata-store.test.ts`
- Modify: `src/models/stores/stores.ts` (class `Stores` + interface `IStores`)

**Interfaces:**
- Produces: `class DocumentMetadataStore` with:
  - `metadataDocsFiltered: Instance<typeof MetadataDocMapModel>`
  - `metadataDocsWithoutUnit: Instance<typeof MetadataDocMapModel>`
  - `docsReceived: boolean`
  - `getMetadata(key: string): IDocumentMetadata | undefined` (sync, cache only)
  - `fetchMetadata(key: string): Promise<IDocumentMetadata | undefined>` (cache-hit-else-point-read, in-flight-coalesced)
- Consumes: a stores object exposing `db: DB`, `user: { classHash: string }`.

- [ ] **Step 1: Write the failing test**

Create `src/models/stores/document-metadata-store.test.ts`:

```typescript
import { MetadataDocMapModel } from "./sorted-documents";
import { DocumentMetadataStore, IDocumentMetadataStoreStores } from "./document-metadata-store";

// A minimal fake Firestore query chain: collection().withConverter().where().where().get()
function makeFakeDb(docsByKey: Record<string, any>) {
  const getSpy = jest.fn((key: string) => {
    const data = docsByKey[key];
    return Promise.resolve(
      data
        ? { empty: false, docs: [{ data: () => data }] }
        : { empty: true, docs: [] }
    );
  });
  let requestedKey = "";
  const query = {
    withConverter: () => query,
    where: (field: string, _op: string, value: any) => {
      if (field === "key") requestedKey = value;
      return query;
    },
    get: () => getSpy(requestedKey),
  };
  return {
    getSpy,
    db: { firestore: { collection: () => query } } as any,
  };
}

function makeStore(docsByKey: Record<string, any> = {}) {
  const { db, getSpy } = makeFakeDb(docsByKey);
  const stores = { db, user: { classHash: "class-1" } } as unknown as IDocumentMetadataStoreStores;
  return { store: new DocumentMetadataStore(stores), getSpy };
}

describe("DocumentMetadataStore", () => {
  it("getMetadata returns a doc already in the filtered cache without a fetch", () => {
    const { store, getSpy } = makeStore();
    store.metadataDocsFiltered = MetadataDocMapModel.create({
      "doc-1": { uid: "u1", type: "problem", key: "doc-1", tools: [] }
    });
    const result = store.getMetadata("doc-1");
    expect(result?.key).toBe("doc-1");
    expect(getSpy).not.toHaveBeenCalled();
  });

  it("getMetadata returns undefined for an uncached key", () => {
    const { store } = makeStore();
    expect(store.getMetadata("missing")).toBeUndefined();
  });

  it("fetchMetadata point-reads Firestore on a cache miss", async () => {
    const { store, getSpy } = makeStore({
      "doc-2": { uid: "u1", type: "problem", key: "doc-2", context_id: "class-1" }
    });
    const result = await store.fetchMetadata("doc-2");
    expect(result?.key).toBe("doc-2");
    expect(getSpy).toHaveBeenCalledTimes(1);
  });

  it("fetchMetadata resolves undefined when Firestore has no matching doc", async () => {
    const { store } = makeStore({});
    expect(await store.fetchMetadata("nope")).toBeUndefined();
  });

  it("fetchMetadata coalesces concurrent reads for the same key", async () => {
    const { store, getSpy } = makeStore({
      "doc-3": { uid: "u1", type: "problem", key: "doc-3", context_id: "class-1" }
    });
    const [a, b] = await Promise.all([store.fetchMetadata("doc-3"), store.fetchMetadata("doc-3")]);
    expect(a?.key).toBe("doc-3");
    expect(b?.key).toBe("doc-3");
    expect(getSpy).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/models/stores/document-metadata-store.test.ts`
Expected: FAIL — `Cannot find module './document-metadata-store'`.

- [ ] **Step 3: Create the store**

Create `src/models/stores/document-metadata-store.ts`:

```typescript
import { makeAutoObservable } from "mobx";
import { unprotect } from "@concord-consortium/mobx-state-tree";
import { IDocumentMetadata } from "../../../shared/shared";
import { typeConverter } from "../../lib/firestore-schema";
import type { DB } from "../../lib/db";
import { MetadataDocMapModel } from "./sorted-documents";

// The subset of the root stores this store needs. The root `Stores` object satisfies it.
export interface IDocumentMetadataStoreStores {
  db: DB;
  user: { classHash: string };
}

/**
 * Class-scoped cache of the Firestore `documents/<key>` metadata docs.
 *
 * It owns the reactive query over the class's metadata (populated by `SortedDocuments`
 * via `watchFirestoreMetaDataDocs`) and exposes point reads by document key. A read is a
 * cache hit when the reactive query has already loaded the doc; otherwise it falls back to
 * a single point query. Concurrent point reads for the same key are coalesced.
 */
export class DocumentMetadataStore {
  stores: IDocumentMetadataStoreStores;
  metadataDocsFiltered = MetadataDocMapModel.create();
  metadataDocsWithoutUnit = MetadataDocMapModel.create();
  docsReceived = false;

  private inFlightPointReads = new Map<string, Promise<IDocumentMetadata | undefined>>();

  constructor(stores: IDocumentMetadataStoreStores) {
    makeAutoObservable(this);
    this.stores = stores;
    // We only want MobX observability + MST serialization, not MST actions, on these maps.
    unprotect(this.metadataDocsFiltered);
    unprotect(this.metadataDocsWithoutUnit);
  }

  /** Synchronous read from the reactive cache only. Returns undefined if not loaded. */
  getMetadata(key: string): IDocumentMetadata | undefined {
    const model = this.metadataDocsFiltered.get(key) ?? this.metadataDocsWithoutUnit.get(key);
    if (!model) return undefined;
    return { ...model, properties: model.propertiesAsStringRecord } as unknown as IDocumentMetadata;
  }

  /** Cache-hit-else-point-read. Concurrent reads for the same key share one query. */
  fetchMetadata(key: string): Promise<IDocumentMetadata | undefined> {
    const cached = this.getMetadata(key);
    if (cached) return Promise.resolve(cached);

    const inFlight = this.inFlightPointReads.get(key);
    if (inFlight) return inFlight;

    const promise = this.pointReadMetadata(key)
      .finally(() => this.inFlightPointReads.delete(key));
    this.inFlightPointReads.set(key, promise);
    return promise;
  }

  private async pointReadMetadata(key: string): Promise<IDocumentMetadata | undefined> {
    const converter = typeConverter<IDocumentMetadata>();
    const query = this.stores.db.firestore.collection("documents")
      .withConverter(converter)
      .where("context_id", "==", this.stores.user.classHash)
      .where("key", "==", key);
    const snapshot = await query.get();
    if (snapshot.empty) return undefined;
    return snapshot.docs[0].data();
  }
}
```

> Note: `typeConverter` is the same helper `findFirestoreMetadata` and `watchFirestoreMetaDataDocs` use. Confirm its import path by grepping `import.*typeConverter` in `src/models/stores/sorted-documents.ts` and `src/lib/db.ts`; use whichever path they use. `DB` is imported as a type only to avoid a circular runtime import (the value arrives via `stores.db`). Task 1.2 will add `runInAction`/`applySnapshot`/`typecheck` imports when it moves in the methods that use them.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/models/stores/document-metadata-store.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Wire the store into the root stores**

In `src/models/stores/stores.ts`:

Add the import near the other store imports:

```typescript
import { DocumentMetadataStore } from "./document-metadata-store";
```

Add a property declaration to the `Stores` class, next to `sortedDocuments: SortedDocuments;`:

```typescript
  documentMetadata: DocumentMetadataStore;
```

In the constructor, construct it **before** `this.sortedDocuments = new SortedDocuments(this);` (SortedDocuments will read it in Task 1.2):

```typescript
    this.documentMetadata = new DocumentMetadataStore(this);
    this.sortedDocuments = new SortedDocuments(this);
```

In the `IStores` interface (same file), add:

```typescript
  documentMetadata: DocumentMetadataStore;
```

- [ ] **Step 6: Type-check**

Run: `npm run check:types`
Expected: no new errors. (`this` — the `Stores` object — satisfies `IDocumentMetadataStoreStores` because it has `db` and `user`.)

- [ ] **Step 7: Commit**

```bash
git add src/models/stores/document-metadata-store.ts src/models/stores/document-metadata-store.test.ts src/models/stores/stores.ts
git commit -m "Add DocumentMetadataStore with point-read metadata API"
```

---

### Task 1.2: Move the reactive metadata watch from `SortedDocuments` into the store

Move the class's Firestore-metadata ownership into `DocumentMetadataStore` and delegate from `SortedDocuments`, preserving behavior (including exemplar enrichment).

**Files:**
- Modify: `src/models/stores/sorted-documents.ts`
- Modify: `src/models/stores/document-metadata-store.ts`
- Modify: `src/models/stores/sorted-documents.test.ts`

**Interfaces:**
- Consumes: `DocumentMetadataStore` from Task 1.1.
- Produces: `DocumentMetadataStore.watchFirestoreMetaDataDocs(filter, unit, investigation, problem)`, `.firestoreMetadataDocs`, `.exemplarMetadataDocs`, `.getMSTSnapshotFromFBSnapshot(...)`. `SortedDocuments.firestoreMetadataDocs` and `.docsReceived` now delegate to the store.

- [ ] **Step 1: Update the failing test to set the store's map**

In `src/models/stores/sorted-documents.test.ts`, the setup currently does:

```typescript
sortedDocuments = new SortedDocuments(mockStores as ISortedDocumentsStores);
sortedDocuments.metadataDocsFiltered = MetadataDocMapModel.create(mockMetadataDocuments);
```

Change it so the mock stores include a `documentMetadata` store, and the metadata is set on that store:

```typescript
const documentMetadata = new DocumentMetadataStore(
  { db: {}, user: { classHash: "" } } as any
);
documentMetadata.metadataDocsFiltered = MetadataDocMapModel.create(mockMetadataDocuments);

const mockStores: DeepPartial<ISortedDocumentsStores> = {
  documents: { all: mockDocuments, exemplarDocuments: [] },
  groups: mockGroups,
  class: mockClass,
  documentMetadata,
};

sortedDocuments = new SortedDocuments(mockStores as ISortedDocumentsStores);
```

Add the import at the top of the test file:

```typescript
import { DocumentMetadataStore } from "./document-metadata-store";
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/models/stores/sorted-documents.test.ts`
Expected: FAIL — `ISortedDocumentsStores` has no `documentMetadata`, and/or `firestoreMetadataDocs` reads the old (now-empty) map.

- [ ] **Step 3: Move the watch + maps + exemplar logic into the store**

In `src/models/stores/document-metadata-store.ts`, add these members, moved **verbatim** from `sorted-documents.ts`, adjusting only the dependency access (`this.db` → `this.stores.db`, `this.user` → `this.stores.user`, `this.curriculumConfig` → `this.stores.curriculumConfig`, `this.stores.documents` stays):

- `getMSTSnapshotFromFBSnapshot` — copy the body from `sorted-documents.ts:114-154` verbatim.
- `watchFirestoreMetaDataDocs` — copy from `sorted-documents.ts:156-204` verbatim.
- `exemplarMetadataDocs` getter — copy from `sorted-documents.ts:206-247` verbatim.
- `firestoreMetadataDocs` getter — copy from `sorted-documents.ts:255-277` verbatim.

Extend `IDocumentMetadataStoreStores` to include the deps those methods use:

```typescript
export interface IDocumentMetadataStoreStores {
  db: DB;
  user: { classHash: string };
  curriculumConfig: ICurriculumConfig;
  documents: { exemplarDocuments: any[] };
}
```

> Match the exact types `sorted-documents.ts` uses for `curriculumConfig` (`ICurriculumConfig`) and `documents.exemplarDocuments`. Import `runInAction`, `applySnapshot`, `typecheck`, `union`, `when`, `IArrowAnnotation`, etc. — copy the imports these moved methods rely on from `sorted-documents.ts`. Leave `docsReceived` owned by this store (it is set inside `watchFirestoreMetaDataDocs`).

- [ ] **Step 4: Delegate from `SortedDocuments`**

In `src/models/stores/sorted-documents.ts`:

1. Delete the moved members: `metadataDocsFiltered` and `metadataDocsWithoutUnit` fields, `docsReceived` field, `getMSTSnapshotFromFBSnapshot`, `watchFirestoreMetaDataDocs`, `exemplarMetadataDocs`, and the body of `firestoreMetadataDocs`.
2. Add delegating getters:

```typescript
  get docsReceived() {
    return this.stores.documentMetadata.docsReceived;
  }

  get firestoreMetadataDocs() {
    return this.stores.documentMetadata.firestoreMetadataDocs;
  }

  watchFirestoreMetaDataDocs(filter: string, unit: string, investigation: number, problem: number) {
    return this.stores.documentMetadata.watchFirestoreMetaDataDocs(filter, unit, investigation, problem);
  }
```

3. `fetchFullDocument` (`sorted-documents.ts:281-295`) references `this.docsReceived` and `this.firestoreMetadataDocs` — both now resolve via the getters above, so no change is needed to its body. Leave it in `SortedDocuments`.
4. Find the external caller of `sortedDocuments.watchFirestoreMetaDataDocs(...)` (grep `watchFirestoreMetaDataDocs`) — it keeps calling it on `sortedDocuments`; the delegating method forwards to the store. No caller change required.
5. `ISortedDocumentsStores` (defined in this file) must include `documentMetadata: DocumentMetadataStore`. Add it and import the type.

> `MetadataDocMapModel` stays exported from `sorted-documents.ts` (the store imports it there). Keep that export.

- [ ] **Step 5: Run the moved test to verify it passes**

Run: `npm test -- src/models/stores/sorted-documents.test.ts`
Expected: PASS (all existing sorted-documents tests green — behavior preserved).

- [ ] **Step 6: Run the store test too**

Run: `npm test -- src/models/stores/document-metadata-store.test.ts`
Expected: PASS.

- [ ] **Step 7: Type-check**

Run: `npm run check:types`
Expected: no new errors.

- [ ] **Step 8: Commit**

```bash
git add src/models/stores/sorted-documents.ts src/models/stores/document-metadata-store.ts src/models/stores/sorted-documents.test.ts
git commit -m "Move Firestore metadata watch into DocumentMetadataStore; SortedDocuments delegates"
```

---

### Task 1.3: Route `db.findFirestoreMetadata` through the store

**Files:**
- Modify: `src/lib/db.ts` (`findFirestoreMetadata`, lines 694-711)
- Modify: `src/lib/db.test.ts`

**Interfaces:**
- Consumes: `stores.documentMetadata.fetchMetadata(key)`.
- Produces: `findFirestoreMetadata` behavior unchanged for its callers (returns `IDocumentMetadata | undefined`), now backed by the store (cache-hit-else-point-read).

- [ ] **Step 1: Write the failing test**

In `src/lib/db.test.ts`, add:

```typescript
it("findFirestoreMetadata delegates to the document metadata store", async () => {
  await db.connect({ appMode: "test", stores, dontStartListeners: true });
  const fake = { uid: "u1", type: "problem", key: "doc-x", context_id: "class-1" } as any;
  const spy = jest.spyOn(stores.documentMetadata, "fetchMetadata").mockResolvedValue(fake);
  const result = await db.findFirestoreMetadata("doc-x");
  expect(spy).toHaveBeenCalledWith("doc-x");
  expect(result).toBe(fake);
  spy.mockRestore();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/lib/db.test.ts -t "findFirestoreMetadata delegates"`
Expected: FAIL — `findFirestoreMetadata` still queries Firestore directly (spy not called).

- [ ] **Step 3: Reroute `findFirestoreMetadata`**

In `src/lib/db.ts`, replace the body of `findFirestoreMetadata` (lines 694-711) with a delegation:

```typescript
  public async findFirestoreMetadata(documentKey: string) {
    return this.stores.documentMetadata.fetchMetadata(documentKey);
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/lib/db.test.ts -t "findFirestoreMetadata delegates"`
Expected: PASS.

- [ ] **Step 5: Run the full db test file (guard against regressions in canonical/pointer paths)**

Run: `npm test -- src/lib/db.test.ts`
Expected: PASS. If a canonical/pointer test that mocked `mockFirestore` for `findFirestoreMetadata`'s old direct query now fails, update it to mock `stores.documentMetadata.fetchMetadata` (as in Step 1) — the query moved into the store.

- [ ] **Step 6: Type-check and commit**

```bash
npm run check:types
git add src/lib/db.ts src/lib/db.test.ts
git commit -m "Route findFirestoreMetadata through DocumentMetadataStore"
```

---

### Stage 1 wrap-up

- [ ] Run the three touched test files together:
  `npm test -- src/models/stores/document-metadata-store.test.ts src/models/stores/sorted-documents.test.ts src/lib/db.test.ts`
  Expected: all PASS.
- [ ] `npm run lint` — fix any issues.
- [ ] Open PR 1. **PR description** (not code) may say this is a precursor toward Firestore-sourced document construction; do not reference unfinished tickets in code/comments.

---

# STAGE 2 (PR 2) — `openDocument` sources `context_id` from Firestore

Goal of this PR: `openDocument` requires the Firestore metadata doc (passed in, or fetched via the store; error if missing) and applies its `context_id` to a new `DocumentModel.contextId`.

### Task 2.1: Add `context_id` to the metadata types and `DocumentModel`

**Files:**
- Modify: `shared/shared.ts` (`IDocumentMetadata`, lines 145-155)
- Modify: `src/models/document/document-metadata-model.ts` (`DocumentMetadataModel`, lines 10-34)
- Modify: `src/models/document/document.ts` (`DocumentModel` props, lines 61-81)
- Test: `src/models/document/document-metadata-model.test.ts` (create if absent) and an assertion in an existing document test.

**Interfaces:**
- Produces: `IDocumentMetadata.context_id?: string | null`; `DocumentMetadataModel` gains `context_id`; `DocumentModel.contextId?: string`.

- [ ] **Step 1: Write the failing test**

Create/append `src/models/document/document-metadata-model.test.ts`:

```typescript
import { DocumentMetadataModel } from "./document-metadata-model";

describe("DocumentMetadataModel context_id", () => {
  it("stores a context_id from Firestore data", () => {
    const metadata = DocumentMetadataModel.create({
      uid: "u1", type: "problem", key: "doc-1", context_id: "class-1", tools: []
    });
    expect(metadata.context_id).toBe("class-1");
  });

  it("allows a missing context_id", () => {
    const metadata = DocumentMetadataModel.create({
      uid: "u1", type: "problem", key: "doc-2", tools: []
    });
    expect(metadata.context_id).toBeNull();
  });
});
```

Also append to `src/models/document/document.test.ts` (an existing test file — confirm path) a case:

```typescript
it("carries a contextId when provided in the snapshot", () => {
  const doc = createDocumentModel({ uid: "u1", type: "problem", key: "d1", contextId: "class-1" });
  expect(doc.contextId).toBe("class-1");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/models/document/document-metadata-model.test.ts`
Expected: FAIL — `context_id` unknown property / typecheck error.

- [ ] **Step 3: Add `context_id` to `IDocumentMetadata`**

In `shared/shared.ts`, inside `interface IDocumentMetadata` (after `createdAt?: number;`), add:

```typescript
  context_id?: string|null;
```

- [ ] **Step 4: Add `context_id` to `DocumentMetadataModel`**

In `src/models/document/document-metadata-model.ts`, inside the `types.model` props (after `createdAt: types.maybe(types.number),`), add:

```typescript
  context_id: types.maybeNull(types.string),
```

- [ ] **Step 5: Add `contextId` to `DocumentModel`**

In `src/models/document/document.ts`, inside the `.props({...})` block (after `createdAt: 0,`), add:

```typescript
    contextId: types.maybe(types.string), // the document's authoritative owning-class (Firestore context_id)
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test -- src/models/document/document-metadata-model.test.ts src/models/document/document.test.ts`
Expected: PASS.

- [ ] **Step 7: Type-check and commit**

```bash
npm run check:types
git add shared/shared.ts src/models/document/document-metadata-model.ts src/models/document/document.ts src/models/document/document-metadata-model.test.ts src/models/document/document.test.ts
git commit -m "Add context_id to metadata types and DocumentModel.contextId"
```

---

### Task 2.2: `openDocument` requires Firestore metadata and applies `contextId`

**Files:**
- Modify: `src/lib/db.ts` (`OpenDocumentOptions` 87-102; `openDocument` 928-1022; `openDocumentFromFirestoreMetadata` 1024-1054)
- Modify: `src/lib/db.test.ts`

**Interfaces:**
- Consumes: `stores.documentMetadata.fetchMetadata(key)` (Stage 1); `IDocumentMetadata.context_id` (Task 2.1).
- Produces: `OpenDocumentOptions.firestoreMetadata?: IDocumentMetadata`; opened models carry `contextId`; `openDocument` rejects when no Firestore metadata is available.

- [ ] **Step 1: Write the failing tests**

In `src/lib/db.test.ts`, add a describe block. This stubs the RTDB refs (`db.firebase.ref`) and the store fetch:

```typescript
describe("openDocument Firestore metadata sourcing", () => {
  function stubRtdb(metadataVal: any, documentVal: any) {
    // openDocument calls this.firebase.getUserDocumentPath / getUserDocumentMetadataPath then this.firebase.ref(path).once("value")
    jest.spyOn(db.firebase, "getUserDocumentPath").mockReturnValue("doc/path");
    jest.spyOn(db.firebase, "getUserDocumentMetadataPath").mockReturnValue("meta/path");
    jest.spyOn(db.firebase, "ref").mockImplementation((path: string) => ({
      once: () => Promise.resolve({ val: () => (path === "meta/path" ? metadataVal : documentVal) })
    }) as any);
  }

  beforeEach(async () => {
    await db.connect({ appMode: "test", stores, dontStartListeners: true });
  });

  it("applies context_id from passed-in firestoreMetadata to the model", async () => {
    stubRtdb({ createdAt: 1, properties: {} }, { changeCount: 0 });
    const firestoreMetadata = { uid: "u1", type: "problem", key: "d1", context_id: "class-1" } as any;
    const doc = await db.openDocument({
      documentKey: "d1", type: "problem", userId: "u1", firestoreMetadata
    } as any);
    expect(doc.contextId).toBe("class-1");
  });

  it("fetches Firestore metadata from the store when none is passed", async () => {
    stubRtdb({ createdAt: 1, properties: {} }, { changeCount: 0 });
    const spy = jest.spyOn(stores.documentMetadata, "fetchMetadata")
      .mockResolvedValue({ uid: "u1", type: "problem", key: "d2", context_id: "class-9" } as any);
    const doc = await db.openDocument({ documentKey: "d2", type: "problem", userId: "u1" } as any);
    expect(spy).toHaveBeenCalledWith("d2");
    expect(doc.contextId).toBe("class-9");
    spy.mockRestore();
  });

  it("rejects when no Firestore metadata is available", async () => {
    stubRtdb({ createdAt: 1, properties: {} }, { changeCount: 0 });
    jest.spyOn(stores.documentMetadata, "fetchMetadata").mockResolvedValue(undefined);
    await expect(
      db.openDocument({ documentKey: "d3", type: "problem", userId: "u1" } as any)
    ).rejects.toThrow(/Firestore metadata/);
  });
});
```

> If `db.openDocument`'s `documentFetchPromiseMap` caches by key across tests, use a distinct `documentKey` per test (as above) so each test exercises a fresh fetch.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/lib/db.test.ts -t "openDocument Firestore metadata sourcing"`
Expected: FAIL — `firestoreMetadata` not on options / `contextId` undefined / no rejection.

- [ ] **Step 3: Add `firestoreMetadata` to `OpenDocumentOptions`**

In `src/lib/db.ts`, add to `interface OpenDocumentOptions` (after `unit?: string;`):

```typescript
  firestoreMetadata?: IDocumentMetadata;
```

- [ ] **Step 4: Resolve + require Firestore metadata in `openDocument`, and apply `contextId`**

In `openDocument`, change the RTDB read to also resolve the Firestore metadata, and require it. Replace:

```typescript
    return Promise.all([documentRef.once("value"), metadataRef.once("value")])
      .then(([documentSnapshot, metadataSnapshot]) => {
        const document: DBDocument|null = documentSnapshot.val();
        const metadata: DBDocumentMetadata|null = metadataSnapshot.val();
        if (!metadata) {
```

with:

```typescript
    const firestoreMetadataPromise = options.firestoreMetadata
      ? Promise.resolve<IDocumentMetadata | undefined>(options.firestoreMetadata)
      : this.stores.documentMetadata.fetchMetadata(documentKey);

    return Promise.all([documentRef.once("value"), metadataRef.once("value"), firestoreMetadataPromise])
      .then(([documentSnapshot, metadataSnapshot, firestoreMetadata]) => {
        const document: DBDocument|null = documentSnapshot.val();
        const metadata: DBDocumentMetadata|null = metadataSnapshot.val();
        if (!firestoreMetadata) {
          throw new Error(
            `Error retrieving Firestore metadata for document '${documentKey}' of type '${type}' for user '${userId}'`
          );
        }
        if (!metadata) {
```

Then in **both** `createDocumentModel({...})` calls inside this method (the empty-content fallback at ~960 and the normal path at ~967), add the `contextId` field. In the empty-content call add:

```typescript
                                key: documentKey, createdAt: metadata.createdAt, content: {}, changeCount: 0,
                                contextId: firestoreMetadata.context_id ?? undefined });
```

and in the normal call add, alongside the other fields:

```typescript
            contextId: firestoreMetadata.context_id ?? undefined,
```

- [ ] **Step 5: Pass `firestoreMetadata` through from `openDocumentFromFirestoreMetadata`**

In `openDocumentFromFirestoreMetadata` (1024-1054), the returned `this.openDocument({...})` currently spreads `...firestoreMetadata` (which openDocument ignores). Add an explicit `firestoreMetadata` option so openDocument uses it without a second fetch. Add to the object passed to `this.openDocument`:

```typescript
    firestoreMetadata,
```

(Place it alongside `documentKey: firestoreMetadata.key,`.)

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test -- src/lib/db.test.ts -t "openDocument Firestore metadata sourcing"`
Expected: PASS (3 tests).

- [ ] **Step 7: Run the full db test file**

Run: `npm test -- src/lib/db.test.ts`
Expected: PASS. Canonical/pointer tests that reach `openDocumentFromFirestoreMetadata` now pass `firestoreMetadata` through — if any such test asserted the exact `openDocument` options object, update it to include `firestoreMetadata`.

- [ ] **Step 8: Type-check and commit**

```bash
npm run check:types
git add src/lib/db.ts src/lib/db.test.ts
git commit -m "openDocument sources and requires Firestore metadata; applies contextId"
```

---

### Task 2.3: Confirm the listener builder paths populate `contextId`

The four (five) builders call `openDocument` without `firestoreMetadata`, so they now fetch from the store. Add one end-to-end guard so a regression here is caught.

**Files:**
- Modify: `src/lib/db.test.ts`

**Interfaces:**
- Consumes: `createDocumentModelFromOtherDocument` (db.ts:1153) as a representative builder.

- [ ] **Step 1: Write the failing/guarding test**

In `src/lib/db.test.ts`, add:

```typescript
it("a listener builder populates contextId via the store fetch", async () => {
  await db.connect({ appMode: "test", stores, dontStartListeners: true });
  jest.spyOn(db.firebase, "getUserDocumentPath").mockReturnValue("doc/path");
  jest.spyOn(db.firebase, "getUserDocumentMetadataPath").mockReturnValue("meta/path");
  jest.spyOn(db.firebase, "ref").mockImplementation((path: string) => ({
    once: () => Promise.resolve({ val: () => (path === "meta/path" ? { createdAt: 1, properties: {} } : { changeCount: 0 }) })
  }) as any);
  jest.spyOn(stores.documentMetadata, "fetchMetadata")
    .mockResolvedValue({ uid: "u2", type: "personal", key: "pd1", context_id: "class-77" } as any);

  const dbDocument = { title: "T", properties: {}, self: { uid: "u2", documentKey: "pd1" } } as any;
  const doc = await db.createDocumentModelFromOtherDocument(dbDocument, "personal" as any);
  expect(doc.contextId).toBe("class-77");
});
```

- [ ] **Step 2: Run the test**

Run: `npm test -- src/lib/db.test.ts -t "listener builder populates contextId"`
Expected: PASS (no production change needed — this verifies Task 2.2 wired the builder path). If it FAILS because `groups.groupForUser` throws on the test stores, stub it: `jest.spyOn(stores.groups, "groupForUser").mockReturnValue(undefined as any);`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/db.test.ts
git commit -m "Test: listener builder path populates contextId from Firestore metadata"
```

---

### Stage 2 wrap-up

- [ ] Run the touched test files:
  `npm test -- src/lib/db.test.ts src/models/document/document-metadata-model.test.ts src/models/document/document.test.ts`
  Expected: all PASS.
- [ ] `npm run lint` and `npm run check:types` — fix any issues.
- [ ] Manual/gut check: confirm no new field was written to RTDB metadata and no reactive field's sourcing changed (diff `openDocument` — only `contextId` and the Firestore fetch were added).
- [ ] Open PR 2 (stacked on PR 1). PR description may explain the precursor relationship; code/comments must not reference unfinished tickets.

---

## Self-Review notes (author)

- **Spec coverage:** Stage 1 delivers the shared `DocumentMetadataStore` + `findFirestoreMetadata` reroute (design §4). Stage 2 delivers the `openDocument` choke point with error-if-missing and one Firestore-only field (`context_id`) flowing to the model (design §5, and the "mechanism-only, no axis prop" decision). Reactive fields untouched (design §3). Roadmap/`context_id`-provenance alignment noted in §6.
- **Deferred by design (not in this plan):** reactive-field cut-over, remote/network docs, the store owning its own whole-class watcher (design §10) — left as future direction per the roadmap.
- **Type consistency:** `getMetadata`/`fetchMetadata` return `IDocumentMetadata | undefined` throughout; `context_id` (snake, Firestore/type/MST model) maps to `contextId` (camel, `DocumentModel`) only at the `openDocument` apply site.
- **Verify-before-implement anchors:** confirm the `typeConverter` import path, the `watchFirestoreMetaDataDocs` external caller, and the exact `document.test.ts` path before writing those steps (called out inline).
