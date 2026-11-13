# Add a codecov.yml so PRs stop failing codecov/project on noise

**Jira**: https://concord-consortium.atlassian.net/browse/CLUE-756
**Repo**: https://github.com/concord-consortium/collaborative-learning
**Implementation Spec**: [implementation.md](implementation.md)
**Status**: **In Development**

## Overview

The repo has no Codecov configuration, so `codecov/project` fails on any drop at all, including run-to-run E2E variance and PRs that simply did not run the regression suite. This story adds a `codecov.yml` that tolerates a small drop and carries the E2E flags forward, so the project check goes red only when coverage really falls.

## Project Owner Overview

Every pull request gets a Codecov "project coverage" check. Today it fails on PRs that are fine, for two reasons: tiny random swings in how much code the browser tests happen to touch, and PRs that skip the long regression suite looking as if they lost thirteen points of coverage. Because it is red so often, people have learned to ignore it, and the release checklist literally says to.

After this change the check tolerates a small, configured drop and reuses the last known regression-suite coverage when a PR did not run that suite. A red project check then means something worth looking at, which is the only way it can catch a real coverage loss. The check on the PR's own changed lines (`codecov/patch`) is left exactly as strict as it is now.

## Background

Codecov has no configuration for this repo: no `codecov.yml`, `.codecov.yml`, or `.github/codecov.yml` exists or ever existed in git history, so it runs on its defaults. The defaults that matter are project status `target: auto` with no threshold (any decrease fails) and carryforward off for every flag.

Four flags are uploaded, all with `codecov/codecov-action@v2`:

| Flag | Workflow | When it runs |
|---|---|---|
| `jest` | `ci.yml` | every push |
| `cypress-smoke` | `ci.yml` | every push |
| `cypress-regression` | `ci-regression.yml` | a push to `master`, or a push to a branch whose PR has the `run regression` label |
| `cypress` | `regression-daily.yml`, `manual-regression.yml` | nightly against `master` HEAD (cron `0 0 * * *`), or a manual dispatch |

Codecov's public API lists exactly these four flags for the repo.

