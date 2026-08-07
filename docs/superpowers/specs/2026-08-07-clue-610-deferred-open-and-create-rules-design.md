# CLUE-610 — Deferred open and create-time ownership rules — Design

Branch: `CLUE-610-deferred-open-and-create-rules`, stacked on `CLUE-610-class-wide-documents`
(PR [#2949](https://github.com/concord-consortium/collaborative-learning/pull/2949)).

## What this delivers

CLUE-610 has two halves. #2949 delivers the first — "Making it usable": the class-wide document appears in
Sort Work under "Whole Class", carries its authored title, is treated as collaborative, and every student in
the class can edit it. This branch delivers the second — "Before a real unit turns it on":

1. **Opening a unit does not get slower.** The class-wide document is still found-or-created at unit load, but
   no longer opened there.
2. **The create-time ownership hole is closed.** A document create may no longer stamp an arbitrary `uid`, and
   may no longer stamp `concurrent: true` on a document with a real-user owner.
3. **The ownership investigation the story asks for** is folded into 2, because its outcome is what fixes the
   rule's shape. Its residual is recorded rather than assumed away.
4. **The longer-term direction is recorded**, so a later reader does not read CLUE-610 as having finished the
   owner axis.

One branch, one PR. The four share a single gate — a real curriculum unit turning the feature on.

### One correction to the story's wording

The story describes item 2 as "a student can currently *mark any document* as class-shared". That is the
*update* path, and #2949 already closed it (`concurrentChangeOk` in `firestore.rules`). What remains, and what
this branch closes, is the create-side counterpart named in that function's TRANSITIONAL comment:
`isValidDocumentCreateRequest` constrains neither `concurrent` nor `uid`, so a class member can create a *new*
document already stamped `concurrent: true` under a classmate's `uid`. This is also the "create-time
restrictions" that the story breakdown moved out of CLUE-604 into CLUE-610 on the grounds that they are not
waiting on the migration.

## 1. Defer the open

### Today

`createDeclaredClassWideDocuments` ([src/lib/db.ts](../../../src/lib/db.ts)) runs once per unit load, after
`unitLoadedPromise` resolves, and calls `getOrCreateClassWideDocument` for each declared slot. That resolves
through `getOrCreateCanonicalDocument`, whose fast path is `pointerRef.get()` followed by
`openCanonicalDocumentByKey()` → `findFirestoreMetadata()` → `openDocument()`. So every load, for every
student, even when the document already exists, costs: two sequential Firestore reads, an RTDB content and
metadata fetch, a `DocumentModel` in `stores.documents`, and a history-manager subscription.

Measured in #2949 against `demo/units/qa` on a live Firestore project: **670ms and 730ms** between
`unitLoadedPromise` resolving and the document appearing in `stores.documents.all`.

### Change

Separate *converging on one document per slot* from *opening it*. `getOrCreateCanonicalDocument` splits into:

- a resolver that returns `{ documentKey, firestoreMetadata? }` — the pointer fast path returns the key alone;
  the legacy-group fallback and the create path also return the metadata they already hold;
- the existing behavior, layered on top: open from the metadata when present, otherwise
  `openCanonicalDocumentByKey(documentKey)`.

`getOrCreateGroupDocument` keeps the opening behavior — it is called from `document-workspace.tsx` at the
moment a user opens the document, so there is nothing to defer. Returning the metadata from the legacy and
create paths is what keeps a group document's open at exactly its current read count.

`createDeclaredClassWideDocuments` uses the resolver only. On the fast path that is a single
`pointerRef.get()` per declared slot and nothing else — no second read, no RTDB fetch, no history
subscription. The slow path (first student in the class) still creates the document, since creating it is the
point; it just does not open it afterwards.

### Why nothing else has to change

The on-demand open already exists and is reached by both routes into the document:

- **Sort Work** — `sorted-documents.fetchFullDocument` → `db.openDocumentFromFirestoreMetadata`, from metadata
  the Firestore listeners already hold. Sectioning and thumbnails read `firestoreMetadataDocs`, not
  `stores.documents`, so the "Whole Class" section appears whether or not the document has been opened.
- **A reload with the class-wide document as the primary document** — `guaranteeInitialDocuments` in
  `document-workspace.tsx` re-opens a `type: "group"` primary document through the same call.

`openDocument` dedupes by document key (`documentFetchPromiseMap`), so a later open is idempotent and two
routes racing resolve to one model.

### Alternatives rejected

- **Move the eager open to an idle callback.** Does the same work, only later; still one subscription per
  student per load.
- **Defer the get-or-create itself to first open.** Rejected by the design brief this inherits: the
  get-or-create is what converges the whole class onto one document per slot. Deferring it would let a class
  reach a slot for the first time through several simultaneous openers.

## 2 + 3. Create-time ownership, and the investigation

### The investigation, and what it constrains

The obvious fix — requiring `userIsRequestUser()` at create — cannot be applied, because concurrent documents
are deliberately not owned by a real person. The investigation is therefore: for each kind the client can
create, what `uid` does it stamp, and how much of that can the auth token corroborate?

Every client-side create of `authed/{portal}/documents/*` goes through one function,
`createFirestoreMetadataDocument`, which stamps `uid: owner` from
`getDocumentOwner(kind, ctx)`:

| Owner type | Kinds | `uid` stamped | What the rules can corroborate |
|---|---|---|---|
| `user` | problem, planning, personal, learning log, all publications and copies | `user.id` | Fully — `user.id` is `portalJWT.uid`, which is the `platform_user_id` claim |
| `class` | class-wide documents | `class_<classHash>` | Fully — `class_hash` is a token claim |
| `group` | group documents | `group_<offeringId>_<groupId>` | Partly — both segments are also stored as the document's own `offeringId`/`groupId`, so the uid can be required to agree with them; but no claim proves the caller is *in* that group |

The gap is the third row's second half, and it is not closeable from Firestore rules today: group membership
lives in the Realtime Database, which rules cannot read, and the auth token carries no group claim.

**Residual after this change:** a student can create a document owned by another group *in their own
offering*. They cannot create one owned by a classmate, by another group in another offering, or by another
class. Per the story's instruction — ship if the investigation comes back clean, split it out if it turns up
complications — this ships, with the residual recorded here, in the rules comment, and on the owner-axis row
of the roadmap. Closing it needs either a group claim in the portal-minted token or group membership mirrored
into Firestore; both are larger than this story and neither is scheduled.

### The rule

Extend `isValidDocumentCreateRequest` with an owner test — the `uid` must be one of the three corroborated
shapes above — and a `concurrent` test: `concurrent: true` is permitted only alongside a synthetic
(`class_`/`group_`) owner. A real-user-owned document can no longer be created class-shared, which is what
gave the whole class read and write on its history via `isConcurrentClassDocument`.

**Deliberately not done: a `keys().hasOnly(...)` allowlist on the create.** See the deployment section — an
allowlist has to enumerate every field shape the deployed app writes, and is the change most likely to break
document types this story never touches. Field-level tests on `uid` and `concurrent` are compatible by
construction.

### Alternative rejected

- **`userIsRequestUser()` unconditionally at create.** Breaks group and class-wide creation outright. This is
  the "obvious fix does not work" the story anticipates.

## Deployment order

The house pattern is to deploy rules first, then the code. That is safe here for every document type except
group and class-wide documents, which are not in use in any released unit.

Verified by inspection of `master` (7.4.0, what is deployed) and this branch:

- **One client create path.** `createFirestoreMetadataDocument` is the only client-side writer into
  `authed/{portal}/documents/*`, and on `master` it already stamps exactly the three uid shapes in the table
  above — including the synthetic group and class owners, which `master`'s `getDocumentOwner` already mints.
  `master` also stamps `concurrent` only on `type: "group"` documents, so no deployed create pairs
  `concurrent: true` with a real-user owner.
- **Server-side writers bypass rules.** `postDocumentComment_v2` creates metadata for a commented-on document
  through `createFirestoreMetadataDocumentIfNecessaryWithoutValidation` (admin SDK) — this is the one flow
  that legitimately writes another user's `uid`, and it never evaluates rules. `generateClassData_v2` is
  likewise server-side. The `createFirestoreMetadataDocument_v2` callable has no remaining caller in `src/`.
- **QA, demo, and dev are unaffected.** They write under the `demo/`, `dev/`, and `qa/` roots, which have
  their own rules; the authed create rule does not apply to them, so Cypress and QA sessions are untouched.

The strength of this is code inspection, not a replay of production traffic — which is why the emulator suite
below adds a create case per document type the deployed app writes, so the claim is held by a test.

**Accepted breakage in the rules-first window.** The rules deploy carries #2949's changes too, and those move
canonical pointers from `…/groups/<groupId>/slots/…` to `…/owners/<uid>/slots/…`. The deployed app claims the
old path, so group and class-wide document *creation* fails between the rules deploy and the code deploy.
Neither is in use in a released unit, and this is accepted deliberately rather than worked around.

## 4. Recording the direction

- `docs/document-axes/README.md` — the owner-axis row gains what the rules can and cannot corroborate about a
  document's owner, and names the group-membership residual as the reason the axis is still `in progress`.
- `firestore.rules` — the TRANSITIONAL comment above `concurrentChangeOk` currently describes the create-side
  work as still to do. Rewrite it to describe what is now enforced and what remains for CLUE-612 (making
  `concurrent` read-only after creation, once CLUE-604's migration has drained).

## Testing

- **Rules (emulator, `firebase-test/src/documents-rules.test.ts`):**
  - create with own `uid` — allowed; with a classmate's `uid` — denied.
  - create with `class_<class_hash>` matching the caller's claim — allowed; with another class's hash —
    denied.
  - create with `group_<offeringId>_<groupId>` agreeing with the document's own fields — allowed; with an
    `offeringId` or `groupId` that disagrees — denied.
  - create with `concurrent: true` and a real-user `uid` — denied; with a synthetic owner — allowed.
  - **Deployed-app compatibility:** one create per type the deployed client writes — problem, planning,
    personal, learning log, problem publication, personal/learning-log publication, and a copy — each in the
    field shape `createFirestoreMetadataDocument` produces, all still allowed. This is the test that holds the
    rules-first claim.
- **Unit (Jest):** the resolver returns the pointer's key on the fast path without opening (no
  `stores.documents` entry, no metadata fetch); `createDeclaredClassWideDocuments` opens nothing;
  `getOrCreateGroupDocument` still returns an opened model on all three paths (pointer, legacy, create) at its
  current read count.
- **Manual — run 2026-08-07, in Chrome against the live Firestore project, demo mode on `demo/units/qa`.**
  Note that `unit=qa` resolves to the *remote* curriculum repo, which has no class-wide slot; the local unit
  has to be named outright: `unit=http://localhost:<port>/demo/units/qa/content.json`.
  - **Not opened at unit load.** On the create path (first load) the document is written to Firestore —
    `uid: class_<classHash>`, `kind: drivingQuestionBoard`, `concurrent: true`, `canonical` claimed — and
    `stores.documents.all` stays empty. On the fast path (reload) it is still absent 8 seconds after
    `unitLoadedPromise` resolves.
  - **Sort Work.** "Whole Class" is the first section, one workspace, under all four filters (Problem,
    Investigation, Unit, All), thumbnail titled "Driving Question Board". Opening it loads an empty document
    (correct for a new one) and it appears in `stores.documents.all`; the Edit button is present.
  - **What actually triggers the open.** Entering Sort Work with the section collapsed does not open it;
    *expanding* the "Whole Class" section does, because rendering the thumbnails fetches the full document.
    That is on-demand and user-initiated, but it is a lower bar than "when someone opens it" — worth stating
    plainly rather than leaving the impression only an explicit open costs the fetch.
  - **Reload with it as the primary document, `groupDocumentsEnabled: false`** (the gate widened in this
    branch): restored, with the title in the workspace. Confirmed with the Problem tab active so Sort Work
    never rendered, ruling out Sort Work as the thing that re-opened it.
  - **Group documents unchanged:** File → Group Doc opens `group_<offeringId>_<groupId>`, titled
    "Group 1 Document".
  - **Deviation found, not caused by this branch.** In Sort Work's compact document list, a class-wide
    document's accessible name and tooltip read "undefined: Driving Question Board".
    `SimpleDocumentItem` builds them as `` `${userName}: ${title}` `` from
    `classStore.getUserById(uid)?.displayName`, which has no fallback — and no synthetic owner is a class
    member. It applies equally to a group document's `group_<offeringId>_<groupId>`, so it arrived with the
    Sort Work presentation rather than with the deferral. Recorded here rather than fixed.
- Full `npm test`, `npm run check:types`, `npm run lint:build`, and the `firebase-test` rules suite green.

## Boundaries and non-goals

- **Not closing the same-offering group residual.** It needs a token claim or mirrored membership; recorded,
  not built.
- **Not making `concurrent` read-only after creation.** That is CLUE-612, and it cannot ship until CLUE-604's
  migration has drained the on-open backfill that writes it.
- **Presence is still CLUE-611.** Untouched.
- **No authoring surface** for enabling or titling a class-wide document; still a hand edit to the unit
  configuration.

## References

- Story: [CLUE-610](https://concord-consortium.atlassian.net/browse/CLUE-610), whose description carries the
  acceptance criteria this implements and the release it belongs to.
- Preceding stage: [2026-07-27-clue-610-sort-work-ui-design.md](2026-07-27-clue-610-sort-work-ui-design.md) —
  "Carried forward from Stage 2" records the 700ms measurement this branch acts on.
- Roadmap: [../../document-axes/README.md](../../document-axes/README.md).
- Key code sites: `src/lib/db.ts` (`createDeclaredClassWideDocuments`, `getOrCreateCanonicalDocument`,
  `createFirestoreMetadataDocument`), `src/models/stores/sorted-documents.ts` (`fetchFullDocument`),
  `firestore.rules` (`isValidDocumentCreateRequest`, `concurrentChangeOk`),
  `firebase-test/src/documents-rules.test.ts`.
