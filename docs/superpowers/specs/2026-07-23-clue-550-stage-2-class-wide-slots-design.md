# CLUE-550 Stage 2 — Class-wide Slots + Get-or-Create via Pointer — Design

> **Status:** Design spec for this PR. Self-contained: it describes exactly what this PR delivers and cites only
> docs already in the repo.
>
> **Where this fits.** Stage 1 landed the two stored axes (`concurrent`, `kind`) and split group-document
> behavior onto them, with **no user-visible change**
> ([2026-07-23-clue-550-stage-1-document-axes-design.md](2026-07-23-clue-550-stage-1-document-axes-design.md)).
> Stage 2 is the next slice of the *document-axes* decomposition: it makes the app **auto-create** a class-wide
> collaborative document — the Driving Question Board (DQB) is the default slot — exactly once per class per unit,
> server-race-free. It reuses the axes from Stage 1 and the CLUE-524 canonical-pointer engine; it adds **no UI**
> (Sort Work sectioning, titling, and the workspace surface are Stage 3). The roadmap lives at
> [../../document-axes/README.md](../../document-axes/README.md).
>
> **Builds on:**
> - **CLUE-524 scoped singleton document pointers** — the `canonical` pointer layer and
>   `getOrCreateCanonicalDocument`
>   ([2026-07-11-scoped-singleton-document-pointers-design.md](2026-07-11-scoped-singleton-document-pointers-design.md)).
> - **CLUE-550 Stage 1** — the stored `concurrent`/`kind` axes, the kind registry, and creation-time stamping in
>   `createFirestoreMetadataDocument`.

## Summary — what this PR delivers

1. **Unit configuration `classWideDocuments`** — an authored array of slots `{ kind, title }` on
   `UnitConfiguration`, read at runtime as `stores.appConfig.classWideDocuments`. This is the correct home for
   the authored DQB title (resolves review issue #2: a curriculum-specific title no longer lives in generic
   settings).
2. **A field-based canonical-pointer path builder in a dedicated, versioned collection** — the group-specific
   helper is replaced by one `getCanonicalPointerPath(scope, label)` that derives the path from the scope fields
   a document carries. Pointers move out of the interleaved class/offering/group tree into a top-level
   `canonical/v1/…` collection, yielding the class+unit pointer
   `canonical/v1/classes/<classHash>/units/<unit>/slots/<label>` (with `label === kind`). Added to
   `scoped-document-pointers.ts` and mirrored in `firestore.rules`.
3. **Class-wide document creation** — a new `getOrCreateClassWideDocument(classWideDoc)` that drives the existing
   `getOrCreateCanonicalDocument` engine against the class+unit pointer, producing a document with
   `concurrent: true`, `kind`, class+unit scope fields (`context_id` + `unit`, no `offeringId`/`groupId`), and
   `canonical: <kind>`. Its RTDB content is owned by a class-scoped synthetic uid `class_<classHash>`.
