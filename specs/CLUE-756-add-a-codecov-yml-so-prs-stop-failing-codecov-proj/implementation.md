# Implementation Plan: Add a codecov.yml so PRs stop failing codecov/project on noise

**Jira**: https://concord-consortium.atlassian.net/browse/CLUE-756
**Requirements Spec**: [requirements.md](requirements.md)
**Status**: **In Development**

## Implementation Plan

Two commits, then a check on the PR itself. No dependency, lockfile or app-source change.

### Split the Codecov checks and require a regression label on client changes

**Summary**: R1 to R8. The config, the label check, and the test that keeps them in step go in one commit, because the test reads all three.

**Files affected**:
- `codecov.yml` (new)
- `.github/workflows/regression-label-check.yml` (new)
- `src/test/codecov-config.test.ts` (new)

**Estimated diff size**: ~120 lines

```yaml
coverage:
  status:
    project:
      client:
        target: auto
        threshold: 0.2%
        # shared/ and the authoring-api helper are here because the client imports them.
        paths: &client_paths ["src/", "shared/", "authoring-api/src/helpers/"]
        # Listing the flags waits for cypress-regression's after_n_builds and omits the nightly `cypress` flag.
        flags: &client_flags [jest, cypress-smoke, cypress-regression]
      scripts:
        target: auto
        threshold: 0.2%
        paths: &scripts_paths ["scripts/"]
        flags: &scripts_flags [jest]
    patch:
      client:
        paths: *client_paths
        flags: *client_flags
      scripts:
        paths: *scripts_paths
        flags: *scripts_flags

flag_management:
  individual_flags:
    # One upload per container in ci-regression.yml's matrix.
    - name: cypress-regression
      after_n_builds: 15
```

The anchors keep each path and flag list in one place; the validator expands them (`Valid!`, with the patch statuses showing the same lists as the project ones).

`.github/workflows/regression-label-check.yml`:

```yaml
name: Regression Label Check
# Codecov's client checks wait for every CI Regression upload, so a client change without the
# `run regression` label would otherwise show no coverage result at all.
on:
  pull_request:
    types: [opened, synchronize, reopened, labeled, unlabeled, ready_for_review]
permissions:
  contents: read
  pull-requests: read
jobs:
  regression-label:
    runs-on: ubuntu-latest
    steps:
      - name: Require a regression label on client changes
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GH_REPO: ${{ github.repository }}
          PR: ${{ github.event.pull_request.number }}
          LABELS: ${{ toJSON(github.event.pull_request.labels.*.name) }}
          # The `client` paths in codecov.yml, the Cypress specs, and the build and dependency files.
          # A path ending in `/` matches everything under it; any other path matches only that file.
          LABEL_PATHS: "src/ shared/ authoring-api/src/helpers/ cypress/ package.json package-lock.json patches/ webpack.config.js tsconfig.json postcss.config.js cypress.config.ts"
        run: |
          files=$(gh api --paginate "repos/$GH_REPO/pulls/$PR/files" --jq '.[] | .filename, (.previous_filename // empty)')
          pattern=$(tr ' ' '\n' <<< "$LABEL_PATHS" | sed -e 's/\./\\./g' -e '/\/$/!s/$/$/' | paste -sd '|')
          changed=$(grep -E "^($pattern)" <<< "$files" || true)
          if [ -z "$changed" ]; then
            echo "No client or build files changed; no regression label needed."
            exit 0
          fi
          if jq -e 'index("run regression") or index("skip regression")' <<< "$LABELS" > /dev/null; then
            echo "Client or build files changed and the PR is labeled."
            exit 0
          fi
          echo "::error::Client or build files changed. Add the 'run regression' label, or 'skip regression' if the change does not need the suite."
          head -20 <<< "$changed"
          exit 1
```

Why this shape:
- **The file list is fetched on its own line.** Actions runs `bash -eo pipefail`, so in a single pipeline the `|| true` that tolerates "no client files" would also swallow a failed `gh api` call and pass the check.
- **Labels come from the event payload,** which carries the PR's current labels on every listed event type, including `labeled` and `unlabeled`.
- **The API file list, not `gh pr diff`,** since the diff endpoint refuses very large diffs; the files endpoint lists up to 3000.
- **A renamed file counts by both paths** (`previous_filename`), so moving a file out of a client folder still needs a label.
- **A path ending in `/` is a folder prefix; any other path is matched exactly,** with its dots escaped, so `package.json` matches the root file but not `functions-v2/package.json`.
- **The build and dependency files are in `LABEL_PATHS` only.** They change the built client or how the suite runs, but carry no coverage, so they stay out of `codecov.yml`.

Run as Actions runs it (`bash --noprofile --norc -eo pipefail`) against real PRs: #3091 with no labels exits 1 with the error; with `run regression` or `skip regression` exits 0; scripts/docs-only #3078 with no labels exits 0; a nonexistent PR exits 1 on the `gh` 404. With a mocked `gh` returning one file and no labels: `package.json`, `package-lock.json` and a file under `patches/` each exit 1; `functions-v2/package.json` and `scripts/x.ts` exit 0.

`src/test/codecov-config.test.ts` reads the files as text, so no YAML parser dependency is added:

