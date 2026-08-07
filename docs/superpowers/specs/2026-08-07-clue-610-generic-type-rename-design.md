# Design: rename the generic document `type` from `"group"` to `"axes"`

> **Status:** design.
> **Story:** folds into CLUE-610 (7.5.0) — decided, but **not yet applied to the story**. Verified
> 2026-08-07 that CLUE-610 does not mention this work, and no other CLUE issue does either: the rename
> was considered early on and dropped before the story was written. The wording to add, and the
> corresponding CLUE-604 edits, are drafted under "Jira edits to make" in
> [2026-08-07-document-axes-next-migration-session-context.md](./2026-08-07-document-axes-next-migration-session-context.md).
> **Relates to:** CLUE-604 (the one-time backfill sweep, 7.6.0) and CLUE-612 (rules tightening, 7.7.0).
> **Scope:** one release's worth of app + rules changes, **plus the sweep-script changes** — the script
> is modified here and *run* by CLUE-604 (see "Division of labour with CLUE-604" in §7). No behavior
> changes.
> **Base:** branch `CLUE-610-generic-type-rename`, off the tip of `CLUE-610-deferred-open-and-create-rules`
> — not master. Every site and line number below was re-verified against that base on 2026-08-07.

## 1. Problem

`type: "group"` no longer means "this is a group document". Regular group documents and class-wide
collaborative documents both store it, and they are told apart only by guards over their stored axis
fields (`src/models/document/document-axes.ts`). What the value actually marks is *a document whose
behavior is read from its axes rather than from its type* — but it is still named for the first such
document. Two costs follow.

**It blocks the next kind.** Any new axis-native kind must put something in `type`. Claiming a fresh
`DocumentType` enum value reintroduces exactly the per-type branching this refactor exists to remove;
storing `"group"` says something false about a document that is not a group's. There is no third
option today, so the next kind is gated on this.

**It hides what each reader means.** There are ten places comparing against `GroupDocument`. Some
genuinely mean "a group's document", some mean "a concurrent document", and some mean "an axis-native
document". The shared literal makes them look identical, so the eventual rebasing of each onto its
real axis cannot even be triaged by grep.

