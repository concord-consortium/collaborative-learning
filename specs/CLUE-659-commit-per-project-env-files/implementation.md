# Implementation Plan: Commit Per-Project Env Files for functions-v2

**Jira**: https://concord-consortium.atlassian.net/browse/CLUE-659
**Requirements Spec**: [requirements.md](requirements.md)
**Status**: **In Development**

## Implementation Plan

### Commit the per-project env files and the test that holds them to the declared params

**Summary**: Adds the two files the CLI reads at deploy time and a jest test that fails when they stop matching what the code declares. The test is in the same commit because the files have no other guard: without it, a missed param shows up only as a prompt during someone's deploy. Covers R1 to R8 and R13.

**Files affected**:
- `functions-v2/.env.collaborative-learning-staging`: new, tracked
- `functions-v2/.env.collaborative-learning-ec215`: new, tracked
- `functions-v2/test/deploy-env-files.test.ts`: new

**Estimated diff size**: ~75 lines

**Before writing the files (R15):** read both projects again and compare against the values the requirements spec's Background records:

```bash
for p in collaborative-learning-staging collaborative-learning-ec215; do
  npx firebase functions:list --project $p --json 2>/dev/null \
    | jq -r --arg p $p '.result[] | select(.codebase == "functions-v2")
        | "\($p) \(.id) \(.environmentVariables | del(.FUNCTION_TARGET, .FUNCTION_SIGNATURE_TYPE, .LOG_EXECUTION_ID, .EVENTARC_CLOUD_EVENT_SOURCE) | tojson)"'
done
```

Any difference stops the step until it is explained.

Both files take the contents Kirk Swenson recorded in his Jira comment of 2026-10-01. `functions-v2/.env.collaborative-learning-ec215`:

```bash
# Deploy-time config for the production project (collaborative-learning-ec215).
#
# Firebase reads `.env.<project-id>` when that project is the deploy target, so the value the
# project's functions run with arrives as a reviewable diff instead of as whatever the deployer
# happened to have locally. A bare `.env` would do the same thing for EVERY project, which is why
# it is gitignored and why this file is not.

# The model chatTutorOnWrite calls. defineString with no default: unset means the function sends
# `model: ""`, OpenAI 400s, and the conversation document ends up status:"error".
OPENAI_MODEL=gpt-5.5

# Logs the prompt text sent to OpenAI by the analysis pipeline, but only inside the functions
# emulator: the code also requires FUNCTIONS_EMULATOR=true, which no deployed function has, so no
# value here can turn it on. It is set only because the Firebase CLI demands a value for every param
# in the codebase and prompts for it otherwise. See AI_PROMPT_TEXT_LOGGING in functions-v2/README.md.
AI_PROMPT_TEXT_LOGGING=off

# --- ForeverLearning tutor backend ---
#
# Only read when a conversation is routed to ForeverLearning (chatTutorProvider in the unit config,
# or the chatProvider URL param). An OpenAI conversation never touches them. The API key is not
# here: FL_CONCORDCLUE_API_KEY is a secret and lives in this project's Secret Manager.

FL_BASE_URL=https://api.foreverlearning.ai
FL_SOLUTION_ID=concordclue

# The commit of docs/ai-context/clue-object-catalog.md our projection conforms to. It names a
# document ForeverLearning holds a copy of and validates against, so it is true only while both
# sides name the same version: bump it when THEY have the newer catalog, not when we merge one.
FL_CATALOG_COMMIT=95b684b01a0616f826a43fcc55cb6d4c40cbd391

# Answer protection, comma-separated. The refs are opaque and resolved on FL's side; the values
# behind them never travel. Classes must come from kProtectionClasses in
# shared/fl-packet/envelope.ts; any unknown name fails the turn rather than quietly declaring less
# protection than was configured.
FL_PROTECTION_CLASSES=protected_threshold_value,protected_canonical_topology
FL_PROTECTION_PATTERN_REFS=protected:emg-gt-gripper-topology-2.3
```

