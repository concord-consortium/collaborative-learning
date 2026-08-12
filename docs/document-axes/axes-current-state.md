# Reading and enforcing the axes in code, today

> **Purpose:** what a consumer can actually read off a document right now, how it gets stamped, and what
> the security rules hold it to. [axes.md](./axes.md) defines the axes in terms of behavior and
> deliberately avoids naming code; [target-architecture.md](./target-architecture.md) describes where the
> code is heading. This doc is the current state in between — the helpers that exist, the stored fields
> behind them, the enforcement around them, and what is not covered yet.

## The guards

Consumers that need a document's position on an axis read its stored fields through the guards in
`src/models/document/document-axes.ts`, rather than branching on the document `type`:

- `hasGroupOwner(doc)` — an **owner** question: the document belongs to a single group.
- `hasClassOwner(doc)` — an **owner** question: the document belongs to the class as a whole, with no
  personal author.
- `isInClassUnitContainer(doc)` — a **container** question: the document is kept in the class's copy of
  one unit, rather than in a single offering of one problem.

Each guard answers about one axis and reads only that axis's fields. A consumer needing a position on
more than one asks each. That is what keeps each guard's meaning independent of what the other axes
hold: `hasGroupOwner` does not care which problem a document is about, and `isInClassUnitContainer`
does not care who owns it.

Asking the *right* axis matters as much as reading the right fields. Sort Work sections a class-wide
document under the class because of who owns it, so it asks `hasClassOwner`. The Edit button lets a
classmate into a class-wide document because of where it is kept, so it asks
`isInClassUnitContainer`.

A guard reads *stored fields only*. It must not consult the kind registry: Sort Work lists documents
from other units, whose kinds are not registered in the current session.

The module also provides `getCurriculumLabel(doc)`, which names a document's curriculum position —
`"sas-1.2"` for a problem, `"sas"` for a unit. Titles use it as a stand-in when a document's real
title cannot be resolved. Nothing currently asks a yes/no question about the curriculum axis, so no
guard for it exists.

## How a kind declares its axes

Those fields are stamped at creation from what the kind registered in
`src/models/document/document-kinds.ts`. A kind declares two things:

- `ownerType` — `"user"`, `"group"`, or `"class"`. It picks the owner `uid` (`getDocumentOwner`) and,
  for a group owner, the `groupId` stored beside it (`getDocumentOwnerFields`).
- `containerType` — `"class"`, `"classUnit"`, or `"offering"`. It picks the fields that say where the
  document is kept and what it is about (`getDocumentLocationFields`).

One knob covers both container and curriculum because every container above the class is *identified
by* a curriculum coordinate — a classUnit by its unit, an offering by its problem — so a kind has no
curriculum position left to choose separately. `getDocumentLocationFields` is named for the pair rather
than for the container alone, because the fields it returns span both axes.

There is no container level for a group. A group document is kept in the offering, alongside the
problem documents its members write; what makes it the group's is its owner. Its `groupId` therefore
follows `ownerType: "group"`, and is a denormalization of an owner uid that already encodes it
(`group_<offeringId>_<groupId>`).

Both owner guards read the `uid`, testing the prefix its minter used — `kGroupOwnerPrefix`,
`kClassOwnerPrefix`, each shared by the function that mints the uid and the guard that reads it back.
Testing a prefix is not the same as taking a uid apart: nothing recovers an `offeringId` or a `groupId`
out of one, which is lossy and is why `getGroupByOwnerId` builds the whole owner id and compares instead.

That leaves the `uid` as the single authority on who a document belongs to — it is also what the
canonical slot is addressed by and what the Firestore rules read — so what remains of the stored
`groupId` is worth knowing, because it has been shrinking. It no longer answers *whether* a document is
group-owned, and it no longer resolves a group document to its members. What remains is Sort Work's group
labels, the transitional group-document title, and the two queries that retire with the canonical-pointer
migration — a Firestore query needs a stored field, which a uid grammar cannot provide.

## What each stored shape looks like

| document | `uid` | `unit` | `investigation` | `offeringId` | `groupId` | container | curriculum | owner |
|---|---|---|---|---|---|---|---|---|
| personal, learning log | the user | `null` | — | — | — | class | none | user |
| problem, planning, publications | the user | set | set | set | — | offering | problem | user |
| group | `group_<offeringId>_<groupId>` | set | set | set | set | offering | problem | **group** |
| exemplar (from curriculum) | authoring persona | set | set | — | — | classUnit | problem | synthetic user |
| class-wide slot | `class_<classHash>` | set | `null` | — | — | classUnit | **unit** | class |

The owner column is read off the `uid` alone. `groupId` is set on exactly the row whose `uid` already
encodes it, which is what makes it a denormalization rather than a second source.

