# Group Documents: Jira Stories ↔ Plan Mapping

This document maps the Jira stories under the CLUE-312 "Group Document" epic to the areas in `group-docs-plan.md`, and identifies gaps in both directions.

## Stories by Project Charge

| Key | Summary | Status | Charged To |
|---|---|---|---|
| CLUE-313 | SPIKE: Documents for Groups | Done | 411 Brainwaves 2 |
| CLUE-314 | Group documents visible in Sorts | Done | 411 Brainwaves 2 |
| CLUE-316 | Group documents Text Tiles | To Do | 411 Brainwaves 2 |
| CLUE-320 | Sorts allows cycle through in Document View | Done | 411 Brainwaves 2 |
| CLUE-325 | Group Organization + | Done | 411 Brainwaves 2 |
| CLUE-340 | Group documents Tile list/arrangement/focus | To Do | 411 Brainwaves 2 |
| CLUE-341 | Group documents live update to all viewers | Done | 411 Brainwaves 2 |
| CLUE-347 | Documents for Groups | Done | 411 Brainwaves 2 |
| CLUE-360 | Group documents Styling in Sorts | To Do | 411 Brainwaves 2 |
| CLUE-365 | Refactor SortedDocuments behind Sort Work tab | Done | 411 Brainwaves 2 |
| CLUE-368 | Extract Firestore history saving | Done | 411 Brainwaves 2 |
| CLUE-452 | Merge Group Docs to master | Done | 411 Brainwaves 2 |
| CLUE-317 | Group documents Locked tiles: Program Tiles | To Do | 402 FlowAI |
| CLUE-321 | Sorted view allows n-up display | Done | 402 FlowAI |
| CLUE-379 | Run-time state for History/Group Synch | To Do | 402 FlowAI |
| CLUE-377 | Group documents Can be Default | To Do | 381 Inscriptions 2 |
| CLUE-378 | Group documents author name | To Do | 381 Inscriptions 2 |
| CLUE-327 | Summarize user testing | Done | 407 APLUS |
| CLUE-351 | CLUE Sort by Problem | To Do | 407 APLUS |
| CLUE-221 | Users can hide unneeded labels/tools | To Do | 371 MODS |
| CLUE-348 | >4 in Groups and New UI | Done | 371 MODS |
| CLUE-354 | SPIKE: Review Accessibility Dashboard | Done | 409 TechNexus |
| CLUE-103 | app-header div is cut off on iPad in Safari | To Do | *(none)* |
| CLUE-280 | New comments put history scrubber at end | To Do | *(none)* |
| CLUE-315 | Tiles have a 'not group safe' property | To Do | *(none)* |
| CLUE-318 | Group documents Sim Tiles | To Do | *(none)* |
| CLUE-319 | Group documents Graph Tiles | To Do | *(none)* |
| CLUE-336 | Students can comment on Curriculum | To Do | *(none)* |
| CLUE-349 | Group documents Table Tiles | To Do | *(none)* |
| CLUE-362 | Unit option to enable Group Documents | Done | *(none)* |
| CLUE-366 | Demo space "CLUE" isn't showing all docs | Done | *(none)* |
| CLUE-376 | Group documents have sequential history | Done | *(none)* |
| CLUE-380 | Group documents autoshared | To Do | *(none)* |
| CLUE-385 | History view showing the list of history entries | Done | *(none)* |
| CLUE-386 | Make Cypress tests more robust | Done | *(none)* |

**Summary by project:**
- **411 Brainwaves 2**: 12 stories (most of the core group doc infrastructure + sorts UI)
- **402 FlowAI**: 3 stories (tile locking for program tiles, runtime state, n-up display)
- **381 Inscriptions 2**: 2 stories (group doc as default, author name display)
- **407 APLUS**: 2 stories (user testing, sort by problem)
- **371 MODS**: 2 stories (hide labels, >4 groups UI)
- **409 TechNexus**: 1 story (accessibility spike)
- **No charge**: 13 stories

## Completed Stories