**Problem 1, E2E variance.** Measured across 197 merged PRs since May 2026 (Codecov API `pulls/?state=merged`): of the 112 where both base and head had a complete set of uploads, 109 moved by between -0.09 and +0.27 points, and one rose by 12.46. CLUE-717 (#3049) failed at -0.05 and CLUE-738 (#3054) at -0.01 with `codecov/patch` at 100% on both. The two larger drops in that set were real: #2906 (CLUE-566's AI tutor spike, -0.50) and #2898 (CLUE-535, -0.22) each added several hundred lines with under half of them covered.

**Problem 2, missing uploads.** 36 of those 197 PRs had a head with two or fewer uploads, which is what an unlabeled PR looks like (`jest` and `cypress-smoke` only). Against a complete base, 33 of them read between -12.9 and -17.5 points. Recent `master` commits show the same split directly: a merge commit that got the nightly run has 24 sessions (`jest` 1, `cypress-smoke` 1, `cypress-regression` 15, `cypress` 7), one without the nightly has 17, and a branch commit with no label has 2 at 75%. #3081 (CLUE-773) is a current example: `codecov/project` failure at 75.06% (-12.89%), `codecov/patch` success at 98.90%, and the Codecov comment reports "HEAD has 15 uploads less than BASE" for `cypress-regression`.

The `cypress` flag adds almost nothing on top of `cypress-regression` (69.64% against 69.66% on the same commit).

**Why the PR's own branch is the test.** Codecov "will always use the current YAML on the branch being tested", so the story's own PR is processed with the new file and shows the effect before merge.

## Requirements

- **R1.** A `codecov.yml` exists at the repository root. It is the only Codecov configuration in the repo.
- **R2.** The project status keeps `target: auto` (compare against the base commit) and allows a drop of up to 0.2 points (`threshold: 0.2%`) before failing.
- **R3.** The project status stays a real pass/fail check: it is not marked `informational`.
- **R4.** The patch status keeps its current behavior: its target is the base commit's project coverage and it allows no drop below it. Observable as a `codecov/patch` title of the form `NN.NN% of diff hit (target BB.BB%)`, where `BB.BB` is the base commit's project coverage.
- **R5.** Carryforward is on for the `cypress`, `cypress-regression` and `cypress-smoke` flags, so a commit that uploads no report for one of them reuses that flag's coverage from its parent commit instead of counting it as missing. Carryforward is off for `jest`.
- **R6.** Codecov's validator accepts the file: `curl -s -X POST --data-binary @codecov.yml https://codecov.io/validate` prints `Valid!`.
- **R7.** Release guidance that tells readers to ignore Codecov is updated. `.claude/skills/releasing-clue/preparing.md` ("its checks fail on almost every PR; ignore them when judging readiness") no longer says the checks are routine noise. It does not restate the threshold; `codecov.yml` is the one place that value lives.
- **R8.** On the story's own PR, pushed without the `run regression` label: `codecov/project` passes; the head commit has `cypress-regression` sessions although no regression job ran on it (`https://api.codecov.io/api/v2/github/concord-consortium/repos/collaborative-learning/totals/?sha=<head>&flag=cypress-regression` reports `sessions` above 0, where an unlabeled head reports 0 today); and `codecov/patch` meets R4. The PR description records the two check titles.
- **R9.** A Jest test fails when the flags `codecov.yml` carries forward stop matching the flags the workflows upload (every uploaded flag except `jest`), so renaming or adding an upload cannot silently disable carryforward for it.

## Technical Notes

- **Status names.** Codecov reports through GitHub check runs named `codecov/project` and `codecov/patch` (not commit statuses). Their output titles have the form `75.06% (-12.89%) compared to <base sha>` and `98.90% of diff hit (target 87.95%)`, which is where R8's results are read from.
- **Threshold units.** The threshold is in percentage points. Codecov's project status (`_get_project_status` in `apps/worker/services/notification/notifiers/mixins/status.py`, `codecov/umbrella`) strips the `%` and passes when `head_coverage >= target_coverage - threshold`.
- **Carryforward mechanics** (read from Codecov's worker source, `apps/worker/services/report/__init__.py` and `services/processing/merging.py` in `codecov/umbrella`):
  - When a commit's first upload arrives, Codecov builds its starting report by copying every carryforward-enabled flag's sessions from the nearest ancestor whose report is complete, looking up to 10 commits back, and shifts their line numbers by the diff between the two commits.
  - "Parent" is the nearest ancestor Codecov has seen, not the git parent, so commits that never got an upload (such as all but the last of several pushed together) are skipped over. On CLUE-773's branch, Codecov records one commit's parent as the commit six back, because none of the five in between has a Codecov report.
  - Carried sessions keep their flag, so a commit that carried a flag passes it on. On `master` the nightly `cypress` data therefore carries across every commit until the next nightly, and an unlabeled PR inherits `cypress-regression` from the `master` commit it branched from.
  - When an upload for a carryforward flag arrives, every carried session for that flag is deleted (`clear_carryforward_sessions`). A commit that uploads a flag uses only its own uploads for it.
  - A commit with no `codecov.yml` of its own gets the copy Codecov stores from `master` (`get_final_yaml` in `codecov/shared`'s `shared/yaml/user_yaml.py` falls back to the repo YAML, which `save_repo_yaml_to_database_if_needed` in `apps/worker/services/yaml/__init__.py` updates from each processed `master` commit). Once the file is on `master`, a PR branched before the merge therefore gets the threshold and carryforward on its next push. Its carryforward copies from the branch's own previous commit, though, which on an unlabeled PR has no `cypress-regression`, so such a PR still reads about 13 points down until it is rebased onto `master` or runs the regression suite. Merging `master` in does not help: Codecov records a merge commit's parent as its first parent, the branch's own commit.
- **Omitting `patch` keeps today's patch status.** Codecov deep-merges the repo YAML over its site defaults (`merge_yamls` in `codecov/shared`'s `shared/yaml/user_yaml.py`), and the defaults include `coverage.status.patch: true` and `codecov.notify.wait_for_ci: true`. A file that configures only `coverage.status.project` leaves `codecov/patch` exactly as it is.
- **Carried flags in the PR comment.** Codecov's docs: "By default, any flags that are carried forward will **not** show up in the pull request" comment. R8 is therefore read from the Codecov commit page or API (per-flag totals on the head commit), not from the comment's flag table.
- **Patch and carried data.** Carried sessions are shifted by the diff, so lines a PR adds have no carried coverage. An unlabeled PR's new lines are covered by `jest` and `cypress-smoke` only, today and with carryforward, so its patch figure is unchanged.
- **Validator.** `https://codecov.io/validate` accepts a POST of the file and returns `Valid!` plus the parsed config, or an error naming the bad key (a misspelled `thresold` returns `unknown field`). The planned file in implementation.md returns `Valid!`.
- **The planned file, run through Codecov's own logic.** The validator's parsed output for the planned file, merged over `LEGACY_DEFAULT_SITE_CONFIG` with `merge_yamls` and then queried with `UserYaml.flag_has_carryfoward` (both lifted verbatim from `codecov/shared`), gives `patch: true`, the project threshold, carryforward on for the three Cypress flags and off for `jest`. The org predates the 2024-04-30 switch to patch-centric defaults (it has a project status today), so the legacy defaults are the ones that apply.
- **Every push uploads.** `ci.yml` and `ci-regression.yml` have no path filters, so a PR whose diff is only `codecov.yml` and docs still runs Jest and the smoke test and uploads, which R8 needs.
- **Other configuration layers.** Codecov merges an organization-wide Global YAML under the repo file, with the repo file winning on conflicts. Today's behavior (fail at -0.01, no carryforward) shows nothing relevant is set globally.
- **Docs left alone.** `README.md` ("Codecov will report on whether a given PR increases or decreases overall coverage") and `docs/project-overview.md` ("Coverage tracking via Codecov") stay true. `.claude/skills/releasing-clue/releases/7.6.0.md` and `7.7.0.md` are records of past releases and are not edited.
- **No deploy timing callout.** The change touches no Firebase functions, rules or indexes.

## Out of Scope

- **Partial regression uploads.** `ci-regression.yml`'s matrix containers upload only when they succeed, so a commit where one container fails gets a partial `cypress-regression` flag. Carryforward does not help (the first upload deletes the carried sessions), and each failed container costs roughly 0.6 to 1 point: on #3075's branch one failed container read -0.64 and two read -1.69 and -2.10, and #3040's head read -1.19 with 13 of 15 `cypress-regression` uploads. CI is already red on those commits, so the noise coincides with a real failure.
- **A PR pushed while its `master` parent is still uploading.** Carryforward copies from the parent as it stands when the PR commit's first upload arrives. Once `codecov.yml` is on `master`, a merge commit holds the `cypress-regression` data carried from its own parent until its first own regression upload replaces it, so only a branch whose first upload lands while some but not all of the parent's containers have uploaded inherits a partial flag, with the drop described above. The story's own PR is the exception: its `master` parent predates the file and carries nothing, so if its regression containers have not uploaded yet the PR inherits no `cypress-regression` and reads about 13 points down. A parent whose `CI Regression` run was canceled by the next push to `master` (`cancel-in-progress` in `ci-regression.yml`) may never get those uploads: since 2026-09-01, 5 of 86 first-parent `master` commits had the run canceled, 4 of them with no `cypress-regression` upload. A PR on such a parent compares level with its equally empty base, so `codecov/project` passes, but it inherits no `cypress-regression` and cannot show R8. The next push on the branch carries from the branch's own commit, which has the same gap, so it persists until the branch is rebased onto a later `master` commit or runs the regression suite.
- **Single-spec manual runs.** `manual-regression.yml`'s `single-test` job uploads one spec's coverage as `cypress`, which replaces the carried nightly data on that commit and its descendants until the next full upload. The effect on the project figure is negligible because `cypress-regression` covers the same lines.
- **Showing carried-forward flags in the PR comment** (`comment.show_carryforward_flags`). Codecov hides them by default; turning it on is a presentation choice nobody has asked for.
- **Upgrading `codecov/codecov-action@v2`,** adding path `ignore` rules, per-flag statuses, or changing which workflows upload which flags.
- **Making the regression suite run on every PR.**

## Open Questions

### RESOLVED: What should the project threshold be?
**Context**: The ticket suggests "somewhere around 0.5%" and says it is unvalidated. The history above gives the noise floor: complete-vs-complete PRs moved by -0.09 at worst, and the only two larger drops were real (-0.22 and -0.50, both under-tested new code). `codecov/patch` already catches under-tested new lines, so the project check's distinct job is coverage lost outside the diff, such as deleted or disabled tests. At today's ~64,400 tracked lines, 0.5 points is about 320 lines of lost coverage and 0.2 points about 130.
**Options considered**:
- A) 0.5%, as the ticket suggests. Passes every PR in the measured history, including CLUE-566's -0.50 spike.
- B) 0.2%. More than twice the worst observed noise; would have failed CLUE-535's -0.22, which was a real drop.
- C) 0.1%. Just above the worst observed noise; leaves almost no margin for noise not yet seen.

