# Scoped Singleton Document Pointers — Design

- Date: 2026-07-11
- Jira: [CLUE-524](https://concord-consortium.atlassian.net/browse/CLUE-524) — "2 Group docs can be
  created simultaneously when users open together"
- Status: Draft for review
- Related code: `src/lib/db.ts` (`getOrCreateGroupDocument`, `createDocument`,
  `createFirestoreMetadataDocument`), `functions-v2/src/create-firestore-metadata-document.ts`,
  `firestore.rules`, `src/models/stores/documents.ts` (required-document promises).

## 1. Background & problem

### The bug

`getOrCreateGroupDocument` ([db.ts](../../../src/lib/db.ts)) finds the group's document with a
Firestore query on `(context_id, offeringId, groupId)`, and if the query returns nothing it creates
a new document. The read and the create are not atomic, so two clients in the same group can both see
"no group document," both create one, and the group ends up split across two separate documents. This
is documented in the `FIXME` in `getOrCreateGroupDocument` and observed in
`docs/group-docs/group-docs-current-state.md` ("Duplicate Group Documents").

The `FIXME` notes that a proper fix wants the Firestore metadata document created client-side (so it
can participate in an atomic operation) instead of by the `createFirestoreMetadataDocument_v2` cloud
function, which is called fire-and-forget and not awaited.

### Why a query can't close the race

Firestore's **client** Web SDK (CLUE is on Firebase 8) cannot read a query inside a transaction —
`runTransaction` only supports `get(documentRef)` on a single, known reference. Query-in-transaction
exists only in the Admin SDK, which is what we are moving off of. A transaction serializes concurrent
writers by making them collide on one shared document reference; a query has no such reference, so two
clients both read "empty" and both proceed. Closing the race therefore requires a **deterministic
document reference** that both racing clients target.

### The existing per-offering singleton mechanism (and why not to copy it)

The "one Problem document per offering" rule is enforced today by the **required-document promises** in
`documents.ts` plus `DBProblemDocumentsListener`, not by any deterministic key:

- On store init a promise per required type is created (`addRequiredDocumentPromises`).
- The listener reads the offering-user's documents once and resolves the promise with the first
  existing document, or with `null` if there are none.
- `guaranteeOpenDefaultDocument` awaits the promise and only creates a document when it resolves `null`.

This only prevents **one client** from double-creating (it guards the local read-vs-create ordering).
Two different clients/tabs that both observe `null` will each create a Problem document — the same
multi-client race as the group-document bug, latent because simultaneous first-open is rarer.
Uniqueness is by convention (every code path must go through `guarantee…`), not structure. This spec
introduces a structural, cross-client mechanism intended to eventually replace this one.

### Multiple RTDB metadata locations

Each document has up to three RTDB locations (`Firebase.getDocumentPaths`):

- **content** — `users/<uid>/documents/<key>`
- **documentMetadata** — `users/<uid>/documentMetadata/<key>` (basic metadata for all types)
- **typedMetadata** — a type-specific index: Problem → `offerings/<off>/users/<uid>/documents/<key>`,
  Planning → `.../planning/<key>`, Personal → `users/<uid>/personalDocs/<key>`, LearningLog →
  `.../learningLogs/<key>`.

The typedMetadata locations exist as **discovery indexes** because RTDB cannot query by field — they
let a listener enumerate "this user's Problem docs in this offering" by listing a known path. This is a
query workaround, and Firestore's native queries already replace it. The pointer introduced here is a
**different concern** — atomic singleton reservation — not a re-introduction of the discovery index.

## 2. Goals & non-goals

### Goals

- Eliminate the duplicate-group-document race with a structural, cross-client mechanism.
- Move Firestore metadata creation for **all** document types from the fire-and-forget cloud-function
  call to an **awaited client-side write**.
- Introduce a general **scoped singleton pointer** layer, and use it for CLUE group documents.
- Design the pointer layer to also cover future class-wide documents (multi-offering, multi-type) and
  the Problem-document singleton, without implementing those now.

### Non-goals (designed-for, not built in this spec)

- Class-wide group documents.
- Migrating the Problem-document promise/listener guard onto the pointer layer.
- User-scoped (non-offering) singleton documents.
- Retiring the `createFirestoreMetadataDocument_v2` cloud function (it stays for comment paths).

## 3. Design overview — two layers

- **Document layer (key scheme unchanged):** every document — group, problem, personal, and any
  future "additional" document at any scope — keeps a **random key** (RTDB content + a random-keyed
  Firestore metadata document under the `documents` collection). Uniform; no deterministic/random mix
  in the hot `documents` collection, which keeps it aligned with Firestore's id-distribution guidance.
- **Scope-pointer layer (new):** a small set of **deterministically-addressed** Firestore documents,
  one per (scope, type), each holding the canonical document's key. "The single common document for a
  scope" = *has a pointer*; "additional documents" = *ordinary random-keyed documents with no
  pointer*. The pointer is kept **separate from the metadata document**, so the mixed-key concern is
  not reintroduced one layer down.

Atomicity comes from a **transaction on the deterministic pointer reference** (see §5).

## 4. Data model — pointer paths & schema

Pointers are stored in a `canonical` subcollection nested under the scope's document, with **each part
of the scope as its own bare-id path segment**. All paths are relative to the Firestore root
(`authed/<portal>`, `demo/<demoName>`, `dev/<uid>`, `qa/<uid>`, `test/<…>` — always 2 segments, so the
totals below stay even, as Firestore document paths require).

| Scope | Pointer document path (under the root) | Rel. segments |
|---|---|---|
| Class-wide *(future)* | `classes/<classHash>/canonical/<type>` | 4 ✓ |
| CLUE group *(this spec)* | `classes/<classHash>/offerings/<offeringId>/groups/<groupId>/canonical/<type>` | 8 ✓ |
| Problem / offering-user *(future)* | `classes/<classHash>/offerings/<offeringId>/users/<uid>/canonical/<type>` | 8 ✓ |
| User, non-offering *(future, open)* | `classes/<classHash>/users/<uid>/canonical/<type>` | 8 ✓ |

Notes:

- **`classHash`** is the class segment — the same bare identifier the existing `classes` collection and
  security rules already use (`get(.../classes/$(context_id))`).
- The `offerings` **subcollection under `classes`** uses a **bare `offeringId`** and does not collide
  with the existing root-level `offerings` collection, which is keyed `${network}_${offeringId}`
  (network baked into the id — unusable for a bare-offering scope).
- **Naming:** `canonical` (lowercase single word, matching the Firestore path convention) signals "the
  canonical/singleton document of this type at this scope." Renameable if preferred.
- The **user-scoped** row is illustrative only; whether it nests under `classes/<classHash>/users/…` or
  uses the existing top-level `users` collection is deferred to when that work is scheduled.

### Pointer document schema

```
{
  documentKey: string;   // -> the random-keyed document (RTDB content + Firestore metadata)
  createdAt:   Timestamp;
  createdBy:   string;   // creating user's uid (group fake-uid for group documents)
}
```

Scope and type are encoded in the path, so nothing redundant is stored. Pointers are **immutable**
once written.

### Canonical marker on the metadata document

The pointer is the source of truth for reservation, but the canonical document's **metadata document**
also carries a **`canonical: true`** field, written **inside the pointer transaction** (§5) so it is
always in sync with the pointer (absent = non-canonical). It exists so that (a) the delete rule can be a
uniform O(1) flag check rather than a per-scope pointer lookup, and (b) UI such as the sort-work view can
query or badge canonical documents directly. Its integrity is enforced by the `documents` update guard
in §7.

## 5. Atomic creation flow

A new `getOrCreateScopedDocument(scope, type)` generalizes `getOrCreateGroupDocument`.
`getOrCreateGroupDocument` becomes a thin caller that supplies the group scope
(`classes/<classHash>/offerings/<offeringId>/groups/<groupId>`) and `GroupDocument` type.

Ordering is **document-first, then claim the pointer** — this guarantees a pointer never references a
missing document. A lost race leaves an unreferenced (orphan) document, which is harmless and rare
(only true simultaneous first-creation), rather than a dangling pointer, which would be a correctness
bug.

```
async getOrCreateScopedDocument(scope, type):
  pointerRef = firestoreRef(scope + "/canonical/" + type)

  // 1. Fast path
  snap = await pointerRef.get()
  if snap.exists:
    return openByDocumentKey(snap.data().documentKey)

  // 2. Legacy fallback (group only): existing (context_id, offeringId, groupId) query.
  //    If a legacy random-key group document is found, best-effort claim the pointer to
  //    backfill it (ignore contention), then open the legacy document.
  legacy = await findLegacyGroupDocument(scope)   // group scope only; no-op otherwise
  if legacy:
    await tryClaimPointer(pointerRef, legacy.documentKey)   // ignore "already claimed"
    return openByDocumentKey(legacy.documentKey)

  // 3. Create: document first, then claim the pointer atomically
  documentKey = mintKey()                          // RTDB push().key — writes nothing
  await createDocument({ type, key: documentKey, /* scope info */ })   // RTDB content + Firestore metadata
  wonKey = await runTransaction(txn =>
    txn.get(pointerRef).then(s => {
      if (s.exists) return s.data().documentKey       // lost: use the winner's document
      txn.set(pointerRef, { documentKey, createdAt, createdBy })
      txn.update(metadataRefFor(documentKey), { canonical: true })  // flag winner's metadata, same commit
      return documentKey
    }))

  if wonKey !== documentKey:
    // Our created document is now an orphan; fully delete it (RTDB parts + Firestore metadata,
    // see §10), then use the winner's.
    return openByDocumentKey(wonKey)
  return openByDocumentKey(documentKey)
```

- The transaction touches **only Firestore** — the pointer and the winner's metadata document, written
  atomically in one commit so `canonical` is always in sync with the pointer. The RTDB content and the
  (initially unflagged) Firestore metadata are created before the claim.
- `mintKey()` uses `ref(path).push()` with no value — the key is generated client-side and nothing is
  written to RTDB until `createDocument` sets it. A discarded minted key leaves no footprint.
- `openByDocumentKey` resolves the document via its existing Firestore metadata
  (`findFirestoreMetadata` → `openDocumentFromFirestoreMetadata`).

## 6. `createDocument` changes

`createDocument` ([db.ts](../../../src/lib/db.ts)) is shared by all document types; the changes apply
to all of them.

**Why client-side, and why now.** The pointer flow opens a group document through its Firestore
metadata and claims the pointer only after the document exists (§5), so metadata creation must be
**awaited** — which the current fire-and-forget call is not. Awaiting the *existing cloud function*
instead would add its invocation and cold-start latency to the create path (the very cost
fire-and-forget was avoiding). A client-side write is the low-latency way to obtain an awaited,
authoritative creation, so the pointer requirement naturally pulls the metadata write client-side. The
change is applied to **all** document types rather than only the group path to keep a single uniform
create path, to remove the "returned metadata not guaranteed to match Firestore" behavior, and to drop
the vestigial `contextId: "ignored"` field (its only live caller is confirmed QA-only — see §6 item 3).
(Only the *awaited* creation is strictly required by the pointer; extending it to all types is a
deliberate, in-scope cleanup for this story.)

1. **Accept an optional pre-minted `key`.** When provided, write the RTDB document at that child
   instead of `push()`, so the pointer and the document agree on the key. Existing callers pass nothing
   and keep the current `push()` behavior.
2. **Client-side, awaited metadata write.** In `createFirestoreMetadataDocument`, replace the
   fire-and-forget `getFirebaseFunction("createFirestoreMetadataDocument_v2")(…)` call with an
   **awaited** client-side write to the existing `documents/<escapedKey>` metadata path
   (`getSimpleDocumentPath`). The method already reads the document first and returns the existing data
   if present; when absent it now `set`s the metadata client-side and returns the authoritative value
   (fixing the current "not guaranteed to match Firestore" behavior). Metadata document keys are unique
   per document (minted), so this check-then-set does not collide across clients.
3. **Populate the fields the function added, and drop the vestigial one:**
   - real `context_id: classHash` (snake_case — the field rules and functions actually use),
   - **remove** `contextId: "ignored"` (camelCase) from both this write and the `document.metadata`
     getter, and delete the stale db.ts comment about the "out of date" deployed function — the only
     caller of the field's legacy path is now confirmed QA-only (see the note below),
   - `network: context.network || null` — for every document `createDocument` creates on behalf of a
     student (problem, personal, learning-log) and for group documents, `context.network` is
     `undefined` (network is teacher-only, per `auth.ts` and `shared.ts`), so the client writes
     `null` — identical to the current cloud-function behavior. No new "student writes a network id"
     surface is introduced.
   - keep `["uid", "type", "key", "createdAt"]` present (required by the create rule).
   - do **not** write `canonical` here — the metadata document is created unflagged; the `canonical:
     true` marker is added only by the winner's pointer transaction (§5), and the create rule should
     reject a metadata document that arrives pre-flagged.

**On removing `contextId: "ignored"` (verified, 2026-07).** The camelCase `contextId` is a *different*
field from the snake_case `context_id` that rules and functions use. Its only purpose was to satisfy a
*presence* check in the metadata/commentable-document validation of the **old** functions, which never
read its value.

- **When the requirement left the source:** commit `9eae4c5c2` (2022-10-20) changed the
  `isDocumentMetadata` type guard from `!!o?.contextId && !!o.uid && !!o.type && !!o.key` to
  `!!o.uid && !!o.type && !!o.key`. The next commit `477a5a9d9` (same day) added `contextId: "ignored"`
  to the client because the *deployed* functions still required it. It has been this way ~3.75 years.
- **Current source reads nothing:** rules use `context_id`; the current `isDocumentMetadata` requires only
  `uid`/`type`/`key`; no in-repo function reads the camelCase `contextId`.
- **Live v1 callers identified as QA-only (2026-07 check).** The CLUE client cut over to the `_v2`
  comment functions in commit `8ef1c020a` (2025-06-30, CLUE-164), so any v1 traffic is a pre-2025-06-30
  build. Over 90 days the v1 comment traffic is sporadic single-day bursts (`postDocumentComment_v1`: 86
  calls on 2026-07-05/06; `validateCommentableDocument_v1`: 40 on 2026-07-10). Correlating the v1
  execution timestamps against comment `createdAt`/partition shows **every v1 call maps to a `qa`-partition
  test account** ("Teacher 7", uid 1007, network `foo`, unit `foo_msa`) running an old build — while the
  real production `authed/learn_concord_org` comments in the same window occur at other times and are the
  current `_v2` client. So the only thing exercising the v1 comment/metadata path is **QA testing on an
  old CLUE build**, not live classrooms. The v1 functions' deployed source is not in this repo.
- **Decision:** **remove** `contextId` from both the `createFirestoreMetadataDocument` write and the
  `document.metadata` getter, and delete the stale db.ts comment (the `createFirestoreMetadataDocument_v2`
  callable was redeployed 2026-01/02 and validates via `isDocumentMetadata`; the "out of date" claim is
  wrong). The only path that still touched the legacy field was a QA test account on an old build via the
  `postDocumentComment_v1` / `validateCommentableDocument_v1` functions — and **those were deleted from
  production on 2026-07-13**, so there is now **no deployed function anywhere that reads the field**.
  Removal carries no residual risk. (The other `_v1` functions — `getImageData_v1`, `getNetworkDocument_v1`,
  `getNetworkResources_v1`, `publishSupport_v1` — are the current implementation and were left in place.)

The metadata document stays a **random-keyed document in the `documents` collection** — it is not the
pointer.

## 7. Firestore security rules

Add a match block for the group pointer only. Other scopes (class-wide, problem, user) get their rule
blocks when those scopes are implemented — the class-wide block is deliberately deferred until
class-wide documents are added, rather than pre-added now.

```
match /classes/{classId}/offerings/{offeringId}/groups/{groupId}/canonical/{type} {
  allow read:   if isAuthed() && request.auth.token.class_hash == classId;
  allow create: if isAuthed() && request.auth.token.class_hash == classId
                 && request.resource.data.keys().hasAll(["documentKey", "createdAt", "createdBy"]);
  allow update, delete: if false;   // pointers are immutable
}
```

- The `class_hash == classId` read/create check restricts pointers to the requester's own class.
  Students carry a `class_hash` claim for their class, so it passes for them; **researchers and
  teachers** also carry a `class_hash` claim for the class they authenticated for (this is how
  `resourceInResearcherClass()` / `resourceInUserClass()` grant document access today), so they are
  covered for that class too.
- **Why class-scoped read is sufficient (not too strict).** The only client that reads a pointer is
  `getOrCreateScopedDocument`, which always runs for the current user's own group in their own class, so
  `class_hash == classId` always holds. Cross-class and networked-teacher readers (e.g. the sort-work
  view) never read the pointer — they read canonical-ness from the `canonical` flag on the metadata
  document via the normal `documents` query. And the update guard's `getAfter(pointer)` is a rule-internal
  read, unaffected by this rule. The one path `class_hash == classId` would *not* cover — a networked
  teacher reading another class's resources via `resourceInTeacherNetworks()` — does not need pointer
  access. If a future cross-network need to read pointers arises, widen this rule to mirror the documents
  read rule's network logic then.

### Deleting a non-canonical group document

To keep orphans out of the sort-work query (§10), the `documents` delete rule gains a clause letting
**any member of the class** delete a group document that is **not** the canonical one. Group-level
restriction is not possible — group membership lives only in RTDB, which Firestore rules cannot read —
so class-level is the finest grain available, which is accepted here.

Canonical-ness is carried by a **`canonical: true` flag on the metadata document** (see §5 — written
inside the pointer transaction, so it is always in sync with the pointer; absent means non-canonical).
The delete rule reads that flag directly rather than looking up the pointer:

```
match /documents/{docId} {
  // ...existing teacher/researcher-owner delete for non-group documents...
  allow delete: if isAuthed()
    && request.auth.token.class_hash == resource.data.context_id
    && resource.data.type == "group"
    && resource.data.canonical != true;   // never delete the canonical group document
}
```

For that flag to be safe to trust, the `documents` **update** rule guards it (this is where the
per-scope pointer path now lives):

```
function canonicalFieldOk() {
  let was = resource.data.get("canonical", false);
  let now = request.resource.data.get("canonical", false);
  // set true only if the pointer agrees in the SAME commit; never clear a set flag
  return was == now
    || (was == false && now == true
        && getAfter(/databases/$(database)/documents/authed/$(portal)
             /classes/$(request.resource.data.context_id)
             /offerings/$(request.resource.data.offeringId)
             /groups/$(request.resource.data.groupId)
             /canonical/$(request.resource.data.type)).data.documentKey == request.resource.data.key);
}
// allow update: if <existing document update permission> && canonicalFieldOk();
```

- **Why `getAfter`:** the winner sets the pointer and the flag in one transaction; `getAfter` sees the
  pointer as it will be after that commit, so the legitimate write passes while a standalone forge (no
  matching pointer) fails. Clearing an already-set flag is refused, so the canonical document can never
  be made deletable.
- **Create rule:** `isValidDocumentCreateRequest()` must also reject a metadata document that arrives
  with `canonical: true` already set, so the flag can only ever be established through the guarded update
  above (the document is created unflagged in §6, then flagged by the transaction).
- **Coupling tradeoff:** the per-scope pointer-path reconstruction now lives in `canonicalFieldOk()`
  (one guard) instead of the delete rule. It is still bounded — only scopes that permit *deletable
  additional* documents need a branch (group today; pure singletons keep `allow delete: false`). In
  exchange the delete rule is uniform and O(1), and the flag doubles as a directly queryable UI marker
  (e.g. the sort-work view can badge or filter canonical documents).
- These clauses are authed-mode only; the `demo`/`dev`/`qa`/`test` roots already permit writes broadly
  for authed users.
- **Non-authed roots** (`demo`/`dev`/`qa`/`test`): confirm the existing broad `allow read, write: if
  isAuthed()` recursive rules cover the new subcollection under those roots (they should, as pointers
  live under the same root). Add coverage if not.
- **`documents` create for group documents:** verify a student write passes
  `isValidDocumentCreateRequest()` (required keys + `classIsRequestContextId()`); the group's fake
  `uid` is fine because create does not check uid-ownership. Fix the rule if verification fails
  (expected to be a small change).
- **No network rule change.** The client writes `network: null` for these documents, matching current
  behavior; `isValidDocumentCreateRequest()` does not validate the network field.

## 8. Cloud function disposition

Keep `createFirestoreMetadataDocument_v2` deployed. It is still used by `post-document-comment` and
`post-exemplar-comment` (via `createFirestoreMetadataDocumentIfNecessaryWithoutValidation`) to lazily
create a metadata document when a teacher/researcher comments on a document that has none. Only the
`createDocument` call site stops using it. Teacher/researcher and teacher-network permission questions
remain contained to that function and are out of scope here.

## 9. Back-compat & migration

No data migration is required.

- Legacy group documents (random key, no pointer) keep resolving via the existing
  `(context_id, offeringId, groupId)` query in step 2, and get a pointer backfilled on next open.
- Existing metadata documents already written by the cloud function are unaffected.
- The Problem-document promise/listener mechanism is untouched.

## 10. Edge cases

- **Lost create race → orphan document.** Document-first ordering means the loser's document is
  unreferenced. The losing client cleans it up **fully**: the RTDB parts it wrote (content +
  `documentMetadata`) **and** the Firestore metadata document — the latter is now permitted by the
  non-canonical group-document delete rule (§7), since the orphan is a group document in the client's
  class that was never flagged `canonical: true` (the loser skips the flagging transaction). Full
  deletion is required because the sort-work system ingests every
  matching metadata document via a live query ([sorted-documents.ts](../../../src/models/stores/sorted-documents.ts));
  a lingering orphan metadata doc would appear as a duplicate group document in the sorts. (Only occurs
  on genuinely simultaneous first-creation.)
- **Winner crashes between document creation and pointer claim.** The document exists (with its
  `groupId`) but no pointer references it. This is **self-healing**: the next caller finds no pointer,
  falls through to the legacy query (§5 step 2), finds the crashed client's document, backfills a
  pointer to it, and adopts it as the canonical document — so it is not an orphan. (Only if *multiple*
  documents were created before any pointer was set does the legacy query pick one and leave the
  other(s) as non-canonical orphans, which any class member or a future sweep can then delete.)
- **No dangling pointer is possible.** A pointer is only written (in the transaction) after
  `createDocument` has completed, so a pointer never references a missing document — this is the reason
  for document-first ordering.
- **Legacy backfill contention.** Two clients finding the same legacy document both attempt to claim
  the pointer; the transaction makes one win and the other reads the same key. Both open the same
  legacy document.
- **Pointer present, metadata read denied/absent.** `openByDocumentKey` surfaces the error as today's
  open path does; no special handling beyond existing behavior.

## 11. Testing

- **Jest** (`src/lib/db` tests): `getOrCreateScopedDocument` —
  - single create writes one pointer + one document;
  - simulated concurrent create (two calls contending on the pointer transaction) yields one pointer,
    both callers resolve to the same document;
  - legacy fallback opens and backfills a pointer for a pre-existing random-key group document;
  - lost race leaves no second pointer and fully cleans up the orphan (RTDB content +
    `documentMetadata` + Firestore metadata document), so the sort-work query sees no duplicate;
  - the winner's metadata document ends up with `canonical: true`, set in the same transaction as the
    pointer; the loser's is left unflagged.
- **Firestore rules tests** (`firebase-test`): student in class may create and read a group pointer;
  pointer update and delete are denied; a user in a different class is denied create and read. For the
  `documents` rules: a class member may delete a group document whose metadata lacks `canonical: true`;
  deleting one with `canonical: true` is denied; a user outside the class is denied. For the update
  guard: setting `canonical: true` succeeds only when the pointer points to that document in the same
  commit and fails otherwise; clearing an existing `canonical: true` is denied.
- **Emulator smoke check** across appModes (authed/demo/dev/qa/test) that a student can create and read
  a group document client-side.

## 12. Future scopes (designed-for)

- **Class-wide documents:** `classes/<classHash>/canonical/<type>`; `<type>` distinguishes multiple
  kinds of class-wide document; scope spans offerings.
- **Problem-document singleton:** `classes/<classHash>/offerings/<offeringId>/users/<uid>/canonical/<type>`,
  replacing the required-document promise/listener guard with the same transaction-on-a-deterministic-ref
  primitive.
- **User-scoped (non-offering) documents:** path shape open (nested under `classes` vs. top-level
  `users`), to be decided when scheduled.

## 13. Resolved during review

- Subcollection name: **`canonical`**.
- Class-wide pointer rule block: **deferred** until class-wide documents are implemented.
- Orphan documents from a lost race: the losing client **fully deletes** them (RTDB parts + Firestore
  metadata), enabled by a new rule letting any class member delete a **non-canonical** group document
  (§7). This is required because the sort-work query would otherwise show the orphan as a duplicate
  group document (§10). Group-level delete restriction is not possible (membership is RTDB-only), so the
  rule is class-level, which is accepted. The winner-crash case is self-healing via the legacy-query
  fallback (§10) rather than producing an orphan.
- Canonical marking: **adopted the `canonical: true` flag** on the metadata document, written inside the
  pointer transaction so it is atomically in sync with the pointer (§5). It makes the delete rule uniform
  and O(1) (`canonical != true`) and doubles as a directly queryable UI marker (e.g. sort-work badging).
  The per-scope pointer-path check moves into the `documents` **update** guard (`getAfter` confirms the
  pointer agrees when the flag is set true; clearing a set flag is refused) — bounded coupling, group
  only today (§7).
- Client-side metadata creation scope: **all document types** in this story (not just the group path) —
  the pointer strictly requires only *awaited* creation, but moving all types client-side is an
  in-scope cleanup that unifies the create path (§6).
- `contextId: "ignored"`: **removed** (both the metadata write and the `document.metadata` getter), plus
  the stale db.ts "out of date" comment. Source stopped requiring it in 2022 (commit `9eae4c5c2`); a
  2026-07 log+Firestore correlation showed the only remaining `*_v1` comment traffic was a QA test account
  on an old build, and the `postDocumentComment_v1` / `validateCommentableDocument_v1` functions were
  **deleted from production 2026-07-13**. No deployed function reads the field, so removal carries no
  residual risk (§6).