| Key | Summary | Maps To |
|---|---|---|
| CLUE-313 | SPIKE: Documents for Groups | GD-1 |
| CLUE-347 | Documents for Groups | GD-1 |
| CLUE-348 | >4 in Groups and New UI | GD-1 (UI) |
| CLUE-362 | Unit option to enable Group Documents | GD-1 (configuration) |
| CLUE-314 | Group documents visible in Sorts | UI/Sorts |
| CLUE-320 | Sorts allows cycle through in Document View | UI/Sorts |
| CLUE-321 | Sorted view allows n-up display | UI/Sorts |
| CLUE-325 | Group Organization + | Design |
| CLUE-327 | Summarize user testing | Design |
| CLUE-341 | Group documents live update to all viewers | GD-2 |
| CLUE-368 | Extract Firestore history saving from history system | GD-2 (infrastructure) |
| CLUE-376 | Group documents have sequential history | GD-5 (transactions) |
| CLUE-385 | History view showing the list of history entries | GD-4 |
| CLUE-354 | SPIKE: Review Accessibility Dashboard | Not group-doc specific |
| CLUE-365 | Refactor SortedDocuments behind Sort Work tab | Chore |
| CLUE-366 | Demo space "CLUE" isn't showing all docs | Bug fix |
| CLUE-386 | Make Cypress tests creating new documents more robust | Test chore |
| CLUE-452 | Merge Group Docs to master | Chore |

## Open Stories Mapped to Plan

### Plan area: UI Disruption Testing (Immediate)