**Decision**: B, 0.2% (Doug). It clears all observed noise with margin and still catches drops of the size that have actually happened.

### RESOLVED: Judgment call: mark the project status `informational`?
**Options considered**:
- A) No: keep it a failing check.
- B) Yes: report the number but always pass.

**Decision**: A. The ticket's motivation is that an always-ignored check cannot catch a real regression. Once both noise sources are handled, an informational check would throw that away.

### RESOLVED: Judgment call: carry `jest` forward too?
**Options considered**:
- A) No: only the three Cypress flags, as the ticket lists.
- B) Yes: every flag.

**Decision**: A. `jest` uploads on every push, so it is only missing when the Jest job failed, and then CI is already red. Carrying it forward would show stale unit coverage on a commit whose tests did not run.

### RESOLVED: Judgment call: update the releasing-clue guidance in this story?
**Options considered**:
- A) Yes: reword the one line in `preparing.md`.
- B) No: leave it for whoever next edits the skill.

**Decision**: A. The line describes the exact behavior this story removes, and it is the guidance that tells release prep to ignore the check. Leaving it would keep training people to ignore it.

## Self-Review

Resolved findings by review round. Each was confirmed against the workflows, Codecov's API for this repo, Codecov's worker source, or GitHub check runs.

### Drafting (CI/DevOps engineer, QA engineer, release manager, senior engineer)
- RESOLVED: **Whether omitting `patch` disables the patch status was unverified.** It does not: `merge_yamls` keeps the `patch: true` default (Technical Notes).
- RESOLVED: **Carryforward timing and partial uploads were not described.** Both consequences are in Out of Scope.
- RESOLVED: **Multi-commit pushes looked like they would break carryforward.** Codecov records the nearest uploaded ancestor as the parent (Technical Notes).
- RESOLVED: **R4 and R8 were not observable.** Each names the check title or API value to read.
- RESOLVED: **R9 goes beyond the ticket.** Added because the flag names live in both the workflows and `codecov.yml`; Doug chose to keep it.