```ts
import fs from "fs";
import path from "path";

const kRoot = path.resolve(__dirname, "../..");
const kWorkflows = path.join(kRoot, ".github/workflows");
const read = (file: string) => fs.readFileSync(path.join(kRoot, file), "utf8");

const capture = (text: string, pattern: RegExp) => {
  const match = text.match(pattern);
  expect(match).not.toBeNull();
  return match?.[1] ?? "";
};
const list = (text: string) => text.split(",").map(item => item.trim().replace(/^"|"$/g, ""));

const kCodecov = read("codecov.yml");

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

describe("codecov.yml", () => {
  it("waits for one cypress-regression upload per CI Regression container", () => {
    const containers = list(capture(read(".github/workflows/ci-regression.yml"), /^\s+container: \[(.*)\]/m));
    const builds = Number(capture(kCodecov, /name: cypress-regression\s+after_n_builds: (\d+)/));
    expect(builds).toBe(containers.length);
  });

  it("has the label check guard the client paths and the Cypress specs, and only paths that exist", () => {
    const clientPaths = list(capture(kCodecov, /paths: &client_paths \[(.*)\]/));
    const labelPaths = capture(read(".github/workflows/regression-label-check.yml"), /LABEL_PATHS: "(.*)"/).split(" ");
    expect(labelPaths).toEqual(expect.arrayContaining([...clientPaths, "cypress/"]));
    expect(labelPaths.filter(p => !fs.existsSync(path.join(kRoot, p)))).toEqual([]);
  });

  it("names only flags that a workflow uploads, leaving out the nightly cypress flag", () => {
    const statusFlags = [/flags: &client_flags \[(.*)\]/, /flags: &scripts_flags \[(.*)\]/]
      .flatMap(pattern => list(capture(kCodecov, pattern)));
    expect([...uploadedFlags()]).toEqual(expect.arrayContaining(statusFlags));
    expect(statusFlags).not.toContain("cypress");
  });
});
```

Built in the worktree as throwaway code: all three pass, `eslint` (both configs) and `tsc` are clean, and each of these mutations fails exactly one test: `after_n_builds: 14`; a 16th matrix container; a `functions-v2/` client path; `shared/` dropped from `LABEL_PATHS`; `cypress/` dropped from it; `webpack.config.js` mistyped as `webpack.config.ts`; `cypress-smoke` renamed in `ci.yml`; an unknown flag in a status; `cypress` added to `client_flags`; an upload step with `token:` before `flags:`. Every `capture` asserts its match, so none of the comparisons can pass on an empty list. The label paths are checked as a superset of the `client` paths plus `cypress/`, so an extra existing path (such as `README.md`) passes, and the existence check is what catches a typo in the build files.

**Check before committing** (R6, R8):

```bash
curl -s -X POST --data-binary @codecov.yml https://codecov.io/validate | head -1   # Valid!
npm test -- src/test/codecov-config.test.ts
```

---

### Describe the new checks in release prep

**Summary**: R9.

**Files affected**:
- `.claude/skills/releasing-clue/preparing.md`: the **Codecov** bullet under "Other rules"
- `README.md`: the sentence on Codecov under the test notes

**Estimated diff size**: 8 lines

Before:

```markdown
- **Codecov:** its checks fail on almost every PR; ignore them when judging readiness.
```

After:

```markdown
- **Codecov:** `codecov.yml` splits coverage into `client` and `scripts` checks. The `client`
  checks post only once every CI Regression upload has arrived, so they are missing on a PR
  without `run regression` or with a failed container; the Regression Label Check flags a client
  change that has neither `run regression` nor `skip regression`. A red Codecov check is worth a
  look before calling a PR ready.
```

`README.md`, which said Codecov reports on "overall coverage":

```markdown
The tests are run automatically on PRs and Codecov tracks coverage as separate `client` and `scripts` checks (see `codecov.yml`). The `client` checks report only after the regression suite runs, so a PR that changes client code, Cypress specs, or the build and dependency files (such as `package.json` or `webpack.config.js`) needs the `run regression` label, or `skip regression` when it does not need the suite; the Regression Label Check enforces this.
```

---

### Verify on the PR

**Summary**: R10. Not a commit.

Push both commits together, with the PR still unlabeled. Once `CI Base` finishes:

```bash
HEAD_SHA=$(gh pr view --json headRefOid -q .headRefOid)
gh api "repos/concord-consortium/collaborative-learning/commits/$HEAD_SHA/check-runs?per_page=100" \
  --jq '.check_runs[] | select(.name|test("codecov|Regression Label")) | [.name,.conclusion,.output.title] | @tsv'
```

Pass when the label check has failed, `codecov/project/scripts` and `codecov/patch/scripts` are present, and no `client` check is. Then add `run regression` (which `regression-label.yml` turns into a rerun of `CI Regression`) and, once its 15 containers finish, run the same command: the label check passes, and `codecov/project/client` and `codecov/patch/client` are present and successful. Before the containers finish, no `client` check should be present. Copy the titles into the PR description.

## Open Questions

<!-- Implementation-focused questions only. Requirements questions go in requirements.md. -->

### RESOLVED: Judgment call: one commit for the config, workflow and test, or three?
**Options considered**:
- A) One commit.
- B) Three commits.

**Decision**: A. The test reads all three files, so no split leaves every commit's test passing.

### RESOLVED: Judgment call: a new workflow, or a job in `regression-label.yml`?
**Options considered**:
- A) A new `regression-label-check.yml`.
- B) A second job in `regression-label.yml`.

**Decision**: A. `regression-label.yml` runs only on `labeled` and needs `actions: write` to rerun `CI Regression`; the check needs other triggers and only read access.
