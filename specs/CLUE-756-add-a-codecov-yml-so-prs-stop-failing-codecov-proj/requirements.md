# Add a codecov.yml so PRs stop failing codecov/project on noise

**Jira**: https://concord-consortium.atlassian.net/browse/CLUE-756
**Repo**: https://github.com/concord-consortium/collaborative-learning
**Implementation Spec**: [implementation.md](implementation.md)
**Status**: **In Development**

## Overview

The repo had no Codecov configuration, so `codecov/project` failed on any drop at all, including run-to-run E2E variance and PRs that did not run the regression suite. This story adds a `codecov.yml` that tolerates a small drop and splits coverage into a client check and a scripts check. The client checks post only once the regression suite has uploaded, and a new workflow flags a client change that is missing the `run regression` label.

## Project Owner Overview

Every pull request gets a Codecov coverage check. Today it fails on PRs that are fine, for two reasons: tiny random swings in how much code the browser tests happen to touch, and PRs that skip the long regression suite looking as if they lost thirteen points of coverage. Because it is red so often, people have learned to ignore it, and the release checklist says to.

After this change the check tolerates a small drop and only judges the client code once the full regression suite has run. A PR that changes client code without asking for the regression suite gets one clear red check saying the label is missing, instead of a misleading coverage number. A red Codecov check then means something worth looking at.

## Background

Codecov has no configuration for this repo, so it runs on its defaults: project status `target: auto` with no threshold (any decrease fails).

Four flags are uploaded, all with `codecov/codecov-action@v2`:

| Flag | Workflow | When it runs |
|---|---|---|
| `jest` | `ci.yml` | every push |
| `cypress-smoke` | `ci.yml` | every push |
| `cypress-regression` | `ci-regression.yml` (15 matrix containers, one upload each) | a push to `master`, or a push to a branch whose PR has the `run regression` label |
| `cypress` | `regression-daily.yml`, `manual-regression.yml` | nightly against `master`, or a manual dispatch |

