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
| `canonical` (single pointed-to doc for a scope slot) | scoped pointer slots, rule-enforced | done | CLUE-524 |
| `concurrent` (multi-writer vs single-writer) | stored per-doc; rule-readable; `DocumentModel` prop sourced from Firestore at open | not started | — |
| `kind` (preset/cohort tag: defaults, presentation, templates) | stored per-doc tag; dereferenced only in the kind registry | not started | — |
| `owner` (authoring identity / provenance) | getter over existing `uid` | not started | — |
| `scope` (org + curriculum association refs) | getter derived from existing `context`/`offeringId`/`groupId`/`problem`/`unit` | not started | — |
| `permissions` (composed grant set) | permission-policy grants (referenced policy) + stored per-doc grants | not started | — |
| kind registry (by-kind view) | `register`/`get` map keyed on `kind`; `fn(doc)` API | not started | — |
| behavior modules (by-behavior view) | `fn(doc)` reading axis getters / registry; never branch on `kind` | not started | — |
| creation factory (the one `kind → axis` bridge) | reads registry defaults, stamps axis values on a new doc | not started | — |

Status values: `not started` / `in progress` / `done`.

## Current effort

CLUE-550 ("class-wide collaborative documents") is the first concrete slice of this roadmap. It introduces the
`concurrent` and `kind` stored axes plus a kind registry, then rebases group-document behavior (concurrent
history, non-owner write-sync, class-wide read access, the rules delete clause) from `type === "group"` onto
the stored `concurrent`. Those pieces flip the `concurrent`, `kind`, and kind-registry rows above as they land.