`functions-v2/.env.collaborative-learning-staging` is byte-identical except for its first line, which reads `# Deploy-time config for the staging project (collaborative-learning-staging).` Kirk's recorded text said "the production functions" in the paragraph below the header; it reads "the project's functions" here so the shared paragraph is true in both files.

Both were checked as throwaway files: the test below passes against them, and the pinned CLI's `parseStrict` reads the seven values the requirements spec's R3 lists.

`functions-v2/test/deploy-env-files.test.ts`, run as throwaway code against draft files during speccing (7 passing; `eslint` and `tsc --noEmit` clean):

```ts
import * as fs from "fs";
import * as path from "path";
import {Expression, declaredParams} from "firebase-functions/params";

// The Firebase CLI deploys every non-secret param from `.env.<projectId>`, and prompts for any
// param a file is missing, then appends the answer to that file. These tests keep the committed
// files complete, so a deploy never prompts and never rewrites a tracked file.
const projectFiles = [".env.collaborative-learning-staging", ".env.collaborative-learning-ec215"];

// Restricting the files to bare KEY=VALUE lines keeps this parser and the CLI's in agreement.
const kLine = /^([A-Z_][A-Z0-9_]*)=([^\s"'#]*)$/;

const readEnvFile = (name: string) => {
  const text = fs.readFileSync(path.join(__dirname, "..", name), "utf8");
  const entries: Record<string, string> = {};
  for (const line of text.split("\n")) {
    if (line.trim() === "" || line.startsWith("#")) continue;
    const match = kLine.exec(line);
    if (!match) throw new Error(`${name}: not a bare KEY=VALUE line: ${line}`);
    entries[match[1]] = match[2];
  }
  return entries;
};

describe("the per-project deploy env files", () => {
  let stringParams: string[];
  let secretParams: string[];

  beforeAll(async () => {
    await import("../src/index");
    // Every non-secret param is an Expression; a SecretParam is not.
    const isSecret = (param: typeof declaredParams[number]) => !(param instanceof Expression);
    stringParams = declaredParams.filter((param) => !isSecret(param)).map((param) => param.name).sort();
    secretParams = declaredParams.filter(isSecret).map((param) => param.name);
  });

  it("finds the declared params to compare against", () => {
    expect(stringParams).toContain("OPENAI_MODEL");
    expect(secretParams).toContain("OPENAI_TUTOR_API_KEY");
  });

  it.each(projectFiles)("%s sets exactly the declared non-secret params", (name) => {
    expect(Object.keys(readEnvFile(name)).sort()).toEqual(stringParams);
  });

  it("gives production the staging values", () => {
    const staging = readEnvFile(".env.collaborative-learning-staging");
    expect(readEnvFile(".env.collaborative-learning-ec215")).toEqual(staging);
  });

  it.each(projectFiles)("%s leaves prompt-text logging off", (name) => {
    expect(readEnvFile(name).AI_PROMPT_TEXT_LOGGING).toBe("off");
  });

  it("gives .env.example the staging value for every key they share", () => {
    const example = readEnvFile(".env.example");
    const staging = readEnvFile(".env.collaborative-learning-staging");
    const shared = Object.keys(example).filter((key) => key in staging);
    expect(shared.length).toBeGreaterThan(0);
    for (const key of shared) {
      expect({key, value: example[key]}).toEqual({key, value: staging[key]});
    }
  });
});
```

What each test catches, confirmed by mutating the draft files and rerunning:

| Mutation | Fails |
|---|---|
| Drop a key from one project file | exact-set test for that file |
| Add a secret name, or an undeclared key such as `FUNCTIONS_EMULATOR`, to one file | exact-set test for that file |
| `AI_PROMPT_TEXT_LOGGING=on` | logging test for that file |
| Change a shared value in `.env.example` | `.env.example` agreement test |
| Change any production value, such as `FL_BASE_URL` | production-equals-staging test |
| Quote a value, or leave a file uncommitted (absent in CI) | every test for that file (the parse throws) |
| Invert `isSecret`, or `src/index` stops registering params | "finds the declared params", plus every exact-set test |

