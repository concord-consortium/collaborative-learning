# Document Axes Roadmap

This folder tracks the incremental refactoring of CLUE's document-type system into explicit **axes**.
Historically a single `type` field is switched on in ~90 places across client, rules, and functions. The
target is to decompose `type` into orthogonal, mostly-stored axes so each document's meaning is read in one
place, with `type`/`kind` dereferenced only inside a kind registry and a creation factory — never as a runtime
branch.

- **Concepts — what the axes are, read out of current CLUE behavior:** [axes.md](./axes.md)
- **Target — how the axes live in code (layers and boundaries):** [target-architecture.md](./target-architecture.md)
- **Current state — what a consumer can read off a document today:** [reading-axes-in-code.md](./reading-axes-in-code.md)
- **Research background (current-state evidence):** the findings doc, on the `document-type-decomposition`
  branch (~49KB; left there rather than imported).

### Related existing docs this roadmap evolves toward

- [../document-types.md](../document-types.md) — the current `type` catalog these axes decompose.
- [../group-docs/README.md](../group-docs/README.md) — the group-document feature; its concurrency behavior is
  the first thing rebased onto the `concurrent` axis.

## Status table

One row per axis (from [axes.md](./axes.md)) plus the three supporting components from
[target-architecture.md](./target-architecture.md) (kind registry, behavior modules, creation factory). Each later stage
flips the rows it delivers **in the same PR**, and names the stage/ticket under "Delivered by".

| Axis / component | Mechanism (target) | Status | Delivered by |
|---|---|---|---|
| `canonical` (single pointed-to doc for a slot) | pointer slots addressed as container + owner + label, rule-enforced | done | CLUE-524; class+unit slots added CLUE-550 Stage 2; Stage 3 gave every slot an explicit owner segment, taken from the document's `uid` |
| `concurrent` (multi-writer vs single-writer) | stored per-doc; rule-readable; `DocumentModel` prop sourced from Firestore at open | done | CLUE-550 Stage 1 |
| `kind` (preset/cohort tag: defaults, presentation, templates) | stored per-doc tag; dereferenced only in the kind registry | done | CLUE-550 Stage 1 (stored + registry seeded); titles resolved by kind Stage 2; presentation wired Stage 3 (workspace title bar reads the registry; no consumer branches on kind); Stage 3 also scopes a unit-declared kind's definition to its unit — see "Static and dynamic kinds" in [axes.md](./axes.md) |
| `owner` (who the document belongs to) | creation: kind-declared `ownerType` → owner `uid` (`getDocumentOwner`) plus a group owner's stored `groupId` (`getDocumentOwnerFields`); read: `hasGroupOwner(doc)` and `hasClassOwner(doc)`, each over the uid prefix its minter used | in progress | CLUE-550 Stage 2 (creation-side owner derivation registry-declared for all kinds); Stage 3 (both guards; `groupId` moved onto this axis, off the container, and then off the owner *question* — the `uid` is the sole authority). Still to come: the user level, and a getter that returns which owner a document has rather than testing for one |
| `container` (where the document is kept: class → classUnit → offering) | creation: kind-declared `containerType`, stamped by `getDocumentLocationFields(kind, ctx)`; read: `isInClassUnitContainer(doc)`, over an `offeringId` now surfaced on both metadata types | in progress | CLUE-550 Stage 2 (creation side, every kind); Stage 3 (`containerType` replaces `scopeType`, with no group level — a group document is kept in the offering and owned by the group; the edit gate switched from a curriculum test to this one). Still to come: a guard for the class level, and a getter returning the container |
| `curriculum` (what the document is about: nothing → unit → investigation → problem) | creation: fixed by the kind's `containerType`, since every container above the class is identified by a curriculum coordinate; read: `getCurriculumLabel(doc)` | in progress | CLUE-550 Stage 2 (creation side, every kind); Stage 3 (the label, and the unit level states its absent fields explicitly so it is queryable). No consumer asks a yes/no curriculum question, so no guard exists |
| `permissions` (composed grant set) | permission-policy grants (referenced policy) + stored per-doc grants | not started | — |
| kind registry (by-kind view) | `register`/`get` map keyed on `kind`; `fn(doc)` API | done | CLUE-550 Stage 1 |
| behavior modules (by-behavior view) | `fn(doc)` reading axis getters / registry; never branch on `kind` | in progress | CLUE-550 Stage 1 (history + write-sync on concurrent; read-access + rules-delete on group type, interim until the permissions axis); Stage 3 (edit gate `canUserEditDocument`, collaborative thumbnail treatment, and the collaborative title bar all read `concurrent`) |
| creation factory (the one `kind → axis` bridge) | reads registry defaults, stamps axis values on a new doc | in progress | CLUE-550 Stage 2 (per-slot class-wide canonical creation; owner and location fields stamped from the kind's `ownerType`/`containerType`) |

Status values: `not started` / `in progress` / `done`.

## Current effort

CLUE-550 ("class-wide collaborative documents") is the first concrete slice of this roadmap. Stage 1 introduced the
`concurrent` and `kind` stored axes plus a kind registry, then rebased group-document behavior (concurrent
history, non-owner write-sync, class-wide read access, the rules delete clause) from `type === "group"` onto
the stored `concurrent`. Stage 2 auto-creates class-wide documents (e.g. the driving-question board) via the
canonical-pointer engine: a class+unit slot alongside the existing offering+group one, with
get-or-create convergence guaranteeing exactly one document per slot per class. Stage 2 also begins the
`owner`, `container`, and `curriculum` axes on the creation side, now for **every** kind: a document's owner
`uid` is derived from the kind's registered `ownerType` (`user` / `group` / `class`) — class-wide documents
owned by a synthetic class uid (`class_<classHash>`) — and the fields saying where it is kept and what it is
about from the kind's registered container, both resolved in the kind registry rather than a `type` switch.
Because all kinds are registered, `createFirestoreMetadataDocument` derives all of these through registry calls
for all document types. The kind axis fields (`kind`/`concurrent`) are stamped only on
`type:"group"` documents — avoiding a stamp we would have to migrate if the publication kinds are later folded
into the kinds they publish.

Stage 3 surfaces those documents: Sort Work sections them under "Whole Class" by owner and curriculum
rather than by type, a unit-scoped listener keeps them visible under the investigation and problem
filters, presentation reads `concurrent` and the kind registry, and one predicate
(`canUserEditDocument`) gates every Edit button. It also settles how these axes are modeled in code:
consumers read narrow named guards over the stored fields, with no level enum and no unified struct;
a kind declares `ownerType` and `containerType`; and `groupId` sits on the owner axis, so there is no
group container level (see [reading-axes-in-code.md](./reading-axes-in-code.md)). Canonical slots follow:
each is addressed as its container plus its owner plus a label, with the owner segment read straight from
the document's `uid` so the pointer path no longer depends on `groupId` at all. Both owner guards read the
`uid` the same way, which leaves it the single authority on who a document belongs to; the stored
`groupId` is left carrying only Sort Work's group label and the queries that retire with the
canonical-pointer migration.
