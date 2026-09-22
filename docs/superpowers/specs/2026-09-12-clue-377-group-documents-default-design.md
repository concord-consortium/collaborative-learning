# CLUE-377: Group documents auto-created and available as the default workspace

## Goal

Let a unit make the per-group shared document the students' default work mode (e.g. Vibe):

- A group document is **auto-created whenever a group forms** (today creation is strictly lazy — only
  the File ▸ Group Doc menu click creates one).
- Because it exists, it is **immediately visible in Sort Work** — thumbnails/entries appear before
  anyone has edited it.
- A unit setting makes the group document the **default workspace document** students land in, applied
  on first visit to a problem and re-applied when the student switches groups. Teachers (who are never
  in groups) keep the problem document.
- Units that declare only a **class-wide document** (`classWideDocuments`, e.g. a Driving Question
  Board) and no groups keep today's behavior unchanged: problem documents are the default and the
  class-wide document is immediately visible and editable via Sort Work (built by CLUE-610; verified by
  the `qa-class-wide` demo unit).

## Context / what already exists

- **GroupDocument kind + concurrency**: `registerDocumentKind(GroupDocument, { profile: kGroupProfile })`
  (`src/models/document/document-kinds.ts:309`); `kGroupProfile` = ownerType `"group"`, containerType
  `"offering"`, `concurrent: true` (`src/models/document/document-axis-profiles.ts:78-83`). Owner uid is
  the synthetic `group_<offeringId>_<groupId>` (`src/models/document/document-axes.ts:35-37`,
  `src/models/stores/user.ts:193-196`). Any class member can read; group members can edit
  (`src/models/document/document-utils.ts:148-176, 212-245`). Concurrent multi-writer history merging
  exists (`firestore-history-manager-concurrent.ts`).
- **Canonical-pointer convergence with race handling**: `resolveCanonicalDocument` (`src/lib/db.ts:925-989`)
  — pointer fast path, legacy backfill, create-then-claim transaction with orphan cleanup. The
  **resolve-without-open** primitive (`db.ts:914-923`) is what class-wide auto-creation uses
  (`resolveClassWideDocument`, `db.ts:862-873`).
- **Eager auto-create precedent**: `createDeclaredClassWideDocuments` (`db.ts:880-899`), invoked once per
  unit load at `db.ts:230`.
- **Lazy group-doc creation today**: `getOrCreateGroupDocument` (`db.ts:833-847`) has exactly one caller —
  the File ▸ Group Doc menu (`document-file-menu.tsx:86-96` → `document-workspace.tsx:342-355`). Nothing
  creates a group doc at login, group join, or from a listener; `db.joinGroup` and `DBGroupsListener`
  do no document work.
- **`groupDocumentsEnabled` gates only two things** (`unit-configuration.ts:145`): the File ▸ Group Doc
  menu item (`document-file-menu.tsx:71-72`) and reopening a persisted group/class-wide primary on reload
  (`document-workspace.tsx:200-216`). It gates nothing in `db.ts` or Sort Work.
- **Default workspace document on login**: `guaranteeInitialDocuments` (`document-workspace.tsx:198-221`)
  → if no persisted `problemWorkspace.primaryDocumentKey`, `loadDefaultPrimaryDocument` →
  `db.guaranteeOpenDefaultDocument(type, …)` (`db.ts:511-542`). The type comes from
  **`defaultDocumentType`** (`"problem" | "personal"`, `unit-configuration.ts:60`), whose only consumer is
  `getDefaultDocumentContentSpec` (`document-workspace.tsx:165-171`). `guaranteeOpenDefaultDocument` is
  hard-typed to Problem/Personal and rides the required-documents promise machinery, which group docs do
  not participate in.
- **Group-switch guard**: a reaction (`document-workspace.tsx:54-70`) kicks the workspace back to the
  default document when the primary is a group doc belonging to a different group.