Notes on the choices in it:

- **The declared set comes from `declaredParams`,** the registry `define*` calls push onto and the CLI builds its param manifest from. So it includes `AI_PROMPT_TEXT_LOGGING` from `lib/src/` and anything a future `../shared` module declares. Importing `../src/index` needs no emulator and no `firebase-functions-test` setup; the throwaway run took under six seconds.
- **Secrets are told apart with `instanceof Expression`.** `SecretParam` is not exported from `firebase-functions/params`, and `toSpec()` is not in the public typings; `Expression` is exported, and every non-secret param class extends it. `SecretParam` does not.
- **The test parses the files itself rather than calling the CLI's `parseStrict`.** `firebase-tools` ships no typings for `lib/functions/env`, `tsconfig.json` includes `test/` in `npm run build`, and the repo's `@typescript-eslint` 8 `recommended` rejects a bare `require`. The line pattern restricts the files to a strict subset of the CLI's grammar on which both parsers agree (no quotes, spaces, inline comments or escapes), and a line outside it fails the test.
- **There is no separate "names no secret" test.** It was in the first draft and never failed on its own under mutation, because a secret name already breaks the exact-set comparison. R7's secret clause is met by that test.
- **Placement:** `test/` with the other tests, so the existing `CI Functions v2` job runs it with no workflow change. `npm test` runs it inside `emulators:exec` in CI, but it touches neither emulator.

---

### Document which env file a deploy reads

**Summary**: Brings the README and `.env.example` in line with the committed files, and states the convention that keeps them complete. Separate from the previous step so that the files-and-test commit reviews as a pure config change. Covers R9 to R11, and the README half of R17.

**Files affected**:
- `functions-v2/README.md`: new "Deploy-time params" subsection; four passages corrected
- `functions-v2/.env.example`: header only

**Estimated diff size**: ~45 lines

**`README.md`: add under `## To deploy firebase functions`, after the `npm run deploy` block and before `### Deploy Firestore indexes ...`:**

```markdown
### Deploy-time params

Every non-secret param the functions declare (`defineString` and friends) is read at deploy time from `.env.<projectId>` for the project being deployed: `.env.collaborative-learning-staging` or `.env.collaborative-learning-ec215`. Both are committed, so the values each project runs with are the ones in the repo, and changing one is a reviewed diff. Secrets are not in them; they live in Secret Manager.

**A new param goes in both files, in the same commit that declares it.** `test/deploy-env-files.test.ts` fails until it does. The reason is what the CLI does with a param no file sets: an interactive deploy prompts for it even when the param has a default, and appends the answer to `.env.<projectId>`; a `--non-interactive` deploy fails instead, naming the missing params. With the files complete, a deploy does neither.

Deploy the whole `functions-v2` codebase rather than a subset. A function keeps the values it was last deployed with, so deploying some functions and not others is how a project ends up with functions disagreeing about a param. For a release, follow the `releasing-clue` skill (`.claude/skills/releasing-clue/`), which deploys from a worktree at the tag, where these files are already present.

Before deploying from a checkout rather than a fresh worktree, make sure it has neither of these in `functions-v2/`:

- **`.env`.** The CLI loads it first and the project file overrides it key by key, so any key only `.env` defines is still deployed, to every function.
- **An alias file such as `.env.staging` or `.env.production`.** The CLI refuses to deploy when both `.env.<projectId>` and `.env.<alias>` exist.

`.env.local` is for the emulator and is never deployed. The emulator also loads `.env.<projectId>` for the `--project` it runs under, so under `--project collaborative-learning-ec215` (see "Driving the functions from a browser") production's values apply unless `.env.local` overrides them. Under `demo-test` neither project file is loaded.
```

