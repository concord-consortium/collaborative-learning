# Document Axes Roadmap

This folder tracks the incremental refactoring of CLUE's document-type system into explicit **axes**.
Historically a single `type` field is switched on in ~90 places across client, rules, and functions. The
target is to decompose `type` into orthogonal, mostly-stored axes so each document's meaning is read in one
place, with `type`/`kind` dereferenced only inside a kind registry and a creation factory — never as a runtime
branch.

- **Concepts — what the axes are, read out of current CLUE behavior:** [axes.md](./axes.md)
- **Target — how the axes live in code (layers and boundaries):** [target-architecture.md](./target-architecture.md)
- **Research background (current-state evidence):** the findings doc, on the `document-type-decomposition`
  branch (~49KB; left there rather than imported).

### Related existing docs this roadmap evolves toward

- [../document-types.md](../document-types.md) — the current `type` catalog these axes decompose.
- [../document-scope.md](../document-scope.md) — the current scoping model the `scope` axis formalizes.
- [../group-docs/README.md](../group-docs/README.md) — the group-document feature; its concurrency behavior is
  the first thing rebased onto the `concurrent` axis.

## Status table

One row per axis (from [axes.md](./axes.md)) plus the three supporting components from
[target-architecture.md](./target-architecture.md) (kind registry, behavior modules, creation factory). Each later stage
flips the rows it delivers **in the same PR**, and names the stage/ticket under "Delivered by".

| Axis / component | Mechanism (target) | Status | Delivered by |
|---|---|---|---|
| `canonical` (single pointed-to doc for a scope slot) | scoped pointer slots, rule-enforced | done | CLUE-524; class+unit pointer scope added CLUE-550 Stage 2 |
| `concurrent` (multi-writer vs single-writer) | stored per-doc; rule-readable; `DocumentModel` prop sourced from Firestore at open | done | CLUE-550 Stage 1 |
| `kind` (preset/cohort tag: defaults, presentation, templates) | stored per-doc tag; dereferenced only in the kind registry | done | CLUE-550 Stage 1 (stored + registry seeded); titles resolved by kind Stage 2; presentation wired Stage 3 (workspace title bar reads the registry; no consumer branches on kind); Stage 3 also scopes a unit-declared kind's definition to its unit — see "Static and dynamic kinds" in [axes.md](./axes.md) |
| `owner` (authoring identity / provenance) | creation: kind-declared `ownerType` → owner `uid` (in the kind registry); read: getter over stored `uid` | in progress | CLUE-550 Stage 2 (creation-side owner derivation registry-declared for all kinds via `getDocumentOwner`; read-side getter still to come) |
| `scope` (org + curriculum association refs) | creation: `getDocumentScopeFields(kind, ctx)` stamps a kind's association fields, keyed on a registered `scopeType`; read: consumers read the individual scope fields through named guards (`hasGroupScope`, `hasClassUnitScope`) rather than branching on `type` | in progress | CLUE-550 Stage 2 (creation side, every kind); Stage 3 (read side: guards in `document-scope.ts`; the class+unit scope states its absent curriculum fields explicitly so it is queryable) |
| `permissions` (composed grant set) | permission-policy grants (referenced policy) + stored per-doc grants | not started | — |
| kind registry (by-kind view) | `register`/`get` map keyed on `kind`; `fn(doc)` API | done | CLUE-550 Stage 1 |
| behavior modules (by-behavior view) | `fn(doc)` reading axis getters / registry; never branch on `kind` | in progress | CLUE-550 Stage 1 (history + write-sync on concurrent; read-access + rules-delete on group type, interim until the permissions axis); Stage 3 (edit gate `canUserEditDocument`, collaborative thumbnail treatment, and the collaborative title bar all read `concurrent`) |
| creation factory (the one `kind → axis` bridge) | reads registry defaults, stamps axis values on a new doc | in progress | CLUE-550 Stage 2 (per-slot class-wide canonical creation; owner `uid` and scope fields stamped from the kind's `ownerType`/`scopeType`) |

Status values: `not started` / `in progress` / `done`.

## Current effort

CLUE-550 ("class-wide collaborative documents") is the first concrete slice of this roadmap. Stage 1 introduced the
`concurrent` and `kind` stored axes plus a kind registry, then rebased group-document behavior (concurrent
history, non-owner write-sync, class-wide read access, the rules delete clause) from `type === "group"` onto
the stored `concurrent`. Stage 2 auto-creates class-wide documents (e.g. the driving-question board) via the
canonical-pointer engine: a class+unit pointer scope alongside the existing offering+group scope, with
get-or-create convergence guaranteeing exactly one document per slot per class. Stage 2 also begins the
`owner` and `scope` axes on the creation side, now for **every** kind: a document's owner `uid` is derived from
the kind's registered `ownerType` (`user` / `group` / `class`) — class-wide documents owned by a class-scoped
synthetic uid (`class_<classHash>`) — and its scope association fields from the kind's registered `scopeType`
via `getDocumentScopeFields(kind, ctx)`, both resolved in the kind registry rather than a `type` switch. Because
all kinds are registered, `createFirestoreMetadataDocument` derives owner and scope through these registry calls
for all document types. The kind axis fields (`kind`/`concurrent`) are stamped only on
`type:"group"` documents — avoiding a stamp we would have to migrate if the publication kinds are later folded
into the kinds they publish.

Stage 3 surfaces those documents: Sort Work sections them under "Whole Class" by scope rather than by
type, a unit-scoped listener keeps them visible under the investigation and problem filters,
presentation reads `concurrent` and the kind registry, and one predicate (`canUserEditDocument`)
gates every Edit button. It also settles the deferred scope-modeling question: consumers read narrow
named guards over the stored association fields, with no `scopeLevel` enum and no unified `scope`
struct (see docs/document-scope.md).