- **Sort Work lists straight from Firestore metadata with no empty-doc filter**
  (`sorted-documents.ts:85-89, 117-224`): a document appears as soon as its metadata document exists.
  Group docs section under "Group N" (by Group) and under every member (by Name)
  (`document-group.ts:199-289`). Sorted views render label-only `SimpleDocumentItem` buttons; only the
  unsorted Problem view renders live canvas thumbnails (`sorted-section.tsx:91-110`,
  `thumbnail-document-item.tsx:138-150`). An unedited doc renders as a blank canvas (content is `{}`,
  not undefined — `db.ts:1213`).
- **Teachers are never in groups** (`app.tsx:222-224`; the portal mints `offering_id` only for learners),
  so `requireGroupContext()` (`db.ts:716-722`) throws for them and the Group Doc menu is hidden.
- **Known bug to respect**: `docs/group-docs/group-docs-current-state.md:44-48` records an uninvestigated
  incident of two users in one group landing on separate group documents. Eager creation increases
  concurrent first-creates, so convergence must be tested deliberately.

## Revised in review (2026-09-17)

Three decisions below changed during Scott's review of PR #2998:

- **`groupDocumentsEnabled` is no longer implied by `defaultDocumentType: "group"`.** A unit states both,
  so anything parsing the unit JSON (researcher reports) reads the same answer the app does; the authoring
  form already writes both. A unit asking for a group start without the flag falls back, with a warning.
- **Re-pointing on a group switch is unconditional.** A student looking at a group document when their
  group changes gets the new group's document in any unit — that is not a question the start setting
  answers. The setting still governs only what opens on a first visit.
- **Group and class-wide documents share one title-bar style**, keyed on the `concurrent` axis rather than
  on document `type` or `kind`. Distinguishing them later is an owner question (`hasGroupOwner` /
  `hasClassOwner`), per `docs/document-axes/`.

## Decisions (confirmed with product)

- **Setting shape**: extend `defaultDocumentType` to `"problem" | "personal" | "group"` — no new setting,
  no migration. Authoring presents it as "Start students in: Problem doc / Personal doc / Group doc".