**`README.md`: replace the paragraph starting "**Use `.env.local`, not `.env`.**"** (currently line 72) with:

```markdown
**Use `.env.local`, not `.env`.** `.env.local` is the one Firebase reserves for emulation and never deploys. A plain `.env` is read at deploy time as well, and any key it sets that the project file does not is deployed to every function.
```

**`README.md`: replace the paragraph at "A per-project file — `.env.collaborative-learning-staging` ..."** (currently line 74) with:

```markdown
The deployed values live in the committed per-project files; see "Deploy-time params" under "To deploy firebase functions".
```

**`README.md`: in the `AI_PROMPT_TEXT_LOGGING` bullets, replace the first bullet** (currently line 78) with:

```markdown
- Set it to `on` in `.env.local`, which the emulator reads and Firebase never deploys. **It is `off` in both committed project files and must stay `off` there, and it must never appear in `.env`**; `test/deploy-env-files.test.ts` enforces the project files. It is in them at all because a deploy prompts for any param the files omit. No deployed environment needs it on: the emulator runs the whole read path, and the one thing the emulator cannot check (that a composite index exists) shows in the count-only log line, not in the text.
```

**`README.md`: replace the ForeverLearning table's `.env.local` row** (currently line 96) with:

```markdown
| `.env.local` (emulator), the per-project files (deployed) | `FL_BASE_URL`, `FL_SOLUTION_ID`, `FL_CATALOG_COMMIT`, `FL_PROTECTION_CLASSES`, `FL_PROTECTION_PATTERN_REFS` |
```

**`.env.example`: replace the first five lines of the header** (through "Use `.env.local`.") with:

```bash
# Copy to `.env.local` (gitignored) for local emulator runs.
#
# `.env.local` is the file Firebase reserves for emulation and never deploys. Deployed values come
# from the committed `.env.collaborative-learning-staging` and `.env.collaborative-learning-ec215`;
# see "Deploy-time params" in README.md. Do not create a plain `.env`: the CLI reads it at deploy
# time and deploys any key it sets that the project file does not.
```

The existing line after it ("This file is for non-secret configuration ...") and every per-param comment below stay as they are. The values stay too: the emulator under `demo-test` loads no project file, and the test pins them to staging's.

### Point the release skill at the committed files

**Summary**: The release skill tells the deployer to supply `functions-v2`'s values from a gitignored `.env` copied into the release worktree, and not to create the files this story commits. This step makes it read the committed files instead, and spells out the `authoring-api` steps that used to say "the same four steps as functions-v2". Covers R16 and the skill half of R17. CLUE-712 will later restructure these same steps into a shared deploy sub-skill, so the edit stays minimal. Last, because its text describes files and a test the first step adds.

**Files affected**:
- `.claude/skills/releasing-clue/cutting.md`: the `**functions-v2:**` and `**authoring-api:**` blocks under "Staging Firebase"
- `.claude/skills/releasing-clue/shipping.md`: one sentence under "Production Firebase"

**Estimated diff size**: ~30 lines

**`cutting.md`: replace the `**functions-v2:**` block** (from `**functions-v2:**` through the paragraph ending "by a deploy whose `.env` leaves them out.") with:

```markdown
**functions-v2:**

1. **Compare params:** the tag carries `functions-v2/.env.collaborative-learning-staging` and `functions-v2/.env.collaborative-learning-ec215`, which set every non-secret param the tag declares (`functions-v2/test/deploy-env-files.test.ts` fails CI otherwise). Compare `<worktree>/functions-v2/.env.<project>` with the project's deployed values (`functions:list --json` → `environmentVariables`). A difference is either something this release changes or a deploy that went out from somewhere else; find out which before deploying. Don't copy a `.env` into the worktree: the CLI deploys every key a plain `.env` sets alongside the project file's.
2. **Install:** `npm --prefix <worktree>/shared ci` and `npm --prefix <worktree>/functions-v2 ci`.
3. **Deploy:** `npx firebase deploy --only functions:functions-v2 --project <project> --config <worktree>/firebase.json --non-interactive`.
4. **Check:** the functions' deploy times and params.

Deploy all of functions-v2, not a subset. Each function keeps the params it was deployed with, so a subset deploy leaves the others on older values.
```

