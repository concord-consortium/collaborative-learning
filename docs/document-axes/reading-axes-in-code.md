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
`src/models/document/document-kinds.ts`. A kind declares two things:

- `ownerType` — `"user"`, `"group"`, or `"class"`. It picks the owner `uid` (`getDocumentOwner`) and,
  for a group owner, the stored `groupId` (`getDocumentOwnerFields`).
- `containerType` — `"class"`, `"classUnit"`, or `"offering"`. It picks the fields that say where the
  document is kept and what it is about (`getDocumentLocationFields`).

One knob covers both container and curriculum because every container above the class is *identified
by* a curriculum coordinate — a classUnit by its unit, an offering by its problem — so a kind has no
curriculum position left to choose separately. `getDocumentLocationFields` is named for the pair rather
than for the container alone, because the fields it returns span both axes.

There is no container level for a group. A group document is kept in the offering, alongside the
problem documents its members write; what makes it the group's is its owner. Its `groupId` therefore
follows `ownerType: "group"`, and is a denormalization of an owner uid that already encodes it
(`group_<offeringId>_<groupId>`) — stored so Firestore rules and group-member lookups need not parse
the uid.

## What each stored shape looks like

| document | `unit` | `investigation` | `offeringId` | `groupId` | container | curriculum | owner |
|---|---|---|---|---|---|---|---|
| personal, learning log | `null` | — | — | — | class | none | user |
| problem, planning, publications | set | set | set | — | offering | problem | user |
| group | set | set | set | set | offering | problem | **group** |
| exemplar (from curriculum) | set | set | — | — | classUnit | problem | synthetic user |
| class-wide slot | set | `null` | — | — | classUnit | **unit** | class |

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
