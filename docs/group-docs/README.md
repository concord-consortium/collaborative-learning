# Group Documents Documentation

Documentation for CLUE's group-document feature: multiple users collaborating on the same document. This folder collects the plan, current state, design specs, research, and reference material.

## Forward-looking

- [group-docs-plan.md](group-docs-plan.md) — The active plan: GD-7 onward. Lists work areas (GD-N items), dependencies, and ordering.
- [group-docs-classroom-readiness.md](group-docs-classroom-readiness.md) — Concise stakeholder-facing summary of what's left before classroom use, split into general / DataFlow / collaborative-text tracks.
- [group-docs-jira-mapping.md](group-docs-jira-mapping.md) — Maps Jira stories under the CLUE-312 epic to the plan's GD-N items. Tracks which plan items have stories and which don't.

## Current state and history

- [group-docs-current-state.md](group-docs-current-state.md) — What works today, what doesn't, and known severe issues for users testing the feature.
- [group-docs-completed-work.md](group-docs-completed-work.md) — Completed group-document work in landing order: GD-1 through GD-6, GD-9, and the CLUE-483 UI disruption testing pass.
- [group-docs-implementation-todos.md](group-docs-implementation-todos.md) — Internal code TODOs in the legacy concurrent history manager. Most are subsumed by GD-19; referenced from GD-22.

## Design specs

Detailed designs for individual plan items.

- [settled-state-doc-saves-design.md](settled-state-doc-saves-design.md) — Design for [GD-18](group-docs-plan.md#gd-18-settled-state-document-saves). Save the doc only when the receive-side state machine is settled. Status: design complete.
- [transaction-free-history-design.md](transaction-free-history-design.md) — Design for [GD-19](group-docs-plan.md#gd-19-transaction-free-history). Replace the per-document Firestore transaction with a multi-parent DAG. Status: early draft.
- [background-entries-design.md](background-entries-design.md) — Design for [GD-20](group-docs-plan.md#gd-20-background-entries-dataflow). Make tick-rate dataflow changes ordinary history entries with a `background` flag. Status: draft for review.
- [group-docs-coupled-scopes.md](group-docs-coupled-scopes.md) — Design for [GD-24](group-docs-plan.md#gd-24-opt-in-coupled-scopes-held-in-reserve). Opt-in coupling between tile and shared-model scopes. Held in reserve as an alternative to GD-11's tolerate-stale-references approach.

## Research and empirical

- [group-docs-tile-resilience-research.md](group-docs-tile-resilience-research.md) — Per-tile risk analysis: how each tile would respond to remote model changes during active interaction. Feeds [GD-11: Tile Hardening](group-docs-plan.md#gd-11-tile-hardening-as-needed).
- [test-scripts/](test-scripts/) — Manual reproduction scripts for concurrent-editing cases, organized per tile and per shared model. Concrete cases that validate or refute the resilience research; will be migrated to automated Playwright tests under [GD-16](group-docs-plan.md#gd-16-e2e-test-framework).

## Reference and context

- [group-docs-brainstorm.md](group-docs-brainstorm.md) — Original design brainstorm. Origin context for the plan's GD-1 through GD-5 framing; referenced by the design specs.
- [group-docs-future-dev-tooling.md](group-docs-future-dev-tooling.md) — Developer-rationale notes for larger tooling investments (split dev/end-user editor builds, Playwright test labeling strategy). Cross-references plan items where they exist.