**`cutting.md`: replace the `**authoring-api:**` paragraph** with the steps it used to borrow from `functions-v2`, with the same behavior:

```markdown
**authoring-api:**

1. **Build and compare params:** keep `authoring-api/.env` in the developer's checkout (gitignored). If it's missing, build it from a deployed function's non-secret values (`functions:list --json` → `environmentVariables`). Find every param the tag declares by grepping for `defineString`, `defineInt` and `defineBoolean` in `authoring-api/src`, and check the file sets each one: a missing one fails a non-interactive deploy. `authoring-api/.env.example` lists the current ones. Compare the file with each project's deployed values.
2. **Install:** `npm --prefix <worktree>/shared ci` and `npm --prefix <worktree>/authoring-api ci`.
3. **Deploy:** copy `authoring-api/.env` into the worktree, then run `npx firebase deploy --only functions:authoring-api --project <project> --config <worktree>/firebase.json --non-interactive`.
4. **Clean up and check:** delete the copied `.env`, and check the functions' deploy times and params.
```

**`shipping.md`: replace** "Compare production's deployed params with each `.env` first; production and staging can differ." **with:**

```markdown
Compare production's deployed params first: `functions-v2`'s with the tag's `functions-v2/.env.collaborative-learning-ec215`, and `authoring-api`'s with `authoring-api/.env`. Production and staging can differ.
```

The release record `releases/7.6.0.md` also describes deploying from a local `.env`. It stays as written: it records how 7.6.0 shipped.

---

## Rollout

Not a commit. **Staging, before merge (R12):** uses the release skill's command shape from a fresh worktree, so no local `.env` can reach it, with `<sha>` = the reviewed branch commit (`git rev-parse HEAD` on the branch) and `<project>` = `collaborative-learning-staging`. A detached worktree at a SHA is used because `git worktree add` refuses a branch that is already checked out, and a SHA pins exactly what was deployed.

1. Compare what `<project>` runs with `<sha>`'s functions code: deploy times as in the skill's `preparing.md` ("Firebase deployables"), so the deploy's other effects are known before it runs.
2. Create the worktree and install:
   ```bash
   git worktree add --detach ../clue-deploy <sha>
   npm --prefix ../clue-deploy/shared ci && npm --prefix ../clue-deploy/functions-v2 ci
   ```
3. Deploy: `npx firebase deploy --only functions:functions-v2 --project <project> --config ../clue-deploy/firebase.json --non-interactive`. Check `npx firebase --version` is 15 or later first.
4. `git -C ../clue-deploy status --short` is empty.
5. Rerun the R15 read: every `functions-v2` function in `<project>` reports the file's seven values in `environmentVariables`.
6. `git worktree remove ../clue-deploy`.

A developer's main checkout still has its own `functions-v2/.env` and any untracked copy of a project file. Delete the untracked project files before pulling the merge, since a pull refuses to overwrite them. Once the merge is pulled, delete `.env` too: it is no longer needed for anything.

**Production, at the next release (R14):** nothing to run at merge. The release's functions-v2 deploy, following `cutting.md` and `shipping.md` as the third step changes them, applies `.env.collaborative-learning-ec215` from the tag's worktree, and its check step is where the seven values are confirmed on every production function.

## Open Questions

### RESOLVED: Judgment call: three commits rather than one
**Options considered**:
- A) One commit with the files, the test, the README and the release skill
- B) Files and test, then the README, then the release skill

