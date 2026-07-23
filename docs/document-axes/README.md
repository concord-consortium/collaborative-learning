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
| `kind` (preset/cohort tag: defaults, presentation, templates) | stored per-doc tag; dereferenced only in the kind registry | in progress | CLUE-550 Stage 1 (stored + registry seeded; presentation wiring lands Stage 3); class-wide slot kinds registered CLUE-550 Stage 2 |
| `owner` (authoring identity / provenance) | getter over existing `uid` | not started | — |
| `scope` (org + curriculum association refs) | getter derived from existing `context`/`offeringId`/`groupId`/`problem`/`unit` | not started | — |
| `permissions` (composed grant set) | permission-policy grants (referenced policy) + stored per-doc grants | not started | — |
| kind registry (by-kind view) | `register`/`get` map keyed on `kind`; `fn(doc)` API | done | CLUE-550 Stage 1 |
| behavior modules (by-behavior view) | `fn(doc)` reading axis getters / registry; never branch on `kind` | in progress | CLUE-550 Stage 1 (history + write-sync on concurrent; read-access + rules-delete on group type, interim until the permissions axis) |
| creation factory (the one `kind → axis` bridge) | reads registry defaults, stamps axis values on a new doc | in progress | CLUE-550 Stage 2 (per-slot class-wide canonical creation) |

Status values: `not started` / `in progress` / `done`.

## Current effort

CLUE-550 ("class-wide collaborative documents") is the first concrete slice of this roadmap. Stage 1 introduced the
`concurrent` and `kind` stored axes plus a kind registry, then rebased group-document behavior (concurrent
history, non-owner write-sync, class-wide read access, the rules delete clause) from `type === "group"` onto
the stored `concurrent`. Stage 2 auto-creates class-wide documents (e.g. the driving-question board) via the
canonical-pointer engine: a class+unit pointer scope alongside the existing offering+group scope, with
get-or-create convergence guaranteeing exactly one document per slot per class. Those pieces flip the
`concurrent`, `kind`, kind-registry, `canonical`, and creation-factory rows above as they land.

Review issue #6 (a content-drift guard globally weakened in an earlier, superseded PR to mask a first-session
DQB creation race) turned out not to need its revert: the weakening never landed on this branch or master, and
the canonical-creation path already writes the Firestore metadata document before the document is opened and
its history manager subscribes, so the ordering that would have produced a first-session drift false-positive
cannot occur. This is verified at the rules/emulator level rather than by changing drift-guard code.