4. **Auto-creation on unit open** — one `getOrCreateClassWideDocument` per declared slot, fired when the unit
   finishes loading. The canonical-pointer transaction guarantees exactly one document per slot per class per
   unit even under concurrent clients (resolves review issue #1: duplicate-doc race).

The stored `type` value stays `"group"` (the Stage 1-3 transitional convention). No new document type is
introduced; no UI is wired.

## The class-wide document, by axis

A class-wide slot document is the **same generic collaborative document** as a group document, differentiated
only by orthogonal fields:

| Concern | Value | Source |
|---|---|---|
| Behavior — concurrent history, non-owner editable | `concurrent: true` | stamped at creation (Stage 1 axis) |
| Identity / presentation | `kind: "drivingQuestionBoard"` (per slot) | stamped at creation (Stage 1 axis) |
| Title | resolved live from `kind`, **not stored** | `getDocumentTitle` (by-kind presentation lookup) |
| Scope | `context_id` (classHash) + `unit`; **no** `offeringId`/`groupId` | metadata fields |
| Pointer slot | `canonical: <kind>` (label = kind) | pointer-claim transaction |
| Legacy type tag | `type: "group"` (transitional, not branched on) | unchanged |

Because the DQB carries `concurrent: true`, Stage 1's behavior wiring already applies to it with no new code: the
Concurrent history manager is selected (`document.concurrent`), non-owner write-sync is allowed
(`!document.concurrent` gate is false), and class-wide read is granted (the `type == "group"` interim permission
key, plus the Firestore `resourceInUserClass()` class read). This is exactly why Stage 1 kept read/delete keyed
on `type` — the DQB inherits class-wide read/deletability semantics for free, and, being canonical, is protected
from the class-member non-canonical-delete rule.

## The class+unit scope and its pointer

The DQB's scope is **class + unit** (verified against the metadata-field shapes in `db-types.ts`): a class-wide
document available across all of a unit's problems, one per class. With a second canonical scope now in play,
this PR (a) moves canonical pointers out of the interleaved class/offering/group tree into a **dedicated,
versioned collection**, and (b) replaces the group-specific path helper with **one field-based builder** that
derives the path below the version prefix from whichever scope fields a document carries:

```
canonical/v1/classes/<classHash> / (offerings/<offeringId> | units/<unit>) / [groups/<groupId>] / slots/<label>
```

- **Why a dedicated `canonical/v1/…` collection.** Interleaving pointers inside `classes/…` forced one
  fixed-shape rules match block per scope (a recursive wildcard there would over-match real class/offering/group
  data). A dedicated collection lets the rules state the uniform concerns once and keep only what differs
  per-scope (see Firestore rules below). The `v1` segment both versions the layout (a future `v2` can change it
  without touching v1 pointers) and restores even path depth (a valid document path) that the extra top-level
  segment would otherwise break.
- **The `units/` segment is used only when there is no offering.** An offering already pins a unit, so
  offering-scoped pointers omit it. Group documents carry *both* offering and unit, so "offering wins" keeps
  the below-version portion of their path stable. Class-wide documents have a unit and no offering, so they get
  `canonical/v1/classes/<c>/units/<u>/slots/<label>`.
- **The next canonical scope** — problem/planning documents (offering + owner) — slots in as a `users/<owner>`
  segment after the offering; documented in the builder but not built now (`owner` is not yet a stored axis).
- **Label = kind:** for class-wide slots the CLUE-524 pointer label and the `kind` are the same string (e.g.
  `drivingQuestionBoard`), so there is a single identifier per slot. (The group document is the one case where
  they differ — label `default`, kind `group`.)
- **Firestore rules (per concern, not per scope):** all pointer rules are nested under one parent match,
  `canonical/v1/classes/{classId}`, so `classId` is captured once and shared by every child. Because read and
  immutability are uniform across every scope, they are stated once on a nested recursive-wildcard match
  (`{scopePath=**}` → effective path `canonical/v1/classes/{classId}/{scopePath=**}`): any class member reads
  their class's pointers; no block grants update/delete. **Create** is granted only by nested per-scope match
  blocks (`offerings/{o}/groups/{g}/slots/{label}` and `units/{unit}/slots/{label}`), so each scope can authorize
  who may claim its slot — a single wildcard create could not be tightened per-scope, since Firestore ORs `allow`
  rules. A create at any path not matched by a per-scope block is denied by default.
  The `canonicalPointerPath` rules helper (used by `canonicalFieldOk` to confirm a claim via `getAfter`) builds
  the same `canonical/v1/…/slots/<label>` path the same field-driven way, gated by `hasCanonicalScope` (has
  offering *or* unit → else `null`, excluding personal/learning-log docs).

## Creation: reusing the canonical engine

`getOrCreateClassWideDocument(classWideDoc)` builds the class+unit pointer path and delegates to the same race-safe
`getOrCreateCanonicalDocument` used by group documents (fast-path on an existing pointer; otherwise
create-document-then-claim-pointer-atomically, deleting the orphan on a lost race). Rather than branch on a new
type or a bespoke descriptor, the creation path was generalized off `type` onto the kind registry:

- **Kind-driven creation in `createDocument`.** `createDocument` takes a first-class `kind` argument (defaulting
  to `type`, since every document except a class-wide slot has a kind equal to its type) and no longer needs a
  `classWide` descriptor. The `kind` drives everything that used to be a `type` branch: the owner uid
  (`getDocumentOwner`, next bullet), and — inside `createFirestoreMetadataDocument` — the scope association
  fields (`getDocumentScopeFields`, following bullet) and the stamped kind axis fields
  (`getDocumentKindMetadataFields(kind)`; each slot kind registered with `metadataFields: { concurrent: true }`).
  Passing `kind` explicitly matters because a class-wide slot's kind (e.g. `drivingQuestionBoard`) differs from
  its transitional `type: "group"` — the default `type`-derived lookup would mis-stamp `kind: "group"`. The RTDB
  metadata `createDocument` writes for *any* `type: "group"` document (regular group or class-wide) is now just
  the base `{ version, self, createdAt, type }` — no scope, owner, title, or kind: only `createdAt` is ever read
  back from that node (at open), and everything else is stamped into the Firestore metadata (see "Metadata shape"
  below). So the two share one RTDB shape and `createDocument` no longer needs a class-wide RTDB branch.
- **A class-scoped synthetic owner, selected via the kind registry.** All document *content* in RTDB lives
  under a `users/<uid>/documents` segment; a class-wide document has no real owner, so it uses a synthetic uid
  `class_<classHash>` shared by the whole class — exactly as a group document uses `group_<offeringId>_<groupId>`
  (a globally-meaningful owner identity). The unit belongs to the document's canonical *slot*, not its ownership,
  so the owner encodes only the class; every unit's slots for a class share one owner. Which synthetic identity a
  document receives is **registry-declared**: each kind registers an `ownerType` (`user` | `group` | `class`),
  and `getDocumentOwner(kind, ctx)` in the document-kinds module maps it to the concrete uid from runtime context
  (group kind → `group_<off>_<grp>`, class-wide kinds → `class_<classHash>`, everything else → the creating
  user). This is the first slice of the `owner` axis living in one place instead of a `type` switch in `db.ts`.
  Documents are located via their canonical pointer (class + unit + slot), never by enumerating the owner, and
  reads reconstruct the RTDB path from the stored metadata `uid`, so the owner value is not load-bearing;
  `getUserDocumentPath` already accepts an arbitrary owner uid, so no path-template change is needed.
- **Scope association fields, registry-derived for every kind.** `getDocumentScopeFields(kind, ctx)` in the
  document-kinds module returns the complete scope-field set a document of that kind stamps, keyed on the kind's
  registered `scopeType` — an axis **independent** of `ownerType` (a kind declares both). `context_id` (the
  class) is always included; each `scopeType` then adds its subset: `group` → `offeringId` + `groupId` + `unit` +
  `investigation` + `problem`; `offering` → `offeringId` + `unit` + `investigation` + `problem`; `classUnit` →
  `unit`; `class` (and unregistered kinds) → a null `unit`. Because **every** kind is now registered,
  `createFirestoreMetadataDocument` resolves scope for all document types through this one call, and its former
  per-`type` scope switch is gone. The runtime values (`classHash`, `offeringId`, `currentGroupId`, and the
  current problem/investigation/unit) are read from the stores inside `createFirestoreMetadataDocument`, so they
  are no longer threaded through as parameters. That the stores actually hold the required context is checked once
  up front by `db.ts`'s `validateDocumentKindCreation(kind)` (e.g. a group kind requires the user to be in a
  group; it throws before anything is written). This is the first slice of the `scope` axis, and it lets
  `createDocument` drop both the `classWide` descriptor and the type switch.