- **`"group"` implies `groupDocumentsEnabled`**: the config getter treats group docs as enabled when the
  default is `"group"`, so the contradictory state is unreachable from the authoring UI. An explicit
  `groupDocumentsEnabled: false` in hand-authored JSON **wins**: the default falls back to `"problem"`
  with a console warning (same warn-and-fall-back pattern as CLUE-639's invalid `fixedStartTab`).
- **Autocreate scope**: per-group documents are auto-created **whenever `groupDocumentsEnabled`** (or the
  implied form), not only when the default is `"group"`. This alone delivers "visible in sorts before
  edited". Known behavior change: existing `groupDocumentsEnabled` units go from lazy to eager creation.
- **When the group doc takes over the workspace**: on **first visit** to a problem (no persisted primary)
  and on **group change** (re-point to the new group's doc). Otherwise the last-opened document is
  restored as usual.
- **Audience**: students only. Teachers keep the problem document even when the default is `"group"`;
  they reach group and class-wide docs via Sort Work as today.
- **Unedited thumbnails**: the blank canvas (with "Group N Document" title and concurrent badge) is
  acceptable; no placeholder treatment, no thumbnails added to the sorted views.
- **`autoAssignStudentsToIndividualGroups: true` trumps both group settings** (extends the documented
  rule): no autocreate, and a `"group"` default falls back to `"problem"` with a warning. It never
  affects `classWideDocuments`.
- **Background problem-doc guarantee**: even when the group doc is the workspace default, each student's
  own ProblemDocument is still guaranteed (created if missing, not opened) — 4-up
  (`four-up.tsx:74-79`) and publishing depend on it existing.
- **Class-wide docs are orthogonal and must not regress** (see matrix below).

### Settings interaction matrix

| Config | Workspace default | Group docs auto-created? | Sort Work |
|---|---|---|---|
| *(neither group setting)* | problem/personal per `defaultDocumentType` | no | as today |
| `groupDocumentsEnabled: true` | problem/personal per `defaultDocumentType` | **yes (new)** | every group's doc visible unedited |
| `defaultDocumentType: "group"` | **group doc** (students); problem (teachers) | yes (enable implied) | same |
| explicit `groupDocumentsEnabled: false` + `default: "group"` | problem (warn: misconfiguration) | no | as today |
| `autoAssignStudentsToIndividualGroups: true` + any group setting | problem/personal (warn if default was `"group"`) | no | as today |
| `classWideDocuments` declared (any row above) | unchanged by this column | unchanged | class-wide doc immediately visible + editable — **existing CLUE-610 behavior, untouched** |

## Design

### 1. Config layer

In `unit-configuration.ts`:
- Widen `defaultDocumentType?: "problem" | "personal" | "group"`.

In `configuration-manager.ts` / `app-config-model.ts`, expose two derived getters so every consumer
shares one rule (names final at implementation):
- `groupDocumentsEnabled` (existing getter, new logic): `false` if `autoAssignStudentsToIndividualGroups`;
  else explicit value if set; else `true` when `defaultDocumentType === "group"`; else `false`.
- `effectiveDefaultDocumentType`: `defaultDocumentType`, except `"group"` degrades to `"problem"`
  (with one console warning) when group docs are not enabled per the above, and for non-student users at
  the point of use. Existing raw getters stay for the authoring round-trip.

`docs/unit-configuration.md`: update the `defaultDocumentType` and `groupDocumentsEnabled` entries with
the matrix; note the lazy→eager change.

### 2. Eager per-group autocreation

- New `db.resolveGroupDocument()` — resolver-only twin of `getOrCreateGroupDocument`, mirroring
  `resolveClassWideDocument` (`db.ts:862-873`): converge on the canonical group document (create metadata
  + claim pointer if absent) **without opening it**. All race handling comes from
  `resolveCanonicalDocument` unchanged.
- Trigger: a **MobX reaction on `user.currentGroupId`** registered in `db.ts` alongside the class-wide
  call (`db.ts:230`) and disposed on disconnect. Fires when the id becomes defined or changes; gated on
  `groupDocumentsEnabled` (derived getter) and `user.isStudent`. A reaction rather than a one-shot call
  because `db.ts:230` runs before `DBGroupsListener` sets `currentGroupId`
  (`db-groups-listener.ts:32`), and it handles group switching for free. `DBGroupsListener` itself stays
  document-free.
- Every member's client attempts the resolve; the pointer create-then-claim transaction converges them.
  Losers delete their orphan (existing behavior). `CREATE_GROUP_DOCUMENT` logs only on the winning
  create (existing behavior).
- Hardening for the known duplicate-doc incident: unit tests drive two simulated racers through
  `resolveGroupDocument` and assert single-pointer convergence + orphan cleanup; add a `console.warn`
  (or log event) if a resolve ever observes a pointer key different from a document it just created,
  so field recurrences of the group-docs-current-state bug become diagnosable.

### 3. Workspace default + group switch

In `guaranteeInitialDocuments` (`document-workspace.tsx:198-221`):
- When there is **no persisted primary** and `effectiveDefaultDocumentType === "group"` and the user is a
  student: wait for `user.currentGroupId` (a `when()`/reaction — it is usually not yet set at
  `componentDidMount`), then `db.getOrCreateGroupDocument()` → `problemWorkspace.setPrimaryDocument`.
  Non-students and no-group fallbacks take the existing `loadDefaultPrimaryDocument()` path with type
  `"problem"`.
- **Still guarantee the student's own ProblemDocument in the background** (create if missing via the
  existing guarantee machinery, without `setPrimaryDocument`), so 4-up and publishing keep working.
- The **group-switch reaction** (`document-workspace.tsx:54-70`) currently re-points to the default
  (problem) document when the primary belongs to another group. When the effective default is `"group"`,
  it instead re-points to the **new group's** document via `getOrCreateGroupDocument()` — implementing
  "switching groups shows a different doc regardless of prior contributions".
- No interaction with CLUE-639's `fixedStartView` beyond coexistence: that feature governs the starting
  tab/divider; this one governs which document is the workspace primary. The reopen-persisted-primary
  branch (`document-workspace.tsx:205-216`) is unchanged and already handles group docs.

### 4. Sort Work visibility

No sort-pipeline changes. Autocreation makes each group's metadata document exist, and the pipeline
already lists it (no empty filter), sections it correctly, and thumbnails it (blank canvas) in the
unsorted Problem view. The class-wide path shares `resolveCanonicalDocument` and its listener setup —
the new reaction and getters must not gate, reorder, or delay `createDeclaredClassWideDocuments`.

## Edge cases

- **Student not yet in a group** (group-choice dialog pending): the reaction/`when()` simply hasn't fired;
  the workspace waits on the same promise chain it does today. If a unit somehow reaches the workspace
  with no group and default `"group"`, fall back to the problem document.
- **Group deleted / student removed**: `currentGroupId` change triggers the same re-point logic.
- **Demo/standalone/preview modes**: gate the reaction on the same conditions the class-wide autocreate
  uses today (it already runs in all modes; keep parity).
- **Teacher previewing as teacher**: never enters the group branch; sees problem doc; group docs visible
  in Sort Work sections.
- **Legacy pre-pointer group docs**: the resolver's legacy backfill (`db.ts:945-961`) already adopts them
  instead of duplicating.

## Testing

- **Config**: getter matrix tests — widened union; implied enable; explicit-false-wins fallback + warning;
  autoAssign trumps; `classWideDocuments` unaffected by every combination.
- **`resolveGroupDocument`**: converges two racing creators to one pointer (mock Firestore transaction, as
  existing db tests do); resolver does not open the document; respects `groupDocumentsEnabled` gate;
  no-ops without a group.
- **Workspace branch**: first-visit-with-group-default opens the group doc as primary; teacher gets
  problem doc; background ProblemDocument still gets created; group-switch re-points to the new group's
  doc when default is `"group"` and to the problem doc otherwise (existing behavior preserved).
- **Non-regression**: class-wide autocreate + sort visibility with groups disabled (the `qa-class-wide`
  configuration) — assert `createDeclaredClassWideDocuments` still runs unconditionally.
- **QA units**: set `defaultDocumentType: "group"` on the `qa` unit (already has `groupDocumentsEnabled`
  + a Driving Question Board), or add a `qa-group-default` sibling mirroring `qa-class-wide`'s isolation
  pattern. Manual pass: fresh class, two students in one group land in the same doc; each group's doc and
  the DQB visible in Sort Work before any edits; teacher lands in problem doc; student switches groups
  and lands in the new group's doc.
- **Cypress**: extend the group/sort-work specs minimally (a group-default unit smoke) — scoped during
  planning.

## Critical files

- `src/models/stores/unit-configuration.ts` — widen `defaultDocumentType`.
- `src/models/stores/configuration-manager.ts`, `src/models/stores/app-config-model.ts` — derived getters.
- `src/lib/db.ts` — `resolveGroupDocument`, the `currentGroupId` reaction (registered near `db.ts:230`,
  disposed on disconnect).
- `src/components/document/document-workspace.tsx` — the default-primary branch
  (`guaranteeInitialDocuments`), background problem-doc guarantee, group-switch re-point.
- `src/authoring/…` (document settings form) + `src/authoring/types.ts` — three-way start choice that
  locks the enable toggle when "Group doc" is chosen.
- `docs/unit-configuration.md` — both settings + matrix.
- `src/public/demo/units/qa/…` or new `qa-group-default` — QA configuration.
- Reference (do not reinvent): `resolveClassWideDocument`/`createDeclaredClassWideDocuments`
  (`db.ts:862-899`), `resolveCanonicalDocument` (`db.ts:925-989`), `getOrCreateGroupDocument`
  (`db.ts:833-847`), the group-switch reaction (`document-workspace.tsx:54-70`),
  `guaranteeOpenDefaultDocument` (`db.ts:511-542`).