| Key | Summary | Status | Notes |
|---|---|---|---|
| [CLUE-483](https://concord-consortium.atlassian.net/browse/CLUE-483) | Group documents: UI disruption testing | To Do | Created to fill this gap. Sprint 14, charged to Inscriptions 2. |

### Plan area: Fix Undo Rendering Bugs (A1/B1)

| Key | Summary | Status | Notes |
|---|---|---|---|
| [CLUE-484](https://concord-consortium.atlassian.net/browse/CLUE-484) | Group documents: Fix undo rendering bugs | To Do | Created to fill this gap. Sprint 15. |

### Plan area: Finish GD-5 — Fork Detection and Rollback (A2/B2)

| Key | Summary | Status | Notes |
|---|---|---|---|
| [CLUE-485](https://concord-consortium.atlassian.net/browse/CLUE-485) | Group documents: Prevent document corruption from simultaneous edits | To Do | Created to fill this gap. Sprint 14, charged to Inscriptions 2. CLUE-376 covered the transaction infrastructure (done); this covers the remaining rollback logic. |

### Plan area: Tile Locking (B3 — only if disruptions are not tolerable)

| Key | Summary | Status | Notes |
|---|---|---|---|
| [CLUE-315](https://concord-consortium.atlassian.net/browse/CLUE-315) | Tiles have a 'not group safe' property | To Do | Tiles can be annotated as not group-safe (code level or unit JSON). This is a prerequisite for locking — identifying which tiles need it. |
| [CLUE-317](https://concord-consortium.atlassian.net/browse/CLUE-317) | Group documents Locked tiles: Program Tiles | To Do | Locking specifically for program (dataflow) tiles. Includes lock visual annotation, hardware pairing lock, and synchronized read-only view. Most detailed locking story. |

### Plan area: Smarter Conflict Merging (A3/B4)

| Key | Summary | Status | Notes |
|---|---|---|---|
| [CLUE-340](https://concord-consortium.atlassian.net/browse/CLUE-340) | Group documents Tile list/arrangement/focus | To Do | "All users can add tiles... Last student to add a tile will 'win' the layout, but all tiles will be saved." This is document-level merging — tile additions shouldn't conflict with each other. |

### Plan area: Shared Model Conflict Resolution (A4/B5)

| Key | Summary | Status | Notes |
|---|---|---|---|
| [CLUE-486](https://concord-consortium.atlassian.net/browse/CLUE-486) | Group documents: Shared model conflict resolution | To Do | Created to fill this gap. Sprint 15. The per-tile stories (CLUE-316, 318, 319, 349) imply concurrent shared model editing but this covers the underlying merge infrastructure. |

### Plan area: Per-Tile Resilience / Hardening (A5/B6)

| Key | Summary | Status | Notes |
|---|---|---|---|
| [CLUE-316](https://concord-consortium.atlassian.net/browse/CLUE-316) | Group documents Text Tiles | To Do | Students can edit distinct text tiles; same-tile edits have "last student wins". |
| [CLUE-318](https://concord-consortium.atlassian.net/browse/CLUE-318) | Group documents Sim Tiles | To Do | Each sim control change recorded in history. Simultaneous edits: "last student wins". |
| [CLUE-319](https://concord-consortium.atlassian.net/browse/CLUE-319) | Group documents Graph Tiles | To Do | "Multiple students can edit the same or multiple graphs." Minimal description. |
| [CLUE-349](https://concord-consortium.atlassian.net/browse/CLUE-349) | Group documents Table Tiles | To Do | "Multiple students can edit the same or multiple tables." Minimal description. |

### Plan area: DataFlow Simulation (Parallel Track)

| Key | Summary | Status | Notes |
|---|---|---|---|
| [CLUE-379](https://concord-consortium.atlassian.net/browse/CLUE-379) | Run-time state for History/Group Synch | To Do | Separates runtime state (value streams from dataflow execution) from setup state (program blocks and settings). Runtime state uses its own sync mechanism rather than history entries. This directly addresses the DataFlow simulation problem in the plan. |

### Plan area: UI / Product Features (not in technical plan)

These stories are about product features (how group documents appear, are shared, are configured) rather than the technical concurrent-editing challenges:

| Key | Summary | Status | Notes |
|---|---|---|---|
| [CLUE-360](https://concord-consortium.atlassian.net/browse/CLUE-360) | Group documents Styling in Sorts | To Do | Visual styling — group doc icon, group number display in sorts. |
| [CLUE-377](https://concord-consortium.atlassian.net/browse/CLUE-377) | Group documents Can be Default | To Do | Auto-create group doc for new groups. Unit setting for starting with group doc. Students see their group's doc by default. |
| [CLUE-378](https://concord-consortium.atlassian.net/browse/CLUE-378) | Group documents author name | To Do | Group docs show "Group N" as author in sorts. |
| [CLUE-380](https://concord-consortium.atlassian.net/browse/CLUE-380) | Group documents autoshared | To Do | Group docs are autoshared by default so students can see docs from previous groups. |

### Not group-doc specific (in epic but tangential)

| Key | Summary | Status |
|---|---|---|
| [CLUE-103](https://concord-consortium.atlassian.net/browse/CLUE-103) | app-header div is cut off on iPad in Safari | To Do |
| [CLUE-221](https://concord-consortium.atlassian.net/browse/CLUE-221) | Users can hide unneeded labels/tools | To Do |
| [CLUE-280](https://concord-consortium.atlassian.net/browse/CLUE-280) | New comments put history scrubber at end | To Do |
| [CLUE-336](https://concord-consortium.atlassian.net/browse/CLUE-336) | Students can comment on Curriculum | To Do |
| [CLUE-351](https://concord-consortium.atlassian.net/browse/CLUE-351) | CLUE Sort by Problem | To Do |

---

## New Stories Created for Plan Gaps

| Key | Summary | Sprint | Assigned | Charged To | Plan Area |
|---|---|---|---|---|---|
| [CLUE-483](https://concord-consortium.atlassian.net/browse/CLUE-483) | Group documents: UI disruption testing | FY26 Sprint 14 | Scott Cytacki | 381 Inscriptions 2 | Immediate testing |
| [CLUE-484](https://concord-consortium.atlassian.net/browse/CLUE-484) | Group documents: Fix undo rendering bugs | FY26 Sprint 15 | Unassigned | *(none)* | A1/B1 |
| [CLUE-485](https://concord-consortium.atlassian.net/browse/CLUE-485) | Group documents: Prevent document corruption from simultaneous edits | FY26 Sprint 14 | Scott Cytacki | 381 Inscriptions 2 | A2/B2 |
| [CLUE-486](https://concord-consortium.atlassian.net/browse/CLUE-486) | Group documents: Shared model conflict resolution | FY26 Sprint 15 | Unassigned | *(none)* | A4/B5 |
| [CLUE-487](https://concord-consortium.atlassian.net/browse/CLUE-487) | Group documents: Reliability and robustness fixes | *(no sprint)* | Unassigned | *(none)* | Parallel track |

## Gaps: Jira stories not covered by plan

| Key | Summary | Notes |
|---|---|---|
| [CLUE-315](https://concord-consortium.atlassian.net/browse/CLUE-315) | Tiles have a 'not group safe' property | Only relevant if Plan B (tile locking) is chosen. The plan doesn't currently discuss marking tiles as group-safe/unsafe since Plan A avoids locking. |
| [CLUE-360](https://concord-consortium.atlassian.net/browse/CLUE-360) | Group documents Styling in Sorts | Product/UI work not covered by the technical plan. |
| [CLUE-377](https://concord-consortium.atlassian.net/browse/CLUE-377) | Group documents Can be Default | Product/UI work not covered by the technical plan. |
| [CLUE-378](https://concord-consortium.atlassian.net/browse/CLUE-378) | Group documents author name | Product/UI work not covered by the technical plan. |
| [CLUE-380](https://concord-consortium.atlassian.net/browse/CLUE-380) | Group documents autoshared | Product/UI work not covered by the technical plan. |

These product/UI stories (CLUE-360, 377, 378, 380) could be done in parallel with either plan since they don't depend on the concurrent-editing infrastructure.

## Open Stories by Sprint

| Sprint | Key | Summary | Plan Area | Ordering Concern |
|---|---|---|---|---|
| **FY26 Sprint 14** | [CLUE-483](https://concord-consortium.atlassian.net/browse/CLUE-483) | UI disruption testing | Immediate | |
| | [CLUE-485](https://concord-consortium.atlassian.net/browse/CLUE-485) | Prevent document corruption from simultaneous edits | A2/B2 | |
| | [CLUE-379](https://concord-consortium.atlassian.net/browse/CLUE-379) | Run-time state for History/Group Synch | DataFlow parallel track | Independent, can be done anytime |
| **FY26 Sprint 15** | [CLUE-484](https://concord-consortium.atlassian.net/browse/CLUE-484) | Fix undo rendering bugs | A1/B1 | Both plans say this should come before A2/B2, so ideally Sprint 14 not 15 |
| | [CLUE-486](https://concord-consortium.atlassian.net/browse/CLUE-486) | Shared model conflict resolution | A4/B5 | Depends on A2/B2 and A3/B4 being done first |
| | [CLUE-340](https://concord-consortium.atlassian.net/browse/CLUE-340) | Group documents Tile list/arrangement/focus | A3/B4 (merging) | Depends on A2/B2 (fork detection) being done first |
| | [CLUE-316](https://concord-consortium.atlassian.net/browse/CLUE-316) | Group documents Text Tiles | A5/B6 (per-tile) | Should come after conflict infrastructure (A2-A4) |
| | [CLUE-317](https://concord-consortium.atlassian.net/browse/CLUE-317) | Group documents Locked tiles: Program Tiles | B3 (locking) | Only needed if Plan B; depends on UI disruption testing outcome (CLUE-483) |
| | [CLUE-318](https://concord-consortium.atlassian.net/browse/CLUE-318) | Group documents Sim Tiles | A5/B6 (per-tile) | Should come after conflict infrastructure (A2-A4) |
| | [CLUE-319](https://concord-consortium.atlassian.net/browse/CLUE-319) | Group documents Graph Tiles | A5/B6 (per-tile) | Should come after conflict infrastructure (A2-A4) |
| | [CLUE-349](https://concord-consortium.atlassian.net/browse/CLUE-349) | Group documents Table Tiles | A5/B6 (per-tile) | Should come after conflict infrastructure (A2-A4) |
| | [CLUE-315](https://concord-consortium.atlassian.net/browse/CLUE-315) | Tiles have a 'not group safe' property | B3 (locking) | Only needed if Plan B |
| | [CLUE-360](https://concord-consortium.atlassian.net/browse/CLUE-360) | Group documents Styling in Sorts | Product/UI | Independent, can be done anytime |
| | [CLUE-377](https://concord-consortium.atlassian.net/browse/CLUE-377) | Group documents Can be Default | Product/UI | Independent, can be done anytime |
| | [CLUE-378](https://concord-consortium.atlassian.net/browse/CLUE-378) | Group documents author name | Product/UI | Independent, can be done anytime |
| | [CLUE-380](https://concord-consortium.atlassian.net/browse/CLUE-380) | Group documents autoshared | Product/UI | Independent, can be done anytime |
| | [CLUE-221](https://concord-consortium.atlassian.net/browse/CLUE-221) | Users can hide unneeded labels/tools | Not group-doc specific | |
| | [CLUE-351](https://concord-consortium.atlassian.net/browse/CLUE-351) | CLUE Sort by Problem | Not group-doc specific | |
| **No sprint** | [CLUE-487](https://concord-consortium.atlassian.net/browse/CLUE-487) | Reliability and robustness fixes | Parallel track | |
| | [CLUE-103](https://concord-consortium.atlassian.net/browse/CLUE-103) | app-header div is cut off on iPad in Safari | Not group-doc specific | |
| | [CLUE-280](https://concord-consortium.atlassian.net/browse/CLUE-280) | New comments put history scrubber at end | Not group-doc specific | |
| | [CLUE-336](https://concord-consortium.atlassian.net/browse/CLUE-336) | Students can comment on Curriculum | Not group-doc specific | |

### Ordering concerns

1. **CLUE-484 (Fix undo rendering bugs)** is in Sprint 15 but both plans list it as step 1 (A1/B1), before fork detection (A2/B2 = CLUE-485 in Sprint 14). Ideally this would be Sprint 14 or earlier.

2. **CLUE-315 (not group safe property)** and **CLUE-317 (Locked tiles)** are only needed if Plan B is chosen. The UI disruption testing (CLUE-483, Sprint 14) determines this — so these shouldn't be started until that testing is complete.

3. **Per-tile stories (CLUE-316, 318, 319, 349)** and **conflict merging (CLUE-340)** depend on the conflict infrastructure (A2/B2 fork detection) being done first. These are later steps in both plans.

4. **CLUE-486 (Shared model conflict resolution)** depends on A2/B2 and A3/B4 being done first.
