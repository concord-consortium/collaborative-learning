# Reading the axes in code, today

> **Purpose:** what a consumer can actually read off a document right now, and how. [axes.md](./axes.md)
> defines the axes in terms of behavior and deliberately avoids naming code;
> [target-architecture.md](./target-architecture.md) describes where the code is heading. This doc is the
> current state in between — the helpers that exist, the stored fields behind them, and what is not
> covered yet.

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
`src/models/document/document-kinds.ts`. A kind does not spell out axis values: it names an **axis
profile** (`src/models/document/document-axis-profiles.ts`), and the profile declares them. Many kinds
share one — what separates a learning log from a personal document is presentation and its creation
recipe, not any axis — and the profiles file is therefore the complete list of axis combinations the
application creates documents at. See "Axis profiles" in [axes.md](./axes.md).

A profile declares two knobs, plus `concurrent`:

- `ownerType` — `"user"`, `"group"`, or `"class"`. It picks the owner `uid` (`getDocumentOwner`) and,
  for a group owner, the `groupId` stored beside it (`getDocumentOwnerFields`).
- `containerType` — `"class"`, `"classUnit"`, or `"offering"`. It picks the fields that say where the
  document is kept and what it is about (`getDocumentLocationFields`).

The profile's name is stamped onto the document it creates, in `axisProfile`, and that record is
deliberately declared on no runtime type — not `IDocumentMetadata`, not `DocumentMetadataModel`, not
`DocumentModel` — so reading it back would mean widening a type first. Only a migration or offline
analysis, reading Firestore directly, can see it. See the
[`axisProfile` field](../document-metadata/metadata-fields.md#axisprofile) for what is stored and where.

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

| document | `uid` | `unit` | `investigation` | `offeringId` | `groupId` | `canonical` | container | curriculum | owner |
|---|---|---|---|---|---|---|---|---|---|
| personal, learning log | the user | `null` | — | — | — | — | class | none | user |
| problem, planning, publications | the user | set | set | set | — | — | offering | problem | user |
| group | `group_<offeringId>_<groupId>` | set | set | set | set | `"default"` | offering | problem | **group** |
| exemplar (from curriculum) | authoring persona | set | set | — | — | — | classUnit | problem | synthetic user |
| class-wide slot | `class_<classHash>` | set | `null` | — | — | **the kind** | classUnit | **unit** | class |

The owner column is read off the `uid` alone. `groupId` is set on exactly the row whose `uid` already
encodes it, which is what makes it a denormalization rather than a second source.

`canonical` holds a **slot label**, not a flag: the final segment of the pointer path the document won
(`…/owners/<uid>/slots/<label>`). The two rows that carry one show why it cannot be a boolean — a class-wide
document is labeled with its kind precisely so that several of them can be canonical at once inside the same
classUnit container, under the same class owner, one per declared kind. A problem document is canonical *by
convention* only: no pointer is claimed for it, so the field stays unset.

Nothing in the client reads it. The path is always built from what the caller already knows — the container,
the owner, and the label it is asking for — and the *pointer* is what names the document, so the code only
ever travels slot → document. The label is stored for the direction nothing travels yet, and for the
Firestore rules: they rebuild the pointer path from the incoming label to verify a claim (which is why no
label is hardcoded in the rules), and they read the stored label back to refuse deleting a document that
holds a slot.

The `null`s are load-bearing. A class-wide document writes `investigation: null` and `problem: null`
explicitly rather than omitting them, because Firestore cannot match a field that is missing — that is
what makes "about a unit but not a problem" a queryable condition.

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
