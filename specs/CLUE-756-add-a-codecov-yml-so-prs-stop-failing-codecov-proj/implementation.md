# Implementation Plan: Add a codecov.yml so PRs stop failing codecov/project on noise

**Jira**: https://concord-consortium.atlassian.net/browse/CLUE-756
**Requirements Spec**: [requirements.md](requirements.md)
**Status**: **In Development**

## Implementation Plan

Two commits, then a check on the PR itself. No dependency, lockfile, workflow or app-source change.

### Add codecov.yml

**Summary**: The whole behavior change (R1 to R6), plus the test that keeps its flag list in step with the workflows (R9).

**Files affected**:
- `codecov.yml` (new)
- `src/test/codecov-config.test.ts` (new)

**Estimated diff size**: ~51 lines

```yaml
coverage:
  status:
    project:
      default:
        target: auto
        threshold: 0.2%

flag_management:
  individual_flags:
    # Cypress suites that not every commit uploads. A commit with no upload for one of
    # these reuses its last coverage instead of counting it as missing.
    - name: cypress
      carryforward: true
    - name: cypress-regression
      carryforward: true
    - name: cypress-smoke
      carryforward: true
```

`threshold: 0.2%` is the value Doug chose (requirements.md, threshold question).

Why this shape:
- **`patch` is omitted.** Codecov deep-merges this file over defaults that include `patch: true`, so `codecov/patch` keeps its current behavior (R4). Restating Codecov's defaults would make this file a second place they live.
- **`jest` is not listed.** `flag_management.default_rules.carryforward` defaults to `false`, and `flag_has_carryfoward` falls back to it for any flag not listed (R5).
- **`flag_management` rather than the top-level `flags:` key.** Both are read by `flag_has_carryfoward`; `flag_management` is the form Codecov's flags docs recommend.
- **`target: auto` is written out** although it is the default, so a reader sees what the threshold is measured against.

The flag names now live in two places, the workflows' `flags:` inputs and this file. `src/test/codecov-config.test.ts` asserts they agree, reading both as text so no YAML parser has to be added as a dependency (precedent for a test reading repo files: `src/models/stores/spikerbit-firmware-guide.test.ts`):

```ts
import fs from "fs";
import path from "path";

const kRoot = path.resolve(__dirname, "../..");
const kWorkflows = path.join(kRoot, ".github/workflows");

const uploadedFlags = () => {
  const flags = new Set<string>();
  for (const file of fs.readdirSync(kWorkflows).filter(f => /\.ya?ml$/.test(f))) {
    const text = fs.readFileSync(path.join(kWorkflows, file), "utf8");
    const uploads = text.split("uses: codecov/codecov-action@").length - 1;
    const matches = [...text.matchAll(/uses: codecov\/codecov-action@\S+\s+with:\s+flags: (\S+)/g)];
    // The regex needs `flags:` as the first key under `with:`; fail rather than skip an upload it cannot read.
    expect({ file, uploads: matches.length }).toEqual({ file, uploads });
    matches.forEach(m => flags.add(m[1]));
  }
  return flags;
};

const carriedForwardFlags = () => {
  const text = fs.readFileSync(path.join(kRoot, "codecov.yml"), "utf8");
  const matches = [...text.matchAll(/- name: (\S+)\s+carryforward: true/g)];
  // Codecov also reads carryforward from `default_rules` and a top-level `flags:` key; fail rather than miss one.
  expect(text.split("carryforward:").length - 1).toBe(matches.length);
  return new Set(matches.map(m => m[1]));
};

describe("codecov.yml", () => {
  it("carries forward every uploaded flag except jest, and nothing else", () => {
    const uploaded = uploadedFlags();
    const expected = [...uploaded].filter(f => f !== "jest").sort();
    expect([...carriedForwardFlags()].sort()).toEqual(expected);
  });
});
```

The per-file count keeps the test from skipping an upload step the regex cannot read, such as one listing `token:` before `flags:`, or one with no `flags:` at all, whose coverage could never be carried forward. The count is also why a plainer pattern matching any `flags:` line is not enough: it misses the unflagged upload. The `carryforward:` count guards `codecov.yml` the same way: `flag_has_carryfoward` reads a top-level `flags:` entry first and falls back to `flag_management.default_rules`, so a setting in either place would change carryforward without the entry regex seeing it. It passes against the planned file and the current workflows, passes `eslint` with both `.eslintrc.js` and `.eslintrc.build.js` and `tsc`, and fails under each of these mutations: a new upload step with `token:` first and a new flag; a new upload step with no `flags:`; a new `.yaml` workflow with an upload of a new flag; renaming `cypress-regression` in `ci-regression.yml`; renaming `cypress` in `regression-daily.yml` only; deleting the `cypress-smoke` entry; adding `jest` with `carryforward: true`; setting one entry to `carryforward: false`; adding `default_rules: carryforward: true`; adding a top-level `flags: cypress-regression: carryforward: false`.

**Check before committing** (R6, R9):

```bash
curl -s -X POST --data-binary @codecov.yml https://codecov.io/validate | head -1   # Valid!
npm test -- src/test/codecov-config.test.ts
```

---

### Stop telling release prep to ignore Codecov

**Summary**: R7. The release skill's rule describes the noise the previous step removes.

**Files affected**:
- `.claude/skills/releasing-clue/preparing.md`: the **Codecov** bullet under "Other rules"

**Estimated diff size**: 4 lines