**Decision**: B. The first commit is config a reviewer checks value by value against the deployed state in the requirements spec. The second is the codebase's own docs. The third changes a procedure other people follow, and is the one a release manager will want to read on its own. None leaves the tree broken: the prose the later commits correct is wrong only until they land in the same PR.

### RESOLVED: Judgment call: Kirk's commented files over bare ones
**Options considered**:
- A) Bare `KEY=VALUE` lines with a one-line header pointing at the README
- B) The files as Kirk Swenson recorded them, with a comment on each param

**Decision**: B. The comments explain each value where a reviewer of a future change to it will be looking, and the files are the contents the FL backend's author recorded as intended. The cost is that the per-param explanations also exist in `.env.example`. The values cannot drift, because the test pins them; the prose can, and is left to review.

### RESOLVED: Judgment call: the test's own parser over the CLI's
**Options considered**:
- A) Call `parseStrict` from `firebase-tools/lib/functions/env`
- B) A line pattern the test enforces, restricting the files to a grammar both parsers agree on

**Decision**: B, for the typing and lint reasons under the test above. A needs a hand-written module declaration for an internal CLI path that carries no stability promise, even though it happens to be the same in 13.20.2 and 15.5.1.

## Self-Review

Roles: commit reviewer, whoever runs the tests, whoever runs the deploy, Senior Engineer. Each finding was checked against the current code or by building the proposed code as throwaway before it was written down.

### Senior Engineer

#### RESOLVED: A fourth README passage becomes untrue
The README's "**Use `.env.local`, not `.env`.**" paragraph (line 72) says a local `OPENAI_MODEL` in `.env` "would decide which model production calls". Once the project file sets `OPENAI_MODEL`, it overrides `.env` key by key (confirmed with the pinned CLI's `loadUserEnvs`: `.env` `gpt-4o-mini` plus project file `gpt-5.5` deploys `gpt-5.5`), so that example stops being true while the rule itself still holds. Found by grepping for every file that describes the env-file contract. Fixed in place: the second step now replaces that paragraph too.

#### RESOLVED: `docs/plans/CLUE-660-plan.md` states the old rule
Its Task 5 says `AI_PROMPT_TEXT_LOGGING` "must not be set in `.env` or in any per-project file". Left unchanged: it is the dated plan for a finished task and records how that task was verified, not the current contract. The contract lives in `functions-v2/README.md`, which the second step corrects.

---

### Whoever runs the tests

No confirmed findings. The proposed test file, with draft project files in place, passed together with `prompt-text-logging.test.ts` under `jest --detectOpenHandles` (16 tests, no open handles), so importing `../src/index` leaves nothing running that would stop the CI job exiting. The first step passes on its own, against the unmodified `.env.example`, which is how every throwaway run was done.

---

### Whoever runs the deploy

#### RESOLVED: The plan's deploy commands contradicted the release skill
The release skill merged after the plan was first written (PR #3016). It deploys from a worktree at the tag with `npx firebase` 15 and `--project`, `--config` and `--non-interactive`, and rules out the `deploy:*` scripts because they pass neither flag and `.firebaserc` has no default project. The Rollout used `firebase use` plus `npm run deploy`, which runs the 13.x CLI `functions-v2` pins, from the developer's main checkout, where a local `.env` would still be loaded. Rewritten to the skill's command shape from a fresh worktree, and the README text no longer recommends the `deploy:*` scripts.

#### RESOLVED: The release skill would have kept supplying the values from a local `.env`
Left alone, the next release would still copy a developer's `functions-v2/.env` into the tag worktree, and the skill would still tell them not to create the files this story commits. The new third step points it at the committed files and writes out the `authoring-api` steps that borrowed the `functions-v2` ones.

### Whoever reviews the commits

No confirmed findings. The release-skill step comes last because its text names `test/deploy-env-files.test.ts`, which the first step adds; each commit is coherent on its own.
