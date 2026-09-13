# CLUE-377 Group Documents Default Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-create each group's shared document whenever `groupDocumentsEnabled` (making it visible in Sort Work before any edits), and let `defaultDocumentType: "group"` start students in their group's document (re-pointed on group switch; teachers keep the problem document) — while hardening the canonical-pointer race paths.

**Architecture:** Widen `defaultDocumentType` + derive `groupDocumentsEnabled`/`startsInGroupDocument` in the config layer; add a resolver-only `db.resolveGroupDocument()` triggered by a MobX reaction on `user.currentGroupId`; branch `guaranteeInitialDocuments` in the workspace; fix the legacy-fallback race divergence and de-duplicate concurrent resolves client-side. Spec: `docs/superpowers/specs/2026-09-12-clue-377-group-documents-default-design.md`.

**Tech Stack:** TypeScript, MobX / MobX-State-Tree, React (class component for the workspace), Jest.

---

## Task 1: Config layer — widened type + derived getters

**Files:**
- Modify: `src/models/stores/unit-configuration.ts:60`
- Modify: `src/models/stores/configuration-manager.ts` (~line 86-92 region and ~242-244)
- Modify: `src/models/stores/app-config-model.ts` (~line 112)
- Test: `src/models/stores/configuration-manager.test.ts`

- [ ] **Step 1: Write the failing tests**