- **Pointer `createdBy` records the real creator.** The canonical-pointer `createdBy` is written as the actual
  `user.id` of whoever won the creation race (or backfilled a legacy pointer), decoupled from the document's
  synthetic owner — extra provenance about who materialized the shared document. The synthetic owner uid is used
  only for the document's storage path and for orphan cleanup (read back from the created metadata's `uid`).

### Metadata shape: one options object, explicit Firestore fields, collapsed RTDB

The metadata plumbing was simplified alongside the kind-driven creation, decoupling the Firestore metadata from
the RTDB metadata:

- **`createFirestoreMetadataDocument` takes an options object, not the RTDB metadata.** Its signature is now
  `createFirestoreMetadataDocument(opts: { documentKey, type, kind, owner, createdAt, title? })`. It reads the
  runtime scope from the stores (via `getDocumentScopeFields`), and builds every Firestore field **explicitly** —
  `type`, `createdAt`, `network`, `key`, `properties`, `uid: owner`, the optional `title`, the resolved
  `scopeFields`, and the `kindFields` — copying nothing from the round-tripped RTDB metadata. This removes the
  last reason the RTDB metadata was read back other than to resolve the server `createdAt` timestamp, and paves
  the way to drop the RTDB metadata node entirely in a later stage.
- **RTDB metadata collapsed; `DBClassWideDocMetadata` removed.** Because `createDocument` writes only
  `{ version, self, createdAt, type }` for a `type: "group"` document, regular group and class-wide documents
  share one RTDB metadata shape. `DBClassWideDocMetadata` was accordingly deleted and `DBGroupDocMetadata` reduced
  to a bare `{ type: "group" }` extending the base — a single shape covering both, since `type` can no longer
  carry the group/class-wide distinction (their differing scope shapes live only in the Firestore metadata,
  stamped from the kind). This is the concrete case that motivates the requirement-type/guard approach in
  [../../document-axes/target-architecture.md](../../document-axes/target-architecture.md) ("Already visible in
  the code").
- **Kind axis fields are stamped only on `type: "group"` documents.** Every kind is registered (so scope/owner
  resolve for all types), but `createFirestoreMetadataDocument` persists the kind axis fields
  (`kind` + `concurrent`) **only** for `type: "group"` documents — `kindFields = type === GroupDocument ?
  getDocumentKindMetadataFields(kind) : {}`. The publication kinds may later be consolidated into the kinds they
  publish, so we deliberately avoid stamping a `kind` onto other documents' Firestore metadata that we would then
  have to migrate. (Non-group kinds carry no `concurrent` axis either, so nothing else is lost.)
- **Titles are resolved by kind, never stamped per document.** The authored slot title (from
  `classWideDocuments`) is registered on the kind, not written onto the document; `getDocumentTitle(document)`
  resolves a class-wide document's title live from its `kind`, so an author changing the title applies to every
  document of that kind with no migration — presentation is a by-kind lookup, per
  [../../document-axes/target-architecture.md](../../document-axes/target-architecture.md). The same function
  returns the computed `Group {n} Document` label for regular group documents; it keys that on `type` (not
  `kind`) because pre-existing group documents may have no stored `kind` yet. `createDocument`/the canonical path
  therefore no longer thread a `title` for class-wide slots.

Auto-creation is invoked once per unit open, in `DB.connect()`'s `unitLoadedPromise.then(...)` block (alongside
`exemplarController.initialize`), iterating `stores.appConfig.classWideDocuments`. Each entry is created
fire-and-forget; the pointer transaction converges all class members to one document per slot, so a failure never
blocks startup and needs no "am I first" gating.

