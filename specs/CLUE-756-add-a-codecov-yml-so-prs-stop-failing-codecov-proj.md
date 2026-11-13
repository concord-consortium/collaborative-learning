# Add a codecov.yml so PRs stop failing codecov/project on noise

**Jira**: https://concord-consortium.atlassian.net/browse/CLUE-756

**Status**: **Closed**

## Overview

The repo had no Codecov configuration, so `codecov/project` failed on any drop at all, including run-to-run E2E variance and PRs that simply did not run the regression suite. This story adds a `codecov.yml` that tolerates a small drop and carries the E2E flags forward, so the project check goes red only when coverage really falls.

## Requirements

- **R1.** A `codecov.yml` exists at the repository root. It is the only Codecov configuration in the repo.
- **R2.** The project status keeps `target: auto` (compare against the base commit) and allows a drop of up to 0.2 points (`threshold: 0.2%`) before failing.
- **R3.** The project status stays a real pass/fail check: it is not marked `informational`.
- **R4.** The patch status keeps its current behavior: its target is the base commit's project coverage and it allows no drop below it. Observable as a `codecov/patch` title of the form `NN.NN% of diff hit (target BB.BB%)`, where `BB.BB` is the base commit's project coverage.
- **R5.** Carryforward is on for the `cypress`, `cypress-regression` and `cypress-smoke` flags, so a commit that uploads no report for one of them reuses that flag's coverage from its parent commit instead of counting it as missing. Carryforward is off for `jest`.
- **R6.** Codecov's validator accepts the file: `curl -s -X POST --data-binary @codecov.yml https://codecov.io/validate` prints `Valid!`.
- **R7.** `.claude/skills/releasing-clue/preparing.md` no longer says the Codecov checks are routine noise to ignore. It does not restate the threshold; `codecov.yml` is the one place that value lives.
- **R8.** On the story's own PR, pushed without the `run regression` label: `codecov/project` passes; the head commit has `cypress-regression` sessions above 0 although no regression job ran on it (read from `https://api.codecov.io/api/v2/github/concord-consortium/repos/collaborative-learning/totals/?sha=<head>&flag=cypress-regression`); and `codecov/patch` meets R4. The PR description records the two check titles. *(Checked after the push; see Not Yet Implemented.)*
- **R9.** A Jest test (`src/test/codecov-config.test.ts`) fails when the flags `codecov.yml` carries forward stop matching the flags the workflows upload (every uploaded flag except `jest`), so renaming or adding an upload cannot silently disable carryforward for it.

## Technical Notes