### Round 1 (CI/DevOps engineer, QA engineer, release manager, senior engineer)
- RESOLVED: **Merging `master` into an open branch was said to start carryforward.** Codecov records the first parent as the parent, so only a rebase or a regression run helps.
- RESOLVED: **Threshold units were left open.** Percentage points, per `_get_project_status`.
- RESOLVED: **The flag table said every upload comes from a push.** Dropped; the table says when each flag runs.

### Round 2 (Codecov platform specialist, coverage data analyst, maintainer)
- RESOLVED: **The in-flight parent gap was described as permanent.** After the merge it shrinks to a partial-upload window; the full gap applies only to the story's own PR.
- RESOLVED: **Partial-upload cost was understated and misquoted.** Out of Scope gives the per-container cost with #3040 and #3075.

### Round 3 (implementer, future maintainer)
No findings in this file.

### Round 4 (contributor with an open PR, requirements-only reader, spec consistency)
- RESOLVED: **PRs branched before the merge were said to keep today's behavior.** A commit with no `codecov.yml` gets Codecov's stored `master` copy, so they get the threshold on their next push; unlabeled ones still fail until rebased (Technical Notes).

### Round 5 (Codecov source auditor, CI history analyst)
- RESOLVED: **A `master` parent whose regression run was canceled was not covered.** `ci-regression.yml` cancels an in-progress run on the next push, which left 4 recent `master` commits with no `cypress-regression`; the story's-own-PR exception in Out of Scope now names it.