**Kind validation and uniqueness.** All kind checking lives in one place — `registerDocumentKind`, called before
each class-wide document is created. A `kind` is used as a Firestore path segment (the canonical-pointer slot)
and the registry key, so `registerDocumentKind` requires it to be a **camelCase identifier**
(`/^[a-z][a-zA-Z0-9]*$/`, via `isValidDocumentKind` — matching the built-in document-type strings) and rejects a
kind that is **already registered** (a duplicate class-wide entry, or one that collides with a built-in kind).
Both violations throw; `createDeclaredClassWideDocuments` catches the throw, logs it, and skips that entry rather
than crash startup, so one malformed or duplicate author entry never blocks the others. The same throwing
registry also surfaces a developer mistake — a new built-in kind that is malformed or collides — loudly at module
load. (Built-in kinds register via `registerBuiltInDocumentKinds()`; a test-only reset re-registers them because
the registry is module-global.)

## Review issue #6 — first-session history ordering

Issue #6 was a content-drift guard **globally weakened** in PR #2890 (a `history.length === 0` early return) to
mask a DQB creation race where the Firestore metadata document did not yet exist when the first session began
uploading history. This PR resolves #6 as follows:

- **The revert is a no-op here.** PR #2890 was superseded and never merged; the `history.length === 0` early
  return exists in neither this branch nor master (`checkContentDriftAgainstHistory` in
  `firestore-history-manager.ts` has only the `!savedId` and `found` guards). There is nothing to revert — the
  corruption guard is already intact for all concurrent documents.
- **The real cause cannot occur on this creation path.** `getOrCreateCanonicalDocument` writes the Firestore
  metadata document (and the pointer-claim `update` touches it) **before** the document is opened and its history
  manager subscribes. So a freshly created DQB always has its metadata present before the first history write,
  and — being empty with no saved `lastHistoryEntryId` — cannot produce a first-session drift false-positive.

This is **verified** by an emulator test (metadata readable before any history entry; two concurrent pointer
claims converge to one documentKey) rather than by changing drift-guard code.

## Security rules — what changed and what did not

- **RTDB rules: no change.** `database.rules.json` already grants `.write` on the entire `classes/<classHash>`
  subtree to any authenticated user whose `class_hash` matches, which covers writes under the synthetic-uid
  document path.