- **Flags.** `jest` and `cypress-smoke` upload from `ci.yml` on every push; `cypress-regression` from `ci-regression.yml` on `master` or when the PR has the `run regression` label; `cypress` from `regression-daily.yml` (nightly) and `manual-regression.yml` (dispatch).
- **Measured noise.** Across 197 merged PRs since May 2026, 109 of the 112 with complete uploads on both sides moved between -0.09 and +0.27 points; the larger drops were real (#2898 -0.22, #2906 -0.50). 33 of 36 unlabeled heads (two uploads) read 12.9 to 17.5 points down against a complete base.
- **Status names.** Codecov reports through GitHub check runs named `codecov/project` and `codecov/patch`, with titles like `75.06% (-12.89%) compared to <sha>` and `98.90% of diff hit (target 87.95%)`.
- **Threshold units.** Percentage points: the project status passes when `head_coverage >= target_coverage - threshold` (`_get_project_status` in `codecov/umbrella`).
- **Omitting `patch` keeps today's patch status.** Codecov deep-merges the repo YAML over site defaults that include `coverage.status.patch: true` (`merge_yamls` in `codecov/shared`). The org predates the 2024 patch-centric defaults, so the legacy defaults apply.
- **Carryforward mechanics** (Codecov worker source):
  - At a commit's first upload, carryforward flags' sessions are copied from the nearest complete ancestor (up to 10 back), shifted by the diff between the two commits.
  - The recorded parent is the nearest ancestor Codecov has seen; for a merge commit, its first parent.
  - An upload for a carryforward flag deletes that flag's carried sessions (`clear_carryforward_sessions`).
  - Carried sessions keep their flag, so the nightly `cypress` data carries across `master` until the next nightly.
- **Which YAML applies.** A commit uses its own `codecov.yml`; one without it gets the copy stored from the latest processed `master` commit. A PR branched before the merge gets the threshold on its next push, but an unlabeled one still reads about 13 points down until rebased onto `master` (merging `master` in does not help).
- **Carried flags in the PR comment** are hidden by default, so R8 is read from the API, not the comment.
- **Patch and carried data.** Lines a PR adds have no carried coverage, so an unlabeled PR's patch figure is unchanged.
- **Agreement test.** It reads the workflows and `codecov.yml` as text, so no YAML parser dependency is added. A per-file upload count fails the test on an upload step its regex cannot read (such as `token:` before `flags:`, or no `flags:` at all), and a `carryforward:` count fails it on carryforward set through `default_rules` or a top-level `flags:` key.
- **Docs left alone.** `README.md` and `docs/project-overview.md` stay true; `releases/7.6.0.md` and `7.7.0.md` are past-release records.
- **No deploy timing callout.** No Firebase functions, rules or indexes change.

## Out of Scope

- **Partial regression uploads.** A failed `ci-regression.yml` container skips its upload, giving a partial `cypress-regression` flag that carryforward cannot fill (the first upload deletes the carried sessions). Each failed container costs roughly 0.6 to 1 point, on commits where CI is already red.
- **A PR pushed while its `master` parent is still uploading, or whose parent's `CI Regression` run was canceled** (`cancel-in-progress`; 5 of 86 recent `master` commits). The PR inherits a partial or missing `cypress-regression` until rebased onto a later `master` commit or run with the regression suite.
- **Single-spec manual runs** replace the carried `cypress` data with one spec's coverage; negligible, since `cypress-regression` covers the same lines.
- **Showing carried-forward flags in the PR comment** (`comment.show_carryforward_flags`).
- **Upgrading `codecov/codecov-action@v2`,** path `ignore` rules, per-flag statuses, or changing which workflows upload which flags.
- **Making the regression suite run on every PR.**

## Not Yet Implemented

- **R8, verifying on the PR.** It needs the branch pushed (both commits together, without the `run regression` label) and the PR open. After `CI Base` finishes, read the head's `codecov` check runs and the per-flag totals from the Codecov API, and copy the two check titles into the PR description. If `cypress-regression` has 0 sessions, compare the head's recorded Codecov parent with the merge base. A parent whose regression uploads were in flight or whose run was canceled is the known gap above: rebase onto a `master` commit whose regression run has uploaded, then force-push.

## Decisions

### What should the project threshold be?
**Context**: The ticket suggested about 0.5%, unvalidated. Observed noise peaked at -0.09; the only larger drops were real (-0.22 and -0.50). At about 64,400 tracked lines, 0.2 points is about 130 lines of lost coverage.
**Options considered**:
- A) 0.5%, as the ticket suggests.
- B) 0.2%.
- C) 0.1%.

**Decision**: B, 0.2% (Doug). It clears all observed noise with margin and still catches drops of the size that have actually happened.

---

### Mark the project status `informational`?
**Options considered**:
- A) No: keep it a failing check.
- B) Yes: report the number but always pass.

**Decision**: A. An always-ignored check cannot catch a real regression; with both noise sources handled, informational would throw that away.

---

### Carry `jest` forward too?
**Options considered**:
- A) No: only the three Cypress flags.
- B) Yes: every flag.

**Decision**: A. `jest` uploads on every push, so it is missing only when the Jest job failed and CI is already red. Carrying it would show stale unit coverage.

---

### Update the releasing-clue guidance in this story?
**Options considered**:
- A) Yes: reword the one line in `preparing.md`.
- B) No: leave it for the next edit of the skill.

**Decision**: A. The line describes the behavior this story removes, and it is what tells release prep to ignore the check.

---

### Add a test asserting the flag lists agree (R9)?
**Context**: Beyond the ticket. The flag names now live in both the workflows and `codecov.yml`.
**Options considered**:
- A) Keep the agreement test.
- B) Drop it.

**Decision**: A (Doug). A renamed or new upload would otherwise silently lose carryforward.

---

### One commit or two?
**Options considered**:
- A) `codecov.yml` and the `preparing.md` line in one commit.
- B) Two commits.

**Decision**: B. The config is the behavior change and the doc line is prose about it; either can be reverted or reworded alone.

---

### Push the spec commit with the implementation, not alone?
**Context**: Only a push's last commit gets uploads. A spec commit pushed and uploaded on its own has no `codecov.yml`, so every later branch commit would carry forward from it and inherit no `cypress-regression`.

**Decision**: Push the branch for the first time with all its commits together.