In `configuration-manager.test.ts`, inside the top-level `describe("ConfigurationManager", …)` (reuse the file's existing `defaults` fixture, as the `showShare` tests do):

```ts
  describe("groupDocumentsEnabled / startsInGroupDocument", () => {
    it("is enabled explicitly, without changing the start document", () => {
      const config = new ConfigurationManager({ ...defaults, groupDocumentsEnabled: true }, []);
      expect(config.groupDocumentsEnabled).toBe(true);
      expect(config.startsInGroupDocument).toBe(false);
    });

    it("is implied when the unit starts students in the group document", () => {
      const config = new ConfigurationManager({ ...defaults, defaultDocumentType: "group" }, []);
      expect(config.groupDocumentsEnabled).toBe(true);
      expect(config.startsInGroupDocument).toBe(true);
    });

    it("explicit false wins over the implication and falls back with a warning", () => {
      const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
      const config = new ConfigurationManager(
        { ...defaults, defaultDocumentType: "group", groupDocumentsEnabled: false }, []);
      expect(config.groupDocumentsEnabled).toBe(false);
      expect(config.startsInGroupDocument).toBe(false);
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it("autoAssignStudentsToIndividualGroups trumps both group settings", () => {
      const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
      const config = new ConfigurationManager(
        { ...defaults, defaultDocumentType: "group", groupDocumentsEnabled: true,
          autoAssignStudentsToIndividualGroups: true }, []);
      expect(config.groupDocumentsEnabled).toBe(false);
      expect(config.startsInGroupDocument).toBe(false);
      warn.mockRestore();
    });

    it("never affects classWideDocuments", () => {
      const config = new ConfigurationManager(
        { ...defaults, autoAssignStudentsToIndividualGroups: true,
          classWideDocuments: [{ kind: "dqb", title: "DQB" }] }, []);
      expect(config.classWideDocuments).toEqual([{ kind: "dqb", title: "DQB" }]);
    });
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/models/stores/configuration-manager.test.ts -t "groupDocumentsEnabled"`
Expected: FAIL (`"group"` not assignable; `startsInGroupDocument` undefined).

- [ ] **Step 3: Implement**

`unit-configuration.ts:60`:
```ts
  defaultDocumentType: "problem" | "personal" | "group";
```

`configuration-manager.ts` — replace the `groupDocumentsEnabled` getter (~242-244) and add `startsInGroupDocument` next to it, plus a private field near the top of the class:
```ts
  private warnedGroupStartFallback = false;
```
```ts
  // Group documents exist for this unit when explicitly enabled, or implicitly when the unit starts
  // students in the group document. An explicit false wins over the implication, and
  // autoAssignStudentsToIndividualGroups (no real groups) trumps both. classWideDocuments is unrelated.
  get groupDocumentsEnabled(): boolean {
    if (this.autoAssignStudentsToIndividualGroups) return false;
    const explicit = this.getProp<UC["groupDocumentsEnabled"]>("groupDocumentsEnabled");
    return explicit !== undefined ? explicit : this.defaultDocumentType === "group";
  }

  // True when students should start in their group's shared document. Warns once when the unit asks for
  // a group start it cannot have (explicitly disabled group docs, or no real groups) and falls back.
  get startsInGroupDocument(): boolean {
    const wantsGroup = this.defaultDocumentType === "group";
    if (wantsGroup && !this.groupDocumentsEnabled && !this.warnedGroupStartFallback) {
      this.warnedGroupStartFallback = true;
      console.warn("defaultDocumentType is 'group' but group documents are not enabled;",
        "students will start in the problem document instead");
    }
    return wantsGroup && this.groupDocumentsEnabled;
  }
```

`app-config-model.ts` — next to the existing `groupDocumentsEnabled` getter (~112):
```ts
    get startsInGroupDocument() { return self.configMgr.startsInGroupDocument; },
```

- [ ] **Step 4: Run to verify pass**

Run: `npx jest src/models/stores/configuration-manager.test.ts src/models/stores/app-config-model.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck** — `npm run check:types`. If any consumer of `defaultDocumentType` fails on the widened union, fix ONLY by handling `"group"` explicitly (Task 4 handles `getDefaultDocumentContentSpec`; if tsc flags it now, apply Task 4 Step 3's `getDefaultDocumentContentSpec` change in this task and note it in the commit).

- [ ] **Step 6: Commit**

```bash
git add src/models/stores/unit-configuration.ts src/models/stores/configuration-manager.ts \
  src/models/stores/app-config-model.ts src/models/stores/configuration-manager.test.ts \
  src/components/document/document-workspace.tsx
git commit -m "CLUE-377: widen defaultDocumentType to include group; derive groupDocumentsEnabled"
```
(Include `document-workspace.tsx` only if Step 5 required the spec change early.)

---

## Task 2: `resolveGroupDocument` + race hardening (legacy divergence fix, client-side dedup)

**Files:**
- Modify: `src/lib/db.ts`
- Test: `src/lib/db.test.ts` (mirror the existing `getOrCreateGroupDocument` / `resolveClassWideDocument` describes at lines 251-335 and 529+ — same `mockFirestore` / `runTransaction` stub patterns)

- [ ] **Step 1: Write the failing tests**

Add to `db.test.ts` (inside `describe("db", …)`):

```ts
  describe("resolveGroupDocument", () => {
    beforeEach(() => {
      stores.user = UserModel.create({ id: "1", portal: "example.com", offeringId: "off-1", currentGroupId: "3" });
      (db as any).openDocumentFromFirestoreMetadata = jest.fn();
      (db as any).findFirestoreMetadata = jest.fn();
    });

    it("fast path: returns the pointer's documentKey without opening anything", async () => {
      mockFirestore.mockImplementation(() => ({
        doc: () => ({ get: () => Promise.resolve({ exists: true, data: () => ({ documentKey: "existing" }) }) })
      }));
      await db.connect({ appMode: "test", stores, dontStartListeners: true });
      expect(await db.resolveGroupDocument()).toBe("existing");
      expect((db as any).openDocumentFromFirestoreMetadata).not.toHaveBeenCalled();
      expect((db as any).findFirestoreMetadata).not.toHaveBeenCalled();
    });

    it("throws when the user is not in a group with an offering", async () => {
      stores.user = UserModel.create({ id: "1", portal: "example.com" });
      await db.connect({ appMode: "test", stores, dontStartListeners: true });
      await expect(db.resolveGroupDocument()).rejects.toThrow();
    });

    it("two concurrent resolves of the same slot share one resolution (no create churn)", async () => {
      const createSpy = jest.fn(async () => ({ firestoreMetadata: { key: "minted-key" } }));
      (db as any).createDocument = createSpy;
      mockFirestore.mockImplementation(() => ({
        doc: () => ({ get: () => Promise.resolve({ exists: false }) }),
        collection: () => ({ withConverter: () => ({ where: () => ({ where: () => ({ where: () => ({
          get: () => Promise.resolve({ empty: true, docs: [] }) }) }) }) }) })
      }));
      (db as any).firestore.runTransaction = jest.fn(async (fn: any) =>
        fn({ get: async () => ({ exists: false }), set: () => {}, update: () => {} }));
      await db.connect({ appMode: "test", stores, dontStartListeners: true });
      const [k1, k2] = await Promise.all([db.resolveGroupDocument(), db.resolveGroupDocument()]);
      expect(k1).toBe("minted-key");
      expect(k2).toBe("minted-key");
      expect(createSpy).toHaveBeenCalledTimes(1);
    });

    it("legacy candidate loses to a concurrently-claimed pointer: converges on the pointer's document", async () => {
      // The old behavior returned the local legacy candidate unconditionally — two clients whose
      // legacy queries surfaced different pre-pointer duplicates would keep different documents.
      const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
      mockFirestore.mockImplementation(() => ({
        doc: () => ({ get: () => Promise.resolve({ exists: false }) }),
        collection: () => ({ withConverter: () => ({ where: () => ({ where: () => ({ where: () => ({
          get: () => Promise.resolve({ empty: false, docs: [{ data: () => ({ key: "legacy-A" }) }] }) }) }) }) }) })
      }));
      (db as any).firestore.runTransaction = jest.fn(async (fn: any) =>
        fn({
          get: async () => ({ exists: true, data: () => ({ documentKey: "winner-B" }) }),
          set: () => {}, update: () => {}
        }));
      await db.connect({ appMode: "test", stores, dontStartListeners: true });
      expect(await db.resolveGroupDocument()).toBe("winner-B");
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });
  });
```

Also add one dedup-scoping test inside the new describe (the memo key is the pointer path, so different groups must resolve independently):
```ts
    it("dedup does not leak across slots: a different group fetches its own pointer", async () => {
      const fetchedPaths: string[] = [];
      mockFirestore.mockImplementation(() => ({
        doc: (path: string) => {
          fetchedPaths.push(path);
          return { get: () => Promise.resolve({ exists: true, data: () => ({ documentKey: `doc-for-${path}` }) }) };
        }
      }));
      await db.connect({ appMode: "test", stores, dontStartListeners: true });
      const k3 = await db.resolveGroupDocument();
      stores.user.setCurrentGroupId("4");
      const k4 = await db.resolveGroupDocument();
      expect(k4).not.toBe(k3);
      expect(new Set(fetchedPaths).size).toBe(2); // one pointer path per group slot
    });
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/lib/db.test.ts -t "resolveGroupDocument"`
Expected: FAIL (`resolveGroupDocument` is not a function).

- [ ] **Step 3: Implement in `db.ts`**

(a) Public resolver, next to `getOrCreateGroupDocument` (~line 847):
```ts
  // Resolver-only twin of getOrCreateGroupDocument, mirroring resolveClassWideDocument: converge the
  // group onto its one default document — creating it if absent — WITHOUT opening it. Used by the
  // eager autocreate so group documents exist (and appear in Sort Work) before anyone opens one.
  public async resolveGroupDocument() {
    const { user } = this.stores;
    const { groupId, offeringId } = this.requireGroupContext();
    const { documentKey } = await this.resolveCanonicalDocument({
      container: { classHash: user.classHash, offeringId },
      canonicalLabel: kDefaultCanonicalDocumentLabel,
      type: AxesDocument,
      kind: GroupDocument,
      findLegacy: () => this.findLegacyGroupDocument(groupId)
    });
    return documentKey;
  }
```

(b) Client-side dedup. Add a field near `documentFetchPromiseMap` (~line 143):
```ts
  private canonicalResolvePromiseMap = new Map<string, Promise<IResolvedCanonicalDocument>>();
```
Split `resolveCanonicalDocument` (~line 925): compute `pointerPath`/`pointerRef` first, then memoize:
```ts
  private resolveCanonicalDocument(opts: IGetOrCreateCanonicalDocumentOpts): Promise<IResolvedCanonicalDocument> {
    // The slot's owner is the same uid createDocument stamps on the document, from the same registry
    // call. firestore.rules builds the pointer path from the document's stored `uid`, so a claim whose
    // path named a different owner would be rejected rather than silently mis-slotted.
    const pointerPath = getCanonicalPointerPath({
      ...opts.container,
      owner: getDocumentOwner(opts.kind, this.documentOwnerContext),
      label: opts.canonicalLabel
    });
    // Concurrent resolves of one slot within this client (the autocreate reaction, the start-in-group-doc
    // workspace branch, and the File ▸ Group Doc menu can all fire around login) share one resolution
    // instead of racing each other into create-then-delete churn. A rejected resolve is evicted so a
    // later call can retry; a resolved one is kept — the pointer is immutable once claimed.
    const inFlight = this.canonicalResolvePromiseMap.get(pointerPath);
    if (inFlight) return inFlight;
    const promise = this.resolveCanonicalDocumentUncached(opts, pointerPath);
    this.canonicalResolvePromiseMap.set(pointerPath, promise);
    promise.catch(() => this.canonicalResolvePromiseMap.delete(pointerPath));
    return promise;
  }

  private async resolveCanonicalDocumentUncached(
    opts: IGetOrCreateCanonicalDocumentOpts, pointerPath: string
  ): Promise<IResolvedCanonicalDocument> {
    const { type, kind, canonicalLabel, findLegacy } = opts;
    const pointerRef = this.firestore.doc(pointerPath);
    // … existing body from the pointer fast path down, unchanged except (c) below …
  }
```

(c) Fix the legacy-path divergence (replace the current lines ~945-961). The create path already returns the transaction's winning key; make the legacy path do the same instead of unconditionally returning its own candidate:
```ts
    // 2. Legacy fallback: pre-pointer group docs are found by query; backfill a pointer. Converge on
    // whatever the pointer ends up naming: if a concurrent claim (create path, or another client's
    // legacy backfill of a DIFFERENT pre-pointer duplicate) won between our pointer read and this
    // transaction, adopt ITS document — returning our own candidate here is how two clients in one
    // group could keep working on two documents (docs/group-docs/group-docs-current-state.md).
    if (findLegacy) {
      const legacy = await findLegacy();
      if (legacy) {
        const wonKey = await this.firestore.runTransaction(async (txn) => {
          const s = await txn.get(pointerRef);
          if (s.exists) return (s.data() as ICanonicalPointer).documentKey;
          txn.set(pointerRef, {
            documentKey: legacy.key, createdAt: this.firestore.timestamp(),
            createdBy: this.stores.user.id   // the real user backfilling the pointer, for provenance
          });
          txn.update(this.firestore.doc(getSimpleDocumentPath(legacy.key)), { canonical: canonicalLabel });
          return legacy.key;
        }).catch(() => legacy.key); // txn failure: fall back to the legacy doc rather than blocking
        if (wonKey !== legacy.key) {
          console.warn("Canonical slot already names a different document than the legacy candidate;",
            "converging on the slot's document", { slot: pointerPath, pointer: wonKey, legacy: legacy.key });
          return { documentKey: wonKey };
        }
        return { documentKey: legacy.key, firestoreMetadata: legacy };
      }
    }
```
(The losing legacy duplicate is left in place — it may hold student work; convergence, not deletion.)

(d) Clear the memo on disconnect (`disconnect()`, ~line 278):
```ts
    this.canonicalResolvePromiseMap.clear();
```

- [ ] **Step 4: Run to verify pass**

Run: `npx jest src/lib/db.test.ts src/lib/scoped-document-pointers.test.ts`
Expected: all green, including every pre-existing `getOrCreateGroupDocument` / `resolveClassWideDocument` test.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db.ts src/lib/db.test.ts
git commit -m "CLUE-377: add resolveGroupDocument; fix legacy-pointer race divergence; dedup client resolves"
```

---

## Task 3: Eager autocreate reaction

**Files:**
- Modify: `src/lib/db.ts` (connect block ~line 230, `disconnect()`)
- Test: `src/lib/db.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
  describe("autoResolveGroupDocuments", () => {
    beforeEach(() => {
      stores.user = UserModel.create({ id: "1", portal: "example.com", type: "student", offeringId: "off-1" });
      stores.appConfig.setConfigs([{ groupDocumentsEnabled: true }]);
    });

    it("resolves the group document when membership arrives, and again on group switch", async () => {
      const resolveSpy = jest.spyOn(db, "resolveGroupDocument").mockResolvedValue("k");
      await db.connect({ appMode: "test", stores, dontStartListeners: true });
      (db as any).autoResolveGroupDocuments();
      expect(resolveSpy).not.toHaveBeenCalled();       // no group yet
      stores.user.setCurrentGroupId("3");
      expect(resolveSpy).toHaveBeenCalledTimes(1);
      stores.user.setCurrentGroupId("4");
      expect(resolveSpy).toHaveBeenCalledTimes(2);
    });

    it("does nothing when group documents are not enabled", async () => {
      stores.appConfig.setConfigs([{ groupDocumentsEnabled: false }]);
      const resolveSpy = jest.spyOn(db, "resolveGroupDocument").mockResolvedValue("k");
      await db.connect({ appMode: "test", stores, dontStartListeners: true });
      (db as any).autoResolveGroupDocuments();
      stores.user.setCurrentGroupId("3");
      expect(resolveSpy).not.toHaveBeenCalled();
    });

    it("does nothing for a teacher", async () => {
      stores.user = UserModel.create({ id: "1", portal: "example.com", type: "teacher" });
      const resolveSpy = jest.spyOn(db, "resolveGroupDocument").mockResolvedValue("k");
      await db.connect({ appMode: "test", stores, dontStartListeners: true });
      (db as any).autoResolveGroupDocuments();
      expect(resolveSpy).not.toHaveBeenCalled();
    });

    it("disconnect disposes the reaction", async () => {
      const resolveSpy = jest.spyOn(db, "resolveGroupDocument").mockResolvedValue("k");
      await db.connect({ appMode: "test", stores, dontStartListeners: true });
      (db as any).autoResolveGroupDocuments();
      db.disconnect();
      stores.user.setCurrentGroupId("3");
      expect(resolveSpy).not.toHaveBeenCalled();
    });
  });
```
Adapt to reality where needed: `setCurrentGroupId` is what `db-groups-listener.ts:32` calls; `UserModel` `type: "student"` drives `isStudent` (verify in `src/models/stores/user.ts`); teachers have no `offeringId` claim. If `stores.appConfig.setConfigs` isn't available on the spec stores, construct `stores` with the config instead — mirror how existing db tests configure `specStores`.

- [ ] **Step 2: Run to verify failure** — `npx jest src/lib/db.test.ts -t "autoResolveGroupDocuments"` → FAIL.

- [ ] **Step 3: Implement in `db.ts`**

Imports (line 7): `import { observable, makeObservable, reaction, IReactionDisposer } from "mobx";`

Field near the other privates:
```ts
  private groupDocumentDisposer?: IReactionDisposer;
```

Method (place after `createDeclaredClassWideDocuments`):
```ts
  // Eagerly converge each group onto its default document as soon as the student's group membership is
  // known — and again when it changes — so group documents exist (and appear in Sort Work) before anyone
  // opens one. Resolver-only: nothing is opened here. Mirrors createDeclaredClassWideDocuments; a
  // reaction rather than a one-shot call because the groups listener sets currentGroupId after unit
  // load, and it covers group switching for free. DBGroupsListener itself stays document-free.
  private autoResolveGroupDocuments() {
    const { appConfig, user } = this.stores;
    if (!appConfig.groupDocumentsEnabled) return;
    this.groupDocumentDisposer = reaction(
      () => (user.isStudent ? user.currentGroupId : undefined),
      (groupId) => {
        if (!groupId || !user.offeringId) return;
        this.resolveGroupDocument().catch((err) => {
          console.error("Failed to auto-create group document", err);
        });
      },
      { fireImmediately: true }
    );
  }
```

Invoke it in `connect()` right after `this.createDeclaredClassWideDocuments();` (~line 230):
```ts
              this.createDeclaredClassWideDocuments();
              this.autoResolveGroupDocuments();
```

Dispose in `disconnect()`:
```ts
    this.groupDocumentDisposer?.();
    this.groupDocumentDisposer = undefined;
```

- [ ] **Step 4: Run to verify pass** — `npx jest src/lib/db.test.ts` → all green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db.ts src/lib/db.test.ts
git commit -m "CLUE-377: eagerly resolve each group's document as membership resolves"
```

---

## Task 4: Workspace — start in the group document

**Files:**
- Modify: `src/components/document/document-workspace.tsx`

No new jest file for this class component (mounting it needs the full store tree); its decision inputs (`startsInGroupDocument`, `isStudent`) are covered by Task 1's tests, the open path by Task 2's, and the wiring by Task 6's manual QA. Note this explicitly in the PR description.

- [ ] **Step 1: Map `"group"` out of the default-content spec** (`getDefaultDocumentContentSpec`, ~line 165):
```ts
  private getDefaultDocumentContentSpec() {
    const { appConfig: { defaultDocumentType, defaultDocumentTemplate, defaultDocumentTemplateEnabled } }
      = this.stores;
    // "group" reaches here only as the fallback (teacher, no group, or misconfiguration) — the group-doc
    // start path is chosen before this spec is consulted — so it degrades to the problem document.
    const type = defaultDocumentType === "group" ? ProblemDocument : defaultDocumentType;
    // Apply the template unless it has been explicitly switched off (undefined/legacy → apply).
    const template = defaultDocumentTemplateEnabled !== false ? defaultDocumentTemplate : undefined;
    return { type, content: DocumentContentModel.create(template) };
  }
```

- [ ] **Step 2: Split the default-document guarantee from setting it primary** (`loadDefaultPrimaryDocument`, ~line 187):
```ts
  // Guarantees the unit's default (problem/personal) document exists and is open in the store,
  // WITHOUT making it the workspace primary. When the unit starts students in the group document the
  // student still needs their own problem document — 4-up and publishing depend on it existing.
  private async guaranteeDefaultDocument() {
    const { db, sectionsLoadedPromise } = this.stores;
    const { type, content } = this.getDefaultDocumentContentSpec();
    await sectionsLoadedPromise;
    const documentContent = this.getDefaultSectionedDocumentContent(type, content);
    return db.guaranteeOpenDefaultDocument(type, documentContent);
  }

  private async loadDefaultPrimaryDocument() {
    const defaultDocument = await this.guaranteeDefaultDocument();
    if (defaultDocument) {
      this.stores.persistentUI.problemWorkspace.setPrimaryDocument(defaultDocument);
    }
  }
```

- [ ] **Step 3: The group-doc start path** (new method, near `loadDefaultPrimaryDocument`):
```ts
  // The unit starts students in their group's shared document. Group membership resolves after mount
  // (the groups listener sets currentGroupId), so wait for it — bounded, then fall back to the default
  // document rather than an empty workspace. The student's own default document is still guaranteed in
  // the background.
  private async loadGroupPrimaryDocument() {
    const { db, persistentUI: { problemWorkspace }, user } = this.stores;
    try {
      await when(() => !!user.currentGroupId && !!user.offeringId, { timeout: 30000 });
      const groupDocument = await db.getOrCreateGroupDocument();
      problemWorkspace.setPrimaryDocument(groupDocument);
    } catch (err) {
      console.warn("Could not open the group document as the default; using the default document", err);
      await this.loadDefaultPrimaryDocument();
      return;
    }
    this.guaranteeDefaultDocument().catch((err) => {
      console.warn("Failed to guarantee the background default document", err);
    });
  }
```
Add `when` to the existing mobx import at the top of the file.

- [ ] **Step 4: Branch `guaranteeInitialDocuments`** (~line 203) — replace the first `if`:
```ts
    if (!problemWorkspace.primaryDocumentKey) {
      if (this.stores.appConfig.startsInGroupDocument && this.stores.user.isStudent) {
        await this.loadGroupPrimaryDocument();
      } else {
        await this.loadDefaultPrimaryDocument();
      }
    } else if (groupDocumentsEnabled || classWideDocuments?.length) {
```
(The `else if` reopen branch is unchanged — it already handles a persisted group-doc primary.)

- [ ] **Step 5: Re-point on group switch** (the reaction effect, ~lines 63-68) — replace `this.loadDefaultPrimaryDocument();` with:
```ts
        // "Switching groups shows a different doc": when the unit starts students in the group
        // document, follow the student to their NEW group's document; otherwise fall back to the
        // default document as before.
        if (this.stores.appConfig.startsInGroupDocument && this.stores.user.isStudent) {
          this.loadGroupPrimaryDocument();
        } else {
          this.loadDefaultPrimaryDocument();
        }
```

- [ ] **Step 6: Verify** — `npm run check:types && npx eslint src/components/document/document-workspace.tsx && npx jest src/components/document` (run whatever tests exist under that path; all green).

- [ ] **Step 7: Commit**

```bash
git add src/components/document/document-workspace.tsx
git commit -m "CLUE-377: start students in their group's document when the unit says so"
```

---

## Task 5: Authoring form + types

**Files:**
- Modify: `src/authoring/types.ts` (add both properties to the unit-config type — neither exists there yet)
- Modify: `src/authoring/components/workspace/document-settings.tsx` (follow the file's existing fieldset/register/onSubmit patterns exactly)
- Test: `src/authoring/components/workspace/document-settings.test.tsx` (extend following its existing patterns)

- [ ] **Step 1: `src/authoring/types.ts`** — add to the unit config interface:
```ts
  defaultDocumentType?: "problem" | "personal" | "group";
  groupDocumentsEnabled?: boolean;
```

- [ ] **Step 2: Form fields.** In `document-settings.tsx`, add a fieldset (adapting names to the file's `INputs` interface, `currentX` memo, and `onSubmit` draft-write conventions):
```tsx
      <fieldset>
        <legend>Starting Document</legend>
        <p className="muted">
          Which document students start in. &ldquo;Group doc&rdquo; also enables group documents for the
          unit (each group&rsquo;s document is auto-created and appears in Sort Work). Teachers always
          start in the problem document.
        </p>
        <label htmlFor="defaultDocumentType">Start students in</label>
        <select id="defaultDocumentType" defaultValue={currentDefaultDocumentType}
                {...register("defaultDocumentType")}>
          <option value="problem">Problem doc</option>
          <option value="personal">Personal doc</option>
          <option value="group">Group doc</option>
        </select>
        <label>
          <input type="checkbox" {...register("groupDocumentsEnabled")}
                 defaultChecked={currentGroupDocumentsEnabled}
                 disabled={(watch("defaultDocumentType") ?? currentDefaultDocumentType) === "group"} />
          {" "}Enable group documents
        </label>
      </fieldset>
```
with memos `currentDefaultDocumentType` (`unitConfig?.config?.defaultDocumentType ?? "problem"`) and `currentGroupDocumentsEnabled` (`?? false`), `watch` added to the `useForm` destructure. In `onSubmit`: write `defaultDocumentType` only when not `"problem"` (delete otherwise, matching the omit-the-default convention); when the choice is `"group"`, write `groupDocumentsEnabled: true` explicitly (the checkbox is disabled and submits undefined — never delete a saved `true` in that case); otherwise write/delete per the checkbox.

- [ ] **Step 3: Test + verify.** Extend `document-settings.test.tsx` with one render test: selecting "Group doc" disables (and effectively checks) the enable checkbox; submitting writes `defaultDocumentType: "group"` and `groupDocumentsEnabled: true`. Then `npm run check:types && npx jest src/authoring && npx eslint src/authoring/types.ts src/authoring/components/workspace/document-settings.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/authoring/types.ts src/authoring/components/workspace/document-settings.tsx \
  src/authoring/components/workspace/document-settings.test.tsx
git commit -m "CLUE-377: authoring choice for starting document (problem/personal/group)"
```

---

## Task 6: Docs + QA unit

**Files:**
- Modify: `docs/unit-configuration.md` (the `defaultDocumentType` entry ~line 44 and `groupDocumentsEnabled` entry ~line 121)
- Create: `src/public/demo/units/qa-group-default/content.json` (copy `qa-class-wide/content.json`, then adjust)

- [ ] **Step 1: `docs/unit-configuration.md`.** Replace the two entries:
```markdown
`defaultDocumentType`: ("problem" | "personal" | "group") which document a student starts in. "group"
starts students in their group's shared document (teachers always get the problem document) and implies
`groupDocumentsEnabled`. Applied on first visit and when the student switches groups; otherwise the
last-opened document is restored.

`groupDocumentsEnabled`: (boolean | undefined) If true, group documents exist for the unit: the
File ▸ Group Doc menu item appears, and each group's document is auto-created as members' group
membership resolves — so it is visible in Sort Work before anyone edits it. Implied by
`defaultDocumentType: "group"`; an explicit `false` wins over that implication (students then fall back
to the problem document, with a console warning). If groups are not permitted
(`autoAssignStudentsToIndividualGroups` is true), both settings have no effect. `classWideDocuments`
is independent of both.
```

- [ ] **Step 2: QA unit.** Copy `src/public/demo/units/qa-class-wide/content.json` → `src/public/demo/units/qa-group-default/content.json`; change `code` to `"qa-group-default"`, `title`/`subtitle` to describe "starts students in the group document", and in `config` set:
```json
"defaultDocumentType": "group",
"classWideDocuments": [ { "kind": "drivingQuestionBoard", "title": "Driving Question Board" } ]
```
(deliberately no explicit `groupDocumentsEnabled` — it exercises the implication). Grep for how `qa-class-wide` is registered/loaded (`grep -rn "qa-class-wide" src cypress docs`) and mirror every registration point.

- [ ] **Step 3: Commit**

```bash
git add docs/unit-configuration.md src/public/demo/units/qa-group-default
git commit -m "CLUE-377: document the settings; add qa-group-default demo unit"
```

---

## Task 7: Full verification

- [ ] **Step 1: Suites** — `npx jest src/lib/db.test.ts src/models/stores/configuration-manager.test.ts src/models/stores/app-config-model.test.ts src/lib/scoped-document-pointers.test.ts src/authoring` → all green.
- [ ] **Step 2: Whole-tree checks** — `npm run check:types` and `npx eslint` over every file this plan touched → no errors.
- [ ] **Step 3: Manual QA on localhost (before any push):**
  - `qa-group-default`, two students joining one group: both land in the SAME group document; each group's doc and the DQB appear in Sort Work before any edits (blank thumbnail in the Problem view, label buttons elsewhere).
  - Student switches groups → workspace re-points to the new group's document.
  - Teacher in the same unit → problem document; group docs + DQB visible in Sort Work.
  - `qa` unit (`groupDocumentsEnabled` only): students still start in the problem document; group docs now auto-appear in Sort Work.
  - `qa-class-wide` (non-regression): problem-doc default; DQB immediately visible/editable; NO per-group docs created.
- [ ] **Step 4: Do not push** until the localhost QA passes and the user OKs.

**Deferred (note in the PR description):** a Cypress smoke spec against `qa-group-default` (two-student group convergence) — valuable but authored blind since Cypress cannot run in this dev environment; propose as a follow-up or write it and let CI validate, per reviewer preference.