Before:

```markdown
- **Codecov:** its checks fail on almost every PR; ignore them when judging readiness.
```

After:

```markdown
- **Codecov:** `codecov.yml` sets how far project coverage may drop and carries the Cypress
  flags forward for PRs that skip a suite, so a red `codecov/project` or `codecov/patch` is
  worth a look before calling a PR ready.
```

The threshold value is not repeated here (R7). The surrounding bullets in that list are hard-wrapped at about 100 columns, so the new one is too.

---

### Verify on the PR

**Summary**: R8. Not a commit: the check runs on the story's PR, which Codecov processes with the branch's own `codecov.yml`.

Push the branch for the first time with both commits on it, and open the PR **without** the `run regression` label. Only a push's last commit gets uploads, so the spec commit, which has no `codecov.yml`, must not be pushed and uploaded on its own: every later commit would carry forward from it and inherit no `cypress-regression`. Once `CI Base` finishes:

```bash
HEAD_SHA=$(gh pr view --json headRefOid -q .headRefOid)
gh api "repos/concord-consortium/collaborative-learning/commits/$HEAD_SHA/check-runs?per_page=100" \
  --jq '.check_runs[] | select(.name|test("codecov")) | [.name,.conclusion,.output.title] | @tsv'
B=https://api.codecov.io/api/v2/github/concord-consortium/repos/collaborative-learning
for f in jest cypress-smoke cypress-regression cypress; do
  printf '%-20s ' $f; curl -s "$B/totals/?sha=$HEAD_SHA&flag=$f" | jq -c '.totals | {sessions, coverage}'
done
```

Pass when:
- `codecov/project` is `success`.
- `codecov/patch`'s title reads `... (target BB.BB%)` with `BB.BB` equal to the base commit's project coverage. (A diff with no coverable lines may report no patch figure; that is not a failure of R4.)
- `cypress-regression` has `sessions` above 0. `cypress` does too if the base `master` commit had a nightly upload; it is 0 otherwise, since that commit predates the file and carried nothing forward.

Copy the two check titles into the PR description. If `cypress-regression` has 0 sessions, compare the head's recorded Codecov parent (`$B/commits/$HEAD_SHA/` → `parent`) with the merge base: a parent whose regression uploads were still in flight, or whose `CI Regression` run was canceled by a later push to `master`, is the known gap in requirements.md's Out of Scope. Another push on the branch does not recheck it, since the new commit carries from the branch's own head; rebase onto a `master` commit whose regression run has uploaded and force-push.

## Open Questions

<!-- Implementation-focused questions only. Requirements questions go in requirements.md. -->

### RESOLVED: Judgment call: one commit or two?
**Options considered**:
- A) `codecov.yml` and the `preparing.md` line in one commit.
- B) Two commits.

**Decision**: B. The config is the behavior change and the doc line is prose about it; a reviewer can revert or reword either alone.

## Self-Review

Resolved findings by review round. Each was confirmed by building the file and test in the worktree, or against Codecov's API or worker source.

### Drafting (senior engineer, test writer, commit reviewer, operator)
- RESOLVED: **Flag names duplicated between the workflows and `codecov.yml` with nothing asserting agreement.** Added R9 and the agreement test.
- RESOLVED: **The `codecov.yml` comment restated workflow schedules.** Cut to what the setting does.
- RESOLVED: **Each commit stands alone.** The first commit's test passes against its own `codecov.yml`; the second is prose about a file the first adds.

### Round 1 (CI/DevOps engineer, QA engineer, release manager, senior engineer)
- RESOLVED: **The agreement test skipped upload steps its regex could not read** (`token:` before `flags:`). Added the per-file upload count.
- RESOLVED: **Pushing the spec commit alone would make R8 fail.** "Verify on the PR" pushes all commits together.
- RESOLVED: **The R8 fallback said another push rechecks a missing carry.** It is a rebase onto `master` and a force-push.
- RESOLVED: **The `codecov.yml` comment said pushes skip these suites.** `cypress` comes from scheduled and manual runs; reworded.

### Round 2 (Codecov platform specialist, coverage data analyst, maintainer)
- RESOLVED: **The agreement test ignored `.yaml` workflows.** The filter matches both extensions.

### Round 3 (implementer, future maintainer)
- RESOLVED: **The agreement test missed carryforward set outside `individual_flags`.** As quoted, it stayed green with `default_rules: carryforward: true` (which carries `jest`) or a top-level `flags: cypress-regression: carryforward: false`, both of which Codecov's validator accepts. Added the `carryforward:` count; both mutations fail.
- RESOLVED: **The `preparing.md` step's diff size said 2 lines.** Applying it gives 3 insertions and 1 deletion.

### Round 4 (skeptical PR reviewer, spec consistency)
- RESOLVED: **Two assertions in the agreement test could not fail alone.** With `size > 1` and `has("jest")` deleted, every listed mutation still fails, so both went, with the sentence claiming they prevent a vacuous pass.
- RESOLVED: **The per-file count's real job was undocumented.** A plainer any-`flags:` pattern catches every listed mutation except a new upload with no `flags:`; the paragraph and mutation list now say so.

### Round 5 (Codecov source auditor, CI history analyst)
- RESOLVED: **The R8 fallback named only an in-flight parent.** A parent whose `CI Regression` run was canceled has no `cypress-regression` either; the fallback names both and rebases onto a commit whose regression run uploaded.