The code already treats the value as transitional and says so in three places: the "Which documents get
stamped" section of [target-architecture.md](../../document-axes/target-architecture.md), the comment
at [db.ts:1114-1117](../../../src/lib/db.ts#L1114-L1117) ("Add a type here as it is converted to the
axes, and drop the check once they all are"), and
[db-types.ts:104-107](../../../src/lib/db-types.ts#L104-L107).

## 2. Why now: the cost is the sweep, not the code

The app change is small and mechanical. The expensive part is that `type` is a *stored* value on
existing documents, so changing it needs an admin sweep — and a sweep needs a full client drain ahead
of it. An un-drained client still comparing against `"group"` would, on a document the sweep had
rewritten to `"axes"`, stop treating it as concurrent, drop it out of Sort Work, and fail to resolve
its title.

CLUE-604 already schedules precisely that sweep, gated on 7.5.0 deploying and draining. Adding `type`
to it is one more field in a write that is already happening to these documents.

Deferring the rename until another document type is migrated risks paying for a *second* drain-and-sweep
cycle, and that cost is measured in releases rather than in effort — CLUE-612 exists as a separate
release solely to guarantee one such gap.

### This creates a deadline: the app change must ship in 7.5.0

```
7.5.0 ships ────drain────▶  sweep runs  ────▶  7.6.0 deletes transitional code
    ▲                           │
    │                           ├── axes fields   (CLUE-604, already planned)
    │                           └── type: "axes"  (this design)
    │
    └── must already accept BOTH "group" and "axes"
```

Landing the app change in 7.6.0 instead does not work. The sweep would then have to wait for 7.6.0 to
drain, but 7.6.0's own content is deleting the transitional code that the sweep unblocks — so 7.6.0
would have to be split, or the sweep run twice. Either outcome is the one this design exists to avoid.

Re-checked 2026-08-07: v7.4.0 is still the newest tag and 7.5.0 is still open, so the window exists. **If
7.5.0 has already been cut when this is picked up, re-plan rather than proceeding** — the rename then
needs its own release ahead of the sweep, which pushes CLUE-604.

## 3. Goal and non-goals

**Goal.** `"axes"` becomes the stored `type` of every document whose meaning is read from its axes.
After the sweep, no Firestore document stores `type: "group"`. No behavior changes anywhere.

**Non-goals, deliberately:**

- **Rebasing any reader onto an axis.** Each of the ten reader sites keeps its current logic and simply
  widens what it compares against. Deciding which of them means "concurrent", which means "group-owned",
  and which means "axis-native" is per-site work that belongs with the axis that answers it. Doing it
  here would turn a mechanical change into ten judgment calls inside a release that has a deadline.
- **Sweeping the RTDB `type`.** See §6.
- **Removing `type` altogether.** It is still required by `DocumentModel`, by `isDocumentMetadata`, and
  by the sweep script's own query. Removing it is a much later step.
- **Removing the accept-both readers.** That cleanup is a follow-up with no drain requirement (§7).

## 4. The value and its constant

The stored value is `"axes"`. It reads as a pointer to where the document's meaning lives, matches the
vocabulary already established in `docs/document-axes/`, and satisfies the same camelCase identifier
shape as every other type value.

It is exported from [document-types.ts](../../../src/models/document/document-types.ts) as
`AxesDocument`, alongside the existing `GroupDocument`, `PersonalDocument`, and so on, and added to
`DocumentTypeEnumValues` so `DocumentTypeEnum` accepts it.

**Resolved 2026-08-07: `AxesDocument`.** It follows the existing `<Thing>Document` naming used by every
sibling constant in the file, at the cost of naming the mechanism rather than a kind of document.
`AxesDocumentType` and `GenericDocument` were the alternatives considered. This is a code-level name
only; the stored value is `"axes"` regardless.

## 5. What changes

### 5a. Writers — start storing `"axes"`

| Site | Note |
|---|---|
| [db.ts:797](../../../src/lib/db.ts#L797) | `getOrCreateGroupDocument`. `type` becomes `AxesDocument`; `kind` stays `GroupDocument` — they coincide today only by accident, and this is where they stop. |
| [db.ts:820](../../../src/lib/db.ts#L820) | `getOrCreateClassWideDocument`. `kind` is the unit-declared kind. |
| [db.ts:727](../../../src/lib/db.ts#L727) | Selects the bare RTDB metadata shape. Writes the new value to RTDB too. |
| [db-types.ts:108-110](../../../src/lib/db-types.ts#L108-L110) | `DBGroupDocMetadata.type` literal becomes `"axes"`. Worth renaming the interface to match what it holds. |
| [db-types.ts:32-37](../../../src/lib/db-types.ts#L32-L37) | `DBDocumentType`, the union `db.ts`'s RTDB write path is typed against ([db.ts:690](../../../src/lib/db.ts#L690)). Gains `"axes"`; keeps `"group"` for the documents already in RTDB. |
| [db-types.ts:139-141](../../../src/lib/db-types.ts#L139-L141) | `DBGroupDocument.type`, the RTDB *content* shape, alongside the metadata one above. |

The three `db-types.ts` sites are the RTDB shapes, and they are type declarations rather than readers — the
compiler rejects writing `"axes"` until the union widens. Widening them is not the same as sweeping RTDB
(§6): existing RTDB records keep `"group"` and nothing reads the field.

### 5b. Readers — accept both values

Each of these keeps its logic exactly as-is and widens its comparison. The "means" column is recorded
so a later pass can rebase each onto the right axis; it is **not** acted on here.

**They widen through one shared predicate**, `isAxesType(type)`, exported from `document-types.ts`
alongside the existing `isProblemType` / `isPersonalType` family:

```ts
// TRANSITIONAL: accepts the pre-sweep value too. After CLUE-604's sweep, drop GroupDocument here.
export function isAxesType(type: string) {
  return type === AxesDocument || type === GroupDocument;
}
```

The alternative — eleven inline two-value comparisons — makes step 4's cleanup eleven separate edits
where a missed one is silent, whereas the predicate collapses it to editing one function. It costs the
later per-site rebase nothing: each site still holds its own call, so replacing one with a real axis
query is the same edit either way.

| Site | Means |
|---|---|
| [db.ts:640](../../../src/lib/db.ts#L640) | the stamp gate — "axis-native" |
| [db.ts:936](../../../src/lib/db.ts#L936) | `CREATE_GROUP_DOCUMENT` log event — already fires for class-wide documents |
| [db.ts:1125](../../../src/lib/db.ts#L1125) | the on-open `concurrent` backfill — "axis-native" |
| [document.ts:124](../../../src/models/document/document.ts#L124) | the `isGroup` getter |
| [document-utils.ts:133](../../../src/models/document/document-utils.ts#L133) | read access — a `permissions` question |
| [document-kinds.ts:241](../../../src/models/document/document-kinds.ts#L241) | transitional title; see §6 for why this one is load-bearing |
| [document-types.ts:48-56](../../../src/models/document/document-types.ts#L48-L56) | `isSortableType` — Sort Work membership |
| [document-title.tsx:28](../../../src/components/document/document-title.tsx#L28) | suppress the owner-name prefix |
| [tile-activity-badges.tsx:64](../../../src/components/tiles/tile-activity-badges.tsx#L64) | presence indicators — "concurrent" (CLUE-611's territory) |
| [document-workspace.tsx:209](../../../src/components/document/document-workspace.tsx#L209) | primary-document handling |

Both `document-title.tsx` and `tile-activity-badges.tsx` already apply to class-wide documents today,
since those also store `"group"`. Accepting both values preserves that exactly; accepting only `"axes"`
would too, but would break un-drained clients, which is the whole reason for the transitional window.

### 5c. Firestore rules — accept both values

- [firestore.rules:125](../../../firestore.rules#L125), inside `concurrentChangeOk`. This function is
  deleted by CLUE-612 regardless; it needs to accept both only for the transitional window.
- [firestore.rules:503](../../../firestore.rules#L503), the clause letting class members delete the
  non-winning documents from a canonical-pointer creation race.

**Those are the only two.** The create path constrains only that `type` is *present*
([firestore.rules:232](../../../firestore.rules#L232)), never its value: the create-time ownership rules
key on the owner instead — `documentOwnerOk` and `concurrentCreateOk` — and
[firestore.rules:222-223](../../../firestore.rules#L222-L223) states the reason outright ("`type` is
deliberately not tested here: the transitional `type: "group"` is on its way out, while the owner is the
durable fact"). So creating documents with `"axes"` needs no rules change.

`type` remains in `preservesReadOnlyDocumentFields`'s `readOnlyFieldsSet` — which is what makes the sweep
the only mechanism that can perform the rename, and is a property worth keeping rather than working
around.

**The rules deploy independently of the app bundle**, so this is a separate deploy to sequence — before
the sweep, and it may as well be with the 7.5.0 app release.

### 5d. Comments that name the value

A dozen comments explain the current arrangement by quoting `type: "group"`, and each becomes wrong the
moment a document can store either value. They are load-bearing documentation — several are the only
written record of why a transitional rule exists — so they are updated with the code, not left to rot:
[db.ts:122](../../../src/lib/db.ts#L122), [db.ts:635](../../../src/lib/db.ts#L635),
[db.ts:728](../../../src/lib/db.ts#L728), [db.ts:793](../../../src/lib/db.ts#L793),
[db.ts:816](../../../src/lib/db.ts#L816), [db.ts:1119-1124](../../../src/lib/db.ts#L1119-L1124),
[db-types.ts:104-107](../../../src/lib/db-types.ts#L104-L107),
[db-types.ts:135-138](../../../src/lib/db-types.ts#L135-L138),
[document-kinds.ts:231-240](../../../src/models/document/document-kinds.ts#L231-L240),
[firestore.rules:100-121](../../../firestore.rules#L100-L121),
[firestore.rules:222-223](../../../firestore.rules#L222-L223), and the header of
[backfill-group-document-axes.ts](../../../scripts/backfill-group-document-axes.ts).

## 6. The sweep script, and why it needs restructuring

[`scripts/backfill-group-document-axes.ts`](../../../scripts/backfill-group-document-axes.ts) gains
`type: "axes"`. Its driving query stays `where("type", "==", "group")` — it has to, because that is what
the documents being migrated still store.

The complication is that the script currently builds two *disjoint* write lists and commits them as
independent batch operations:

```
needingConcurrent -> { concurrent: true, kind: "group" }
needingScope      -> { investigation: null, problem: null }
```

The `type` rewrite is not disjoint from either — it applies to every document the query returns. Adding
it as a third list would mean two batch operations against the same document reference.

That is a correctness problem, not just an inelegance. `getDocumentTitle`
([document-kinds.ts:241](../../../src/models/document/document-kinds.ts#L241)) selects the
group-document title on `type === "group"` **and** a `groupId`, because a group document may carry no
`kind` yet. A document that received `type: "axes"` but not yet `kind: "group"` matches neither that
branch nor the registry lookup above it, and renders with no title at all.

**So the script changes from two write lists to one merged write per document:** accumulate each
document's fields into a per-reference map, then commit one `set(..., { merge: true })` per document.
`type` and `kind` then land atomically, and the intermediate state cannot exist. The two existing
passes keep their current selectors — they still decide *which* fields a given document needs — and only
the commit stage changes.

The script's existing properties are preserved: additive, idempotent, batched at 400, dry-run by
default, and unit-testable against a mock Firestore.

**The RTDB `type` is not swept.** For these documents only `createdAt` is ever read back from the RTDB
metadata, and the entire RTDB metadata tree is slated for removal
([firestore-sourcing-roadmap.md](../../document-metadata/firestore-sourcing-roadmap.md)). Sweeping it
would be work spent on data scheduled for deletion. The consequence is that RTDB will hold `"group"` for
documents created before this change and `"axes"` for those created after. That is accepted, and it is
safe precisely because nothing reads it.

## 7. Sequencing

1. **7.5.0** — app accepts both values everywhere and writes `"axes"` on creation. Rules deploy
   accepting both.
2. **Drain** — the same drain CLUE-604's sweep already requires. No additional wait.
3. **Sweep** — run the restructured script, which now also rewrites `type`.
4. **Cleanup, whenever** — drop the accept-both branches and the `GroupDocument` type constant. After
   the sweep no document stores `"group"`, so these are inert; removing them needs no drain and no
   coordination.

Only step 1 is deadline-bound.

### Division of labour with CLUE-604

**The script *changes* belong to this story; *running* it stays CLUE-604's.** CLUE-604 does not own the
script today — its step 2 is "run it", and the script itself was written under the earlier CLUE-550
stages. The changes in §6 land here, in 7.5.0, for two reasons:

- **The script has to be runnable before 7.6.0 ships.** CLUE-604's own step order puts the run (step 2)
  ahead of its code removals (3–5) and its release (step 6). If the script's changes lived in the 7.6.0
  story they would not be on master when the run is due, so the run would have to come off an unmerged
  branch or cherry-pick one change early.
- **The accept-both change and the script's `type` write are a matched pair.** Split across stories,
  7.5.0's half could ship and the other never happen — leaving new documents `"axes"` and old ones
  `"group"`, which is exactly the second-sweep outcome this design exists to prevent.

**Shipping the script is not running it.** From 7.5.0 onward the updated script sits on master while old
clients are still draining, and running it then would migrate a set that is still growing behind it. It
is dry-run by default and CLUE-604's step 1 is the gate, but the separation is worth stating rather than
assuming.

**What stays in CLUE-604:** the drain gate, running the script against each environment, removing the
on-open axes backfill, removing `findLegacy` together with the pre-pointer investigation, simplifying
`getDocumentTitle`, and shipping the release that unblocks CLUE-612. Its conditional pointer-backfill
pass (the caveat under its step 4) also stays — that belongs to `findLegacy` removal, not to the rename.

**Two of this story's accept-both readers are deleted by CLUE-604, not here.** Its step 3 removes the
on-open `concurrent` backfill ([db.ts:1118](../../../src/lib/db.ts#L1118)); its step 5 rewrites
`getDocumentTitle` to key on `kind` ([document-kinds.ts:241](../../../src/models/document/document-kinds.ts#L241)).
Both accept-both branches therefore live for exactly one release. That is correct rather than wasted —
without them, a document the sweep had rewritten would lose its title between the sweep and 7.6.0 — but
the two stories should not both claim these sites.

**CLUE-604's step 2 text needs updating.** It currently spells out exactly what the script writes ("Two
passes: group-scoped documents missing `concurrent` get `{ concurrent: true, kind: "group" }`;
class-wide documents missing curriculum scope get `{ investigation: null, problem: null }`"). Once the
script also writes `type: "axes"` and commits one merged write per document (§6), that description is
wrong.

## 8. Testing

- **Unit tests** covering the readers already exist and reference `GroupDocument` (`document.test.ts`,
  `document-utils.test.ts`, `document-kinds.test.ts`, `sorted-documents.test.ts`,
  `tile-activity-badges.test.tsx`, `thumbnail-document-item.test.tsx`, `document-file-menu.test.tsx`,
  `db.test.ts`, `firebase.test.ts`). Each accept-both reader needs a case for *both* values, since the
  transitional window is the only time both occur and it is exactly when a regression would ship.
- **`scripts/backfill-group-document-axes.test.ts`** needs cases for the merged-write restructure: a
  document needing `concurrent` **and** `type` receives one write containing both; a document needing
  only `type` receives one write; re-running changes nothing.
- **`firebase-test/src/documents-rules.test.ts`** and `canonical-pointers-rules.test.ts` cover the two
  rules sites; both values need a case. `documents-rules.test.ts` also carries the create-shape suite that
  holds the rules against every document shape the deployed client writes — fourteen fixtures spelling
  `type: "group"`. Those fixtures assert what the *client* sends, so once the client sends `"axes"` they
  should say `"axes"`, with the `"group"` shapes kept only where the case is specifically about a document
  the sweep has not reached yet.

## 9. Risks

- **7.5.0 may already be cut.** This is the one risk that invalidates the plan rather than complicating
  it. Confirm before starting; see §2.
- **A missed reader.** A reader left comparing only against `"group"` silently stops matching after the
  sweep. The sites in §5 were enumerated by grepping for `GroupDocument`, which catches every reader that
  uses the constant; the residual risk is a bare `"group"` string literal somewhere. **That literal sweep
  has been run** across `src`, `shared`, `functions-v2`, `scripts`, and `firestore.rules` (2026-08-07,
  against this design's base): every remaining hit is either a document-type declaration already listed in
  §5a, prose already listed in §5d, or an unrelated use of the word — a CSS class name
  (`group-virtual-document.tsx:54`), a drawing-object type, a sticky-note audience, a Sort Work section
  key, or the `DocumentOwnerType` `"group"`, which is the *owner* axis and stays. Re-run it at
  implementation time rather than trusting this list, and leave the `GroupDocument` constant in place
  until step 4 so the compiler keeps pointing at anything still using it.
- **The `kind` / `type` coincidence for group documents.** A group document's `kind` is `"group"` and,
  today, so is its `type`. They separate here. Anything that happens to rely on their being equal would
  break, and nothing found so far does — but it is the kind of coupling that hides in tests.

## 10. References

- [docs/document-axes/README.md](../../document-axes/README.md) — the roadmap and status table
- [docs/document-axes/target-architecture.md](../../document-axes/target-architecture.md) — "Which
  documents get stamped", the gate this rename widens
- [docs/document-axes/reading-axes-in-code.md](../../document-axes/reading-axes-in-code.md) — the
  guards that already tell group from class-wide documents
- [docs/document-metadata/firestore-sourcing-roadmap.md](../../document-metadata/firestore-sourcing-roadmap.md)
  — why the RTDB `type` is not worth sweeping
