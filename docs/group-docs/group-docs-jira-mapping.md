# Group Documents: Jira Stories ↔ Plan Mapping

This document maps the Jira stories under the CLUE-312 "Group Document" epic to the areas in `group-docs-plan.md`, and identifies gaps in both directions.

## New Stories Created for Plan Gaps

Stories created that should be reviewed with Leslie.

| Key | Summary | Status | Charged To | Plan Area |
|---|---|---|---|---|
| [CLUE-486](https://concord-consortium.atlassian.net/browse/CLUE-486) | Group documents: Shared model conflict resolution | To Do | 402 FlowAI | [GD-10: Shared Model Merging](group-docs-plan.md#gd-10-shared-model-merging) |
| [CLUE-487](https://concord-consortium.atlassian.net/browse/CLUE-487) | Group documents: Reliability and robustness fixes | To Do | *(none)* | [GD-22: Reliability and Robustness](group-docs-plan.md#gd-22-reliability-and-robustness) |
| [CLUE-505](https://concord-consortium.atlassian.net/browse/CLUE-505) | Table Attribute Names Not Responsive | In Project Team Review | *(none)* | [GD-7: Undo Bugs](group-docs-plan.md#gd-7-undo-bugs) (decomposed from CLUE-484) |
| [CLUE-506](https://concord-consortium.atlassian.net/browse/CLUE-506) | Group Docs: Data in Wrong Column | To Do | *(none)* | [GD-7: Undo Bugs](group-docs-plan.md#gd-7-undo-bugs) (decomposed from CLUE-484) |
| [CLUE-507](https://concord-consortium.atlassian.net/browse/CLUE-507) | Group Docs: Coloring the Wrong Object in Drawing Tile | In Progress | *(none)* | [GD-7: Undo Bugs](group-docs-plan.md#gd-7-undo-bugs) (decomposed from CLUE-484) |
| [CLUE-508](https://concord-consortium.atlassian.net/browse/CLUE-508) | Group Docs: Undo/Redo When Partner Deletes a Geometry Tile Object | To Do | *(none)* | [GD-7: Undo Bugs](group-docs-plan.md#gd-7-undo-bugs) (decomposed from CLUE-484) |
| [CLUE-509](https://concord-consortium.atlassian.net/browse/CLUE-509) | Group Docs: Data Card: Shown Card Shifts on Case Delete | To Do | *(none)* | [GD-7: Undo Bugs](group-docs-plan.md#gd-7-undo-bugs) (decomposed from CLUE-484) |
| [CLUE-510](https://concord-consortium.atlassian.net/browse/CLUE-510) | Table: Column Widths are not Reactive | In Project Team Review | *(none)* | [GD-7: Undo Bugs](group-docs-plan.md#gd-7-undo-bugs) (decomposed from CLUE-484) |
| [CLUE-512](https://concord-consortium.atlassian.net/browse/CLUE-512) | Diagram tile crashes when another user deletes a referenced variable | To Do | *(none)* | [GD-11: Tile Hardening](group-docs-plan.md#gd-11-tile-hardening-as-needed) (stale shared-model references — `types.reference`) |
| [CLUE-513](https://concord-consortium.atlassian.net/browse/CLUE-513) | Drawing chip persists after another user deletes the referenced variable | To Do | *(none)* | [GD-11: Tile Hardening](group-docs-plan.md#gd-11-tile-hardening-as-needed) (stale shared-model references — id-as-string) |
| [CLUE-514](https://concord-consortium.atlassian.net/browse/CLUE-514) | Graph silently blanks Y series when another user deletes the referenced attribute | To Do | *(none)* | [GD-11: Tile Hardening](group-docs-plan.md#gd-11-tile-hardening-as-needed) (stale shared-model references — id-as-string) |
| [CLUE-517](https://concord-consortium.atlassian.net/browse/CLUE-517) | Group Docs: Undo invalidation | To Do | *(none)* | [CLUE-517: Undo/Redo (deferred)](group-docs-plan.md#clue-517-undoredo-deferred) |
| [CLUE-518](https://concord-consortium.atlassian.net/browse/CLUE-518) | Data Card View Persistence | To Do | *(none)* | Design task — decide which Data Card view-persistence behaviors to keep |

### Plan items without Jira stories yet

These plan areas are not yet tracked by individual Jira stories. CLUE-379 (the runtime-state SPIKE) is loosely related to GD-18/19/20 but predates them.

| Plan area | Notes |
|---|---|
| [GD-12: Debug Re-render Controls](group-docs-plan.md#gd-12-debug-re-render-controls) | Dev tooling. |
| [GD-13: Auto-Revert Stress Mode](group-docs-plan.md#gd-13-auto-revert-stress-mode) | Dev tooling. |
| [GD-14: Intra-Tile Merging](group-docs-plan.md#gd-14-intra-tile-merging) | Depends on GD-10/GD-17. |
| [GD-15: Finer-grained `doc` scope](group-docs-plan.md#gd-15-finer-grained-doc-scope) | Simple cases depend on GD-9 only; complex cases need GD-17. |
| [GD-16: E2E Test Framework](group-docs-plan.md#gd-16-e2e-test-framework) | Playwright multi-context tests. |
| [GD-17: Type-Aware Merge Delegation](group-docs-plan.md#gd-17-type-aware-merge-delegation) | Foundation for GD-10, GD-14, GD-15. |
| [GD-18: Settled-State Document Saves](group-docs-plan.md#gd-18-settled-state-document-saves) | Prerequisite for GD-19. |
| [GD-19: Transaction-Free History](group-docs-plan.md#gd-19-transaction-free-history) | Prerequisite for GD-20. |
| [GD-20: Background Entries (DataFlow)](group-docs-plan.md#gd-20-background-entries-dataflow) | CLUE-379 SPIKE is loosely related. |
| [GD-21: Collaborative Text-Tile Editing](group-docs-plan.md#gd-21-collaborative-text-tile-editing) | Independent. |
| [GD-23: Tile shared-model hash decoupling](group-docs-plan.md#gd-23-tile-shared-model-hash-decoupling) | Best after GD-16 lands. |

GD-8 (Tile Locking) and GD-24 (Opt-in coupled scopes) are held in reserve in the plan; new stories aren't expected unless that work is picked up. CLUE-315 already exists as a prerequisite for GD-8 if it's ever needed.

## Open Stories Mapped to Plan

### GD-7: Undo Bugs

| Key | Summary | Status | Notes |
|---|---|---|---|
| [CLUE-490](https://concord-consortium.atlassian.net/browse/CLUE-490) | Undo Bugs Should Update UI State | Done | Initial review of the potential undo issues; led to CLUE-484. |
| [CLUE-484](https://concord-consortium.atlassian.net/browse/CLUE-484) | Group documents: Document undo rendering bugs | Done | Reframed from "Fix" to "Document"; decomposed into the stories below. |
| [CLUE-505](https://concord-consortium.atlassian.net/browse/CLUE-505) | Table Attribute Names Not Responsive | In Project Team Review | |
| [CLUE-510](https://concord-consortium.atlassian.net/browse/CLUE-510) | Table: Column Widths are not Reactive | In Project Team Review | |
| [CLUE-507](https://concord-consortium.atlassian.net/browse/CLUE-507) | Group Docs: Coloring the Wrong Object in Drawing Tile | In Progress | |
| [CLUE-506](https://concord-consortium.atlassian.net/browse/CLUE-506) | Group Docs: Data in Wrong Column | To Do | |
| [CLUE-508](https://concord-consortium.atlassian.net/browse/CLUE-508) | Group Docs: Undo/Redo When Partner Deletes a Geometry Tile Object | To Do | |
| [CLUE-509](https://concord-consortium.atlassian.net/browse/CLUE-509) | Group Docs: Data Card: Shown Card Shifts on Case Delete | To Do | Data card displays a case by index rather than id, so deletions shift the visible card. |

### GD-10: Shared Model Merging

| Key | Summary | Status | Notes |
|---|---|---|---|
| [CLUE-486](https://concord-consortium.atlassian.net/browse/CLUE-486) | Group documents: Shared model conflict resolution | To Do | Per-tile stories (CLUE-318, 319, 349) imply concurrent shared model editing but this covers the underlying merge infrastructure. |

### GD-11: Tile Hardening

#### Per-tile placeholder stories

| Key | Summary | Status | Notes |
|---|---|---|---|
| [CLUE-318](https://concord-consortium.atlassian.net/browse/CLUE-318) | Group documents Sim Tiles | To Do | Each sim control change recorded in history. Simultaneous edits: "last student wins". |
| [CLUE-319](https://concord-consortium.atlassian.net/browse/CLUE-319) | Group documents Graph Tiles | To Do | "Multiple students can edit the same or multiple graphs." Minimal description. |
| [CLUE-349](https://concord-consortium.atlassian.net/browse/CLUE-349) | Group documents Table Tiles | To Do | "Multiple students can edit the same or multiple tables." Minimal description. |

#### Stale shared-model references

Concrete bugs called out in [GD-11 § Stale shared-model references](group-docs-plan.md#gd-11-tile-hardening-as-needed):

| Key | Summary | Status | Notes |
|---|---|---|---|
| [CLUE-512](https://concord-consortium.atlassian.net/browse/CLUE-512) | Diagram tile crashes when another user deletes a referenced variable | To Do | `types.reference` case; fix by switching to `types.safeReference`. |
| [CLUE-513](https://concord-consortium.atlassian.net/browse/CLUE-513) | Drawing chip persists after another user deletes the referenced variable | To Do | `types.string` holding an id; audit lookup sites. |
| [CLUE-514](https://concord-consortium.atlassian.net/browse/CLUE-514) | Graph silently blanks Y series when another user deletes the referenced attribute | To Do | `types.string` holding an attribute id; same pattern as CLUE-513. |

### GD-22: Reliability and Robustness

| Key | Summary | Status | Notes |
|---|---|---|---|
| [CLUE-487](https://concord-consortium.atlassian.net/browse/CLUE-487) | Group documents: Reliability and robustness fixes | To Do | Race condition in initial history load, silent metadata-promise failure loop, unhandled rejection in recursive upload. Likely subsumed by GD-19. |

### GD-8: Tile Locking (held in reserve)

UI Disruption Testing (CLUE-483) did not justify the cost of locking — see plan. Held in reserve.

| Key | Summary | Status | Notes |
|---|---|---|---|
| [CLUE-315](https://concord-consortium.atlassian.net/browse/CLUE-315) | Tiles have a 'not group safe' property | To Do | Prerequisite for locking — identifying which tiles need it. |

### CLUE-517: Undo/Redo (deferred)

| Key | Summary | Status | Notes |
|---|---|---|---|
| [CLUE-517](https://concord-consortium.atlassian.net/browse/CLUE-517) | Group Docs: Undo invalidation | To Do | Direct match to plan's deferred CLUE-517 section: invalidate user's undo entries when a remote change touches the same scope. |

### Tile Focus Indicator

Implementation of the multi-user-on-a-tile design ([CLUE-491](https://concord-consortium.atlassian.net/browse/CLUE-491), Done). Not currently a tracked plan area but related to group-doc UX.

| Key | Summary | Status | Notes |
|---|---|---|---|
| [CLUE-317](https://concord-consortium.atlassian.net/browse/CLUE-317) | Group docs Show all in focus on Tile | In Code Review | Repurposed from original "Locked tiles: Program Tiles" to focus-indicator implementation. |
| [CLUE-520](https://concord-consortium.atlassian.net/browse/CLUE-520) | Group docs: Tags on narrow tiles are consolidated | To Do | Follow-up to CLUE-317: handle tag overflow on narrow tiles via "+n" indicator. |

### Save Status Indicator

| Key | Summary | Status | Notes |
|---|---|---|---|
| [CLUE-511](https://concord-consortium.atlassian.net/browse/CLUE-511) | Update Styling for save status indicator to document titlebar | To Do | Follow-up to CLUE-499 (the indicator itself); icon and label styling. |

### History Scrubber

User-facing playback slider for documents (distinct from the dev-only history viewer added under [GD-4](group-docs-completed-work.md#gd-4-history-viewer)).

| Key | Summary | Status | Notes |
|---|---|---|---|
| [CLUE-500](https://concord-consortium.atlassian.net/browse/CLUE-500) | Scroll the affected tile into view during history playback | To Do | Was implemented on CLUE-102 branch; carved out for separate prioritization after that branch was broken up. |

### Dev tooling / Bug-reproduction cleanup

| Key | Summary | Status | Notes |
|---|---|---|---|
| [CLUE-516](https://concord-consortium.atlassian.net/browse/CLUE-516) | Clean up history system to make bugs easier to identify and reproduce | In Progress | Small fixes: "remove after 5s" feedback, useDocumentSyncToFirebase warning, group-switching with open group doc, per-entry user attribution in history view. |

### Planning

| Key | Summary | Status | Notes |
|---|---|---|---|
| [CLUE-515](https://concord-consortium.atlassian.net/browse/CLUE-515) | Estimate remaining group doc work | To Do | Planning chore. |

### Data Card view persistence (design)

| Key | Summary | Status | Notes |
|---|---|---|---|
| [CLUE-518](https://concord-consortium.atlassian.net/browse/CLUE-518) | Data Card View Persistence | To Do | Design task: decide which of the current behaviors (persistent viewed-card across reload, teacher-visible, group-shared, table-linked selection) to keep. |

### DataFlow Simulation (Parallel Track)

The DataFlow simulation work resulted in three related plan entries: [GD-18: Settled-State Document Saves](group-docs-plan.md#gd-18-settled-state-document-saves), [GD-19: Transaction-Free History](group-docs-plan.md#gd-19-transaction-free-history), and [GD-20: Background Entries (DataFlow)](group-docs-plan.md#gd-20-background-entries-dataflow). GD-18 is a prerequisite for GD-19, which is a prerequisite for GD-20.

| Key | Summary | Status | Notes |
|---|---|---|---|
| [CLUE-379](https://concord-consortium.atlassian.net/browse/CLUE-379) | SPIKE: Run-time state for History/Group Synch | In Progress | Separates runtime state (value streams from dataflow execution) from setup state (program blocks and settings). Runtime state uses its own sync mechanism rather than history entries. Predates the formal GD-18/19/20 plan entries; the SPIKE outcome informed all three. |

### Plan area: UI / Product Features (not in technical plan)

These stories are about product features (how group documents appear, are shared, are configured) rather than the technical concurrent-editing challenges:

| Key | Summary | Status | Notes |
|---|---|---|---|
| [CLUE-360](https://concord-consortium.atlassian.net/browse/CLUE-360) | Group documents Styling in Sorts | In Design Review | Visual styling — group doc icon, group number display in sorts. |
| [CLUE-377](https://concord-consortium.atlassian.net/browse/CLUE-377) | Group documents Can be Default | To Do | Auto-create group doc for new groups. Unit setting for starting with group doc. Students see their group's doc by default. |
| [CLUE-380](https://concord-consortium.atlassian.net/browse/CLUE-380) | Group documents autoshared | In Code Review | Group docs are autoshared by default so students can see docs from previous groups. |

### Not group-doc specific (in epic but tangential)

| Key | Summary | Status |
|---|---|---|
| [CLUE-103](https://concord-consortium.atlassian.net/browse/CLUE-103) | app-header div is cut off on iPad in Safari | To Do |
| [CLUE-221](https://concord-consortium.atlassian.net/browse/CLUE-221) | Users can hide unneeded labels/tools | To Do |
| [CLUE-280](https://concord-consortium.atlassian.net/browse/CLUE-280) | New comments put history scrubber at end | To Do |
| [CLUE-336](https://concord-consortium.atlassian.net/browse/CLUE-336) | Students can comment on Curriculum | To Do |
| [CLUE-351](https://concord-consortium.atlassian.net/browse/CLUE-351) | CLUE Sort by Problem | To Do |

## Gaps: Jira stories not covered by plan

To-Do stories that the plan doesn't have a slot for. Stories that are Done or in progress are excluded — there may be other in-progress stories in the epic that aren't covered by the plan, and that's OK at this point.

| Key | Summary | Notes |
|---|---|---|
| [CLUE-315](https://concord-consortium.atlassian.net/browse/CLUE-315) | Tiles have a 'not group safe' property | Prerequisite for GD-8: Tile Locking, which is held in reserve. Only relevant if locking work is picked up. |
| [CLUE-377](https://concord-consortium.atlassian.net/browse/CLUE-377) | Group documents Can be Default | Product/UI work not covered by the technical plan; independent of the concurrent-editing infrastructure. |

## Stories by Project Charge

Stories grouped by sprint range with project charges per group (FY26 sprints throughout). Stories that span multiple sprint groups (e.g., one finishing in Sprint 15 and continuing into Sprint 16) are counted in each group they appear in; the per-project totals at the bottom count each story once.

### FY26 Sprints 5–12 (initial group-doc foundation)

- 411 Brainwaves 2: 8 stories
- (no charge): 5 stories
- 402 FlowAI: 1 story
- 407 APLUS: 1 story
- 371 MODS: 1 story
- 409 TechNexus: 1 story

### FY26 Sprints 14–15 (recent active work)

- 381 Inscriptions 2: 7 stories
- 402 FlowAI: 6 stories
- 411 Brainwaves 2: 2 stories

### FY26 Sprint 16 + Backlog (current sprint and unscheduled)

- (no charge): 21 stories
- 402 FlowAI: 6 stories
- 411 Brainwaves 2: 4 stories
- 381 Inscriptions 2: 2 stories
- 407 APLUS: 1 story
- 371 MODS: 1 story
