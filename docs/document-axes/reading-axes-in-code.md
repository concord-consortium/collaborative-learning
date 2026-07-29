# Reading the axes in code, today

> **Purpose:** what a consumer can actually read off a document right now, and how. [axes.md](./axes.md)
> defines the axes in terms of behavior and deliberately avoids naming code;
> [target-architecture.md](./target-architecture.md) describes where the code is heading. This doc is the
> current state in between — the helpers that exist, the stored fields behind them, and what is not
> covered yet.

## The guards

Consumers that need a document's position on an axis read its stored association fields through the
guards in `src/models/document/document-scope.ts`, rather than branching on the document `type`:

- `hasGroupOwnerScope(doc)` — an **owner** question: the document belongs to a single group.
- `hasUnitCurriculumScope(doc)` — a **curriculum** question: the document is about a whole unit and
  nothing narrower.

Each guard answers about one axis and reads only that axis's fields. A consumer needing a position on
both asks both. That is what keeps each guard's meaning independent of what the other axis holds:
`hasGroupOwnerScope` does not care which problem a document is about, and `hasUnitCurriculumScope`
does not care who owns it.

A guard reads *stored fields only*. It must not consult the kind registry: Sort Work lists documents
from other units, whose kinds are not registered in the current session.

The module also provides `getCurriculumScopeLabel(doc)`, which names a document's curriculum position
— `"sas-1.2"` for a problem, `"sas"` for a unit. Titles use it as a stand-in when a document's real
title cannot be resolved.

> **Naming lag.** These helpers were written while `scope` was still a single axis, so they carry
> "Scope" in their names and live in a module called `document-scope`. `hasGroupOwnerScope` belongs to
> `owner`; `hasUnitCurriculumScope` and `getCurriculumScopeLabel` belong to `curriculum`. Renaming them
> has not been done.

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

- **No guard reads the class or user levels of owner.** Those live in `uid`: the class owner is a
  synthetic `class_<classHash>`, the group owner a synthetic `group_<offeringId>_<groupId>`. A consumer
  wanting "owned by the class" currently approximates it with `hasUnitCurriculumScope`, which is
  correct only while the one class-owned kind is also the one unit-scoped kind. `document-group.ts`'s
  `byName` is commented to that effect and should switch when an owner guard exists.
- **No guard reads the container at all.** Its levels are derivable from the same stored fields —
  `offeringId` for offering, `unit` for classUnit, `context_id` for class — but nothing exposes them,
  and the canonical-pointer path is built from the individual fields instead.
- **`offeringId` is effectively write-only.** It is written to Firestore at creation but is declared on
  neither `IDocumentMetadata` nor `DocumentMetadataModel`, so no read-side consumer can see it. Every
  document that carries one also carries an `investigation`, so nothing is misclassified today.

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