The `null`s are load-bearing. A class-wide document writes `investigation: null` and `problem: null`
explicitly rather than omitting them, because Firestore cannot match a field that is missing — that is
what makes "about a unit but not a problem" a queryable condition.

## What the rules enforce

A document's owner is pinned when it is created: `firestore.rules` admits a new document only if its `uid`
is the caller's own, their own class (`class_<class_hash>`, corroborated by the token claim), or a group
whose id agrees with the document's own `offeringId` and `groupId`. `concurrent: true` is admitted only
alongside one of the two synthetic owners, so no real-user-owned document can be created class-shared.

**The group case is agreement, not membership.** Group membership lives in the Realtime Database, which the
rules cannot read, and the auth token carries no group claim — so a student can still create a document
owned by another group in their own offering. They cannot create one owned by a classmate, by a group in
another offering, or by another class. Closing the gap needs a group claim in the portal-minted token or
group membership mirrored into Firestore, and it is why the owner axis is still in progress.

**The class case has a residual of its own, accepted rather than tracked as work.** The token corroborates
that the caller belongs to the class named in `class_<class_hash>`, not that they are entitled to mint a
document under that owner: any class member can create any number of `class_<class_hash>`-owned,
`concurrent: true` documents, each sectioned under "Whole Class" in Sort Work with the whole class granted
read and write on its history. Convergence on one class document requires that any class member can mint
it, so this is inherent to the design rather than something to close.

## Not covered yet

- **No guard reads the user level of owner.** A user-owned document is simply one whose `uid` is
  neither synthetic prefix, and no guard says so; consumers compare `uid` to a user id directly.
  There is also no getter that returns *which* owner a document has — only the two "is it this one"
  guards.
- **`hasClassOwner` reads the uid's grammar.** The class owner has no field of its own, so the guard
  matches the `class_` prefix that `DB.userIdForClassWideDocuments` mints. The two share
  `kClassOwnerPrefix`, which is what keeps them from drifting, but the grammar is still a convention
  rather than something stored. The same is true of the group owner uid.
- **Only one container level has a guard.** `isInClassUnitContainer` distinguishes classUnit from
  offering; nothing names the class level, and no getter returns a document's container. Canonical
  pointer paths are assembled from the individual fields on both sides (`getCanonicalPointerPath` and
  the rules' `canonicalPointerPath`) rather than from a container value.
- **The `permissions` axis has no representation, so its consumers compose it by hand.** Permission
  decisions are spread widely through the code — [axes.md](./axes.md) lists the four-up share toggle,
  publications, group documents, multi-class supports, and exemplars — and each site works out its own
  answer from whatever fields are nearest. The edit gate `canUserEditDocument` in
  `src/models/document/document-utils.ts` is worth calling out as a **worked example**, not because it
  came first but because it composes the whole question in a few readable lines: a `type` test for
  published documents, an owner comparison, `concurrent`, then a reach test over the owner and the
  container. In the target design a document instead references a named **permission policy** and a gate
  like this collapses into resolving that policy. Two things follow, worth stating where the example is:
  - **Its `type` test is the last type branch left inside that gate.** "A published document is frozen"
    is a permission statement, and a policy is what should carry it. Its neighbor
    `isDocumentAccessibleToUser` still branches on `type` for the same reason — read access is also a
    permissions question — which is the clearest sign that these branches are waiting on the axis rather
    than on any one consumer being cleaned up.
  - **Its `concurrent` test likely goes the same way.** A policy that grants write to a class or a group
    states the multi-writer case directly, so "is this document concurrent" stops being a separate
    question a gate has to ask first. The container and owner tests that follow are then not permission
    logic at all, but the resolution of *which* class or group the policy's grant points at — which the
    guards above already answer.

## Titling a document from another unit

Under Sort Work's "All" filter a class sees every document it owns, including documents from units it
has already worked through — the class hash spans units. Two title-resolution problems follow, and both
are handled by treating a unit-declared title as belonging to its unit:

- A kind declared by a unit that is not loaded has no registered title, and a class-wide document
  stores no title of its own. `getDocumentDisplayTitle` names it from `getDocumentKindLabel(kind)` plus
  the curriculum label — `"Driving Question Board (other)"`.
- Two units may declare the *same* kind with different wording. `IDocumentKindInfo.unit` records which
  unit's config declared a title, and `getDocumentTitle` returns it only for that unit's documents, so
  a foreign document falls through to the label above rather than borrowing wording that may not be its
  own.

The kind label recovers the kind's identity, not the author's wording: a slot titled "Our Big Questions"
in its own unit reads as "Driving Question Board" from elsewhere. Nothing loads another unit's config,
so its authored title is not available.