**Problem 1, E2E variance.** Across 197 merged PRs since May 2026, 109 of the 112 with complete uploads on both sides moved between -0.09 and +0.27 points. CLUE-717 (#3049) failed at -0.05 and CLUE-738 (#3054) at -0.01 with `codecov/patch` at 100%. The two larger drops were real: #2906 (-0.50) and #2898 (-0.22) each added several hundred lines with under half covered.

**Problem 2, missing uploads.** 33 of 36 unlabeled heads (`jest` and `cypress-smoke` only) read 12.9 to 17.5 points down against a complete base.

**Why not carryforward** (the first version of this PR, replaced after code review):
- It hides a missing `run regression` label: an unlabeled PR goes green on `master`'s regression data.
- Carried hits outlive their code: Codecov shifts carried coverage by the diff, so lines the PR does not touch keep their hits even when the PR stops them running.
- `cypress-smoke` uploads on every push, the same reason `jest` was not carried.

A per-flag split (Jest vs. Cypress) does not work either: new code covered only by Jest would drag the Cypress number down.

## Requirements

- **R1.** A `codecov.yml` exists at the repository root. It is the only Codecov configuration in the repo.
- **R2.** Two project statuses, each `target: auto` with `threshold: 0.2%`:
  - `client`: paths `src/`, `shared/`, `authoring-api/src/helpers/`; flags `jest`, `cypress-smoke`, `cypress-regression`.
  - `scripts`: path `scripts/`; flag `jest`.
- **R3.** Neither project status is `informational`.
- **R4.** Two patch statuses, `client` and `scripts`, with the same paths and flags as R2 and the default target: each one's target is its own filtered base coverage, so a scripts patch is measured against scripts coverage (79.64% on `master`) rather than the overall figure.
- **R5.** No flag is carried forward. `cypress-regression` has `after_n_builds: 15`, so a status that names it does not post until the head has 15 `cypress-regression` uploads. The nightly `cypress` flag is in neither status.
- **R6.** Codecov's validator accepts the file: `curl -s -X POST --data-binary @codecov.yml https://codecov.io/validate` prints `Valid!`.
- **R7.** A pull-request workflow fails when the PR changes a file under `src/`, `shared/`, `authoring-api/src/helpers/` or `cypress/` and has neither the `run regression` nor the `skip regression` label. It passes otherwise, so a scripts-only or docs-only PR needs no label. It runs on `opened`, `synchronize`, `reopened`, `labeled`, `unlabeled` and `ready_for_review`.
- **R8.** A Jest test fails when:
  - `after_n_builds` stops matching the number of containers in `ci-regression.yml`'s matrix;
  - the label check's folder list stops matching the `client` paths plus `cypress/`;
  - a status names a flag no workflow uploads, or names the nightly `cypress` flag.
- **R9.** `.claude/skills/releasing-clue/preparing.md` no longer says to ignore Codecov, and `README.md` no longer describes a single overall-coverage report. Both name the `client` and `scripts` checks and the label check, and neither restates the threshold.
- **R10.** Verified on this PR:
  - Pushed without a label: the label check fails, `codecov/project/scripts` and `codecov/patch/scripts` post, and no `client` check posts.
  - With `run regression` added: the label check passes, and `codecov/project/client` and `codecov/patch/client` post only after all 15 `cypress-regression` uploads, both passing.
  - The PR description records the check titles.

## Technical Notes

- **Status names.** Codecov reports through GitHub check runs. A named status `client` under `project` posts as `codecov/project/client`.
- **Filtering** (`get_notifier_filters` in `apps/worker/services/notification/notifiers/checks/base.py` and `status/base.py`, `codecov/umbrella`): each status filters both head and base by its `paths` and `flags` (`FilteredComparison` in `services/comparison/__init__.py`). Within `client`, the three flags are merged, so code covered only by Jest counts as covered.
- **Waiting** (`required_builds` in `status/base.py`, used by the checks notifier too): for each flag a status names, the status is not sent (`need_more_builds`) until the head has at least that flag's `after_n_builds` sessions. Head with 0 `cypress-regression` sessions: the `client` statuses never post.
- **Patch target** (`_get_target` in `notifiers/mixins/status.py`): with no `target`, the patch target is the filtered base report's coverage.
- **Folders.** `master`'s Codecov report has 1013 files under `src/`, 72 under `shared/`, 22 under `scripts/`, and one at `authoring-api/src/helpers/github.ts`, which `src/models/image-map.ts` imports. `shared/` is in `client` because the client imports it.
- **YAML anchors.** The validator accepts `&client_paths` / `*client_paths` anchors and expands them, so the `client` and `scripts` lists are written once each.
- **No required Codecov check.** `master` requires only `Build`, `Run Jest Tests` and `cypress (1)`. A required Codecov check would block a scripts-only PR forever, since its `client` check never posts.
- **Existing `regression-label.yml`** re-runs `CI Regression` when `run regression` is added. The new label check is a separate workflow with a different job, so the two do not interact.
- **Changed files** come from the `pulls/{n}/files` API (paginated), which lists up to 3000 files.
- **Re-running a failed regression container.** A failed container skips its upload, so the head has 14 sessions and `client` does not post. "Re-run all jobs" uploads 15 more; the head then has 29, passes `after_n_builds`, and posts on the merged report.
- **No deploy timing callout.** No Firebase functions, rules or indexes change.

## Out of Scope

- **A `master` base whose `CI Regression` run was canceled** (`cancel-in-progress`; 5 of 86 recent `master` commits). Its filtered `client` report has no `cypress-regression`, so a PR on it compares against a low base and passes easily. Rebasing onto a later `master` commit fixes it.
- **Auto-including new top-level folders** with an exclusion-only `paths: ["!scripts/"]`. The explicit list is used instead; the agreement test keeps the label check in step with it.
- **Upgrading `codecov/codecov-action@v2`,** per-file `ignore` rules, or making the regression suite run on every PR.

## Open Questions

### RESOLVED: Keep the label check in this PR?
**Context**: Without it, an unlabeled client PR shows no Codecov failure at all.
**Options considered**:
- A) Keep everything in this PR and re-point the story.
- B) Keep everything in this PR at 2 points.
- C) Split the label check into a follow-up story.

**Decision**: B (Doug).

### RESOLVED: Who creates the `skip regression` label?
**Context**: The label check accepts `skip regression`, which did not exist in the repo (only `run regression`).
**Options considered**:
- A) Doug creates it before merge.
- B) Claude creates it once Doug approves.

**Decision**: B (Doug). Created in the repo with the description "A client change that does not need the regression suite".

### RESOLVED: What should the project threshold be?
**Options considered**:
- A) 0.5%, as the ticket suggests.
- B) 0.2%.
- C) 0.1%.

**Decision**: B (Doug; confirmed in code review). More than twice the worst observed noise, and it still catches drops the size of #2898 and #2906.

### RESOLVED: Mark the project status `informational`?
**Options considered**:
- A) No.
- B) Yes.

**Decision**: A. An always-passing check cannot catch a real regression.

### RESOLVED: Carryforward, or split by path and wait for the regression uploads?
**Options considered**:
- A) Carry `cypress`, `cypress-regression` and `cypress-smoke` forward (the first version of this PR).
- B) Split into `client` and `scripts` statuses, wait for `cypress-regression`'s 15 uploads, and add a label check (Scott's review).

**Decision**: B. Carryforward hid the missing label and kept stale hits; see Background.