- **Firestore rules: the document create/update path is unchanged.** `isValidDocumentCreateRequest()` already
  lets a class member create a document whose `context_id` is their own class (`classIsRequestContextId()`), and
  requires the create to carry no `canonical` (granted only later by the pointer-claim `update`). So creating the
  class-wide document itself needs no rules change; the pointer-scope rules (the `canonical/v1/…` match blocks and
  the `canonicalPointerPath` helper) are what this PR reworks.
- **No pointer data migration.** Moving pointers to `canonical/v1/…` orphans any pointers written at the old
  interleaved paths, but that is safe: canonical pointers exist only for group documents, which are unreleased,
  and an orphaned old pointer simply isn't found by the new builder — get-or-create falls back to its existing
  no-pointer path (legacy query / fresh create). A little duplication for pre-existing group pointers is
  acceptable given group docs aren't in real use.

## Boundaries and non-goals

Deferred to later stages (see [../../document-axes/README.md](../../document-axes/README.md)):

- **All UI.** Sort Work "Whole Class" sectioning, the unit-scoped query/listener, kind-driven presentation
  (title/icon/title-bar), and the shared edit-gate predicate are Stage 3. This PR creates the documents but shows
  nothing.
- **Kind-driven presentation (partial).** Each slot's `kind` is registered now with its stamped axis fields
  (`metadataFields: { concurrent: true }`) **and its authored title**, and the title is already resolved by kind
  via `getDocumentTitle` (the first presentation slice landing off the registry). The remaining presentation
  (icon, title-bar treatment, Sort Work sectioning) is deferred to Stage 3. Icon is not authored yet — no
  `icon` field is added to `classWideDocuments` in this PR, and how icon is configured is a Stage-3 decision.
  (Class-wide documents never hit the Stage-1 on-open backfill — their `concurrent` is stamped at creation — so a
  kind unregistered in some other session at open time is harmless.)
- **Unified presence.** The class-scoped presence/activity channel is Stage 4.
- **Retiring the legacy type.** The flip of `type` to `"generic"` and removal of `GroupDocument`/`isGroup` is the
  Stage 4 closing cleanup. Class-wide documents are unreleased; no data migration.
- **General scope modeling.** Scope stays in the existing metadata fields; no `scope` struct or `scopeLevel`
  enum. The class+unit shape is read directly (a unit present, offering/group absent).

## Testing

- **Unit (Jest, mocked Firebase):** `classWideDocuments` config resolution; the class+unit pointer path helper;
  `createFirestoreMetadataDocument` stamping class+unit scope + explicit `kind` + `concurrent` (and *not*
  `offeringId`/`groupId`/`canonical`); `getOrCreateClassWideDocument` fast-path and create-path (mints a
  class-wide doc, claims the class+unit pointer, `canonical === kind`); `createDeclaredClassWideDocuments` firing
  one creation per declared entry and none when unset, and **skipping** an entry whose `kind` is invalid
  (non-camelCase) or duplicates an already-registered kind; `isValidDocumentKind` accept/reject cases and
  `registerDocumentKind` throwing on a malformed or duplicate kind.
- **Rules (emulator):** a class member may create/read the class+unit pointer; it is immutable; a different-class
  user is denied; a class-wide document may set its `canonical` label only when its class+unit pointer confirms
  it; two concurrent claims converge to one documentKey; the metadata document is readable before any history
  exists.
- Full `npm test`, `npm run check:types`, `npm run lint:build`, and the `firebase-test` rules suite green.

## References

- Stage 1 design: [2026-07-23-clue-550-stage-1-document-axes-design.md](2026-07-23-clue-550-stage-1-document-axes-design.md).
- Overall project design + staged decomposition:
  [2026-07-16-clue-550-class-wide-collaborative-documents-design.md](2026-07-16-clue-550-class-wide-collaborative-documents-design.md).
- CLUE-524 canonical pointers:
  [2026-07-11-scoped-singleton-document-pointers-design.md](2026-07-11-scoped-singleton-document-pointers-design.md).
- Document-axes roadmap: [../../document-axes/README.md](../../document-axes/README.md).
- Key code sites: `src/models/stores/unit-configuration.ts`, `src/models/stores/configuration-manager.ts`,
  `src/models/stores/app-config-model.ts`, `src/lib/scoped-document-pointers.ts`, `firestore.rules`,
  `src/lib/db-types.ts`, `src/lib/db.ts`, `src/models/document/document-kinds.ts`,
  `src/models/document/document-utils.ts` (`getDocumentDisplayTitle` → `getDocumentTitle`),
  `firebase-test/src/canonical-pointers-rules.test.ts`.
