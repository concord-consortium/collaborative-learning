# Commit Per-Project Env Files for functions-v2

**Jira**: https://concord-consortium.atlassian.net/browse/CLUE-659
**Repo**: https://github.com/concord-consortium/collaborative-learning
**Implementation Spec**: [implementation.md](implementation.md)
**Status**: **In Development**

## Overview

Record the deploy-time configuration of the `functions-v2` Cloud Functions in two committed files, one per Firebase project, so the values staging and production run with can be read from the repo and change only through a reviewed diff.

## Project Owner Overview

The chat tutor's model and its ForeverLearning settings are not in the code. The Firebase CLI reads them from `.env` files on the deploying developer's machine at deploy time, so each deploy sets them to whatever that developer has locally. On 2026-08-26 this put production's tutor on a model nobody intended, and nothing in the repo could have shown it. A deploy that takes these settings from a local file holding them empty, or from an interactive prompt answered with its empty default, wipes them: since the deploy of 2026-10-01 all fifteen production `functions-v2` functions, the tutor included, run with them empty, which is what made a ForeverLearning demo fail on production (CLUE-677). The release procedure merged on 2026-09-30 still tells the deployer to supply these values from an uncommitted local file.

This chore commits one settings file per project and makes the deploy read from those files, with a test that fails when the files and the code disagree. After it lands, "what model is production's tutor running?" can be answered by opening a file, and changing it means a pull request.

## Background

The Jira story has the full history (the report-service precedent in REPORT-55 and REPORT-83, and why `functions.config()` was never a factor here); this section covers only what the code dive added or corrected.

**The Firebase CLI's env-file rules**, read from `firebase-tools` 13.20.2 (the version `functions-v2` pins, `lib/functions/env.js`) and confirmed unchanged in 15.5.1 (the global CLI on this machine):

- A deploy loads `.env`, then one project file, with the project file winning key by key. The project file is `.env.<projectId>`, or `.env.<alias>` when deploying through an alias; if both exist the CLI errors before reading either. The emulator also loads the project file for the `--project` it runs under, then `.env.local` last.
- **Any declared non-secret param missing from those files is prompted for, even one with a `default`.** The default is only the suggested answer (`resolveParams` in `deploy/functions/params.js`). In `--non-interactive` mode `resolveParams` throws instead, naming every missing param: a throwaway jest run fed it the seven real specs from `declaredParams` with only `OPENAI_MODEL` supplied, under 15.5.1, and it threw for the other six. An independent review traced the real deploy path and found nothing that fills defaults in first: the SDK's manifest carries each param's default unchanged, discovery copies it as is, and `prepare.js` hands it straight to `resolveParams` in both 13.20.2 and 15.5.1. So the release skill's sentence that an empty-default param "deploys as empty when the file leaves it out" is wrong: omitted, it fails the deploy. Empty values reach a deployed function only from a file that sets them empty, or from an interactive prompt accepted at its empty default, which also writes them into an untracked `.env.<projectId>`.
- **Whatever a prompt resolves is appended to `.env.<projectId>`** (`writeUserEnvs`, called from `resolveBackend` / `writeResolvedParams`). Today that file is untracked and the write goes unnoticed. Once the file is committed, the same write dirties the working tree.

These were confirmed by throwaway code that drove `loadUserEnvs`, `resolveParams` and `writeUserEnvs` from the pinned CLI against a scratch directory (not committed).

**The deploy-time params `functions-v2` declares on `master`:**

| Param | Declared in | Default | Read by |
|---|---|---|---|
| `OPENAI_MODEL` | `src/chat-tutor.ts` | none | tutor (OpenAI path) |
| `FL_BASE_URL`, `FL_SOLUTION_ID`, `FL_CATALOG_COMMIT`, `FL_PROTECTION_CLASSES`, `FL_PROTECTION_PATTERN_REFS` | `src/chat-tutor.ts` | `""` | tutor (ForeverLearning path) |
| `AI_PROMPT_TEXT_LOGGING` | `lib/src/ai-categorize-document.ts` | `"off"` | analysis pipeline, emulator only |

`AI_PROMPT_TEXT_LOGGING` (CLUE-660) is not in the story; it landed after the story was written. It sits in the tracked `lib/src/` file rather than `src/`, which is why a search of `src/` misses it. The secrets (`OPENAI_API_KEY`, `OPENAI_TUTOR_API_KEY`, `FL_CONCORDCLUE_API_KEY`) are `defineSecret`s in Secret Manager and are not part of this.

**What is deployed**, read with `firebase functions:list --project <id> --json` (the `environmentVariables` of each `functions-v2` function):

- **2026-09-30.** Staging: all 15 share one set, `OPENAI_MODEL=gpt-5.5`, the five FL values from `.env.example`, and `AI_PROMPT_TEXT_LOGGING=off`. Production: the same model and logging values everywhere, but only nine functions carried the FL values; six, `chatTutorOnWrite` among them, had all five empty.
- **2026-10-01, after both projects' `functions-v2` functions were redeployed** (staging around 02:10 UTC, production around 02:20 UTC, about twenty minutes after the CLUE-682 merge; those times come from the fourteen 2nd-gen functions, since `functions:list` gives no deploy time for the 1st-gen `chatTutorOnWrite`). Staging is unchanged. **Production now has all five FL params empty on all 15 functions**; the model and logging values are unchanged.

So the model regression the story and its first two comments describe (production on `gpt-4o-mini`) has already been undone: every function in both projects reads `gpt-5.5`. What remains is production's FL config, and each full deploy from a machine without the FL values empties more of it. The second reading is why R15 exists: values can move between the spec and the commit.

**Why production loses the FL values** (Kirk Swenson's comment of 2026-10-01): the last two deploys of `chatTutorOnWrite` ran under the shared `developer@concord.org` release identity, which has no copy of either project file, so the release path deploys empty FL config every time it runs. Given the CLI behavior above, that means whatever env file those deploys loaded set the FL keys empty, or the deployer accepted the empty defaults at a prompt; which one is not recorded, and it does not change the fix. The empty FL config on the production tutor is what caused the ForeverLearning demo failure diagnosed in CLUE-677. The same comment records the intended contents of both files. They carry the same seven values as R3, and `FL_CONCORDCLUE_API_KEY` is already in Secret Manager for both projects.

**The release skill** (`.claude/skills/releasing-clue/`, PR #3016, merged 2026-09-30) is now the documented way functions reach staging and production. Its "Staging Firebase" section in `cutting.md` deploys from a worktree at the release tag with `npx firebase` 15, `--project <id> --config <worktree>/firebase.json --non-interactive`, and tells the deployer not to use the `deploy:*` scripts (they pass neither flag, and `.firebaserc` has no default project). For `functions-v2` it says to keep a gitignored `functions-v2/.env` in the developer's checkout, copy it into the worktree before deploying, delete it after, and not to create `.env.<projectId>` files "since committing them needs its own change first". This story is that change, so the skill's `functions-v2` steps are in scope (R16). A fresh worktree has no untracked files, so once the project files are committed the release path gets the right values with nothing to copy in. `shipping.md` reuses the same commands for production and says to compare production's deployed params "with each `.env`" first. The `authoring-api` steps are written as "the same four steps as functions-v2" and depend on `authoring-api/.env`, which this story does not change.

## Requirements

**The files**

- R1. `functions-v2/.env.collaborative-learning-staging` and `functions-v2/.env.collaborative-learning-ec215` exist and are tracked by git. Project ids are the ones in `.firebaserc`.
- R2. Each file sets **every non-secret param `functions-v2` declares**, currently the seven in the table above, so a deploy to either project neither prompts nor writes to a tracked file.
- R3. Staging values equal what staging runs today: `OPENAI_MODEL=gpt-5.5`, the five FL values as in `.env.example` (with `FL_CATALOG_COMMIT` unbumped), and `AI_PROMPT_TEXT_LOGGING=off`.
- R4. Production carries the same values as staging, FL included. Its first deploy from the committed file restores the FL config to every production function, the tutor among them.
- R5. Neither file holds a secret, a credential, or any value that is not safe in a public repo. The FL protection refs are opaque by design (see the comment above them in `src/chat-tutor.ts`), so they qualify.
- R6. `AI_PROMPT_TEXT_LOGGING` is `off` in both files and never `on`.

**Keeping them honest**

- R7. A `functions-v2` jest test fails when any of the following holds:
  - the two files do not hold the same keys with the same values (R4)
  - that set is not exactly the set of non-secret params `functions-v2` declares, as `firebase-functions/params`' `declaredParams` registry reports it once `src/index` is loaded (the same registry the CLI's param manifest is built from)
  - either file names a `defineSecret` param
  - `AI_PROMPT_TEXT_LOGGING` is anything other than `off` in either file

  It runs in the existing `CI Functions v2` job. Because CI checks out only tracked files, the test also fails if a file was left uncommitted.
- R8. `.gitignore` continues to ignore `functions-v2/.env`, `.env.local` and `.secret.local`, and does not ignore the two project files (verified true today with `git check-ignore`).

**Documentation**

- R9. `functions-v2/README.md` states:
  - which file a deploy reads (`.env.<projectId>` for the selected project)
  - that `.env.local` is for the emulator and is never deployed
  - that the emulator also loads `.env.<projectId>` when run under a real project id, as in "Driving the functions from a browser", with `.env.local` overriding it
  - that a deploying machine must not have a plain `functions-v2/.env`, because any key only it defines is still deployed to every function, nor an alias file (`.env.staging`, `.env.production`), because the CLI refuses to deploy when both `.env.<projectId>` and `.env.<alias>` exist
  - that a function keeps the values it was last deployed with, so a deploy of a subset leaves the rest on older values; deploy the whole `functions-v2` codebase, as the release skill already says
  - for release deploys, a pointer to the release skill rather than a second copy of its commands
  - the rule that a new deploy-time param is added to both project files in the same commit that declares it
- R10. The README's existing claims that these changes make untrue are corrected in the same change: `AI_PROMPT_TEXT_LOGGING` "must never appear in ... any `.env.collaborative-learning-*` file", and the ForeverLearning table that places the five FL params in `.env.local` only.
- R11. The header of `functions-v2/.env.example` is consistent with R9. It stays the template for `.env.local`, and points at the project files as the record of deployed values.
- R13. Every key `.env.example` shares with the staging file has the same value in both, asserted by the R7 test. `.env.example` keeps its values and the per-param explanations, since the emulator under `demo-test` loads neither project file and a developer still needs a working `.env.local`.

**Rollout**

- R12. Before merge, a `functions-v2` deploy to staging from a fresh worktree of this branch, using the release skill's command shape (`npx firebase` 15, `--project`, `--config <worktree>/firebase.json`, `--non-interactive`), completes with no `.env` copied in and leaves the worktree's `git status` clean. Every staging `functions-v2` function then reports the staging file's values in `firebase functions:list --json`. This replaces the story's "confirm via function logs or a tutor round trip" with a check that covers every function, not only the tutor. The branch's functions code is `master`'s, so the deploy also ships any `master` functions change staging does not have yet; compare deploy times first, as the skill's `preparing.md` describes.
- R14. Production gets the committed values with the next release, through the release skill as R16 changes it, not from a separate deploy after merge. A deploy from `master` between releases ships every functions change merged since production's last deploy, whatever those PRs' Deploy timing says; that is how PR #3021's `functions: with` change reached production on 2026-10-01, in the same deploy that emptied the FL values. ForeverLearning is not in use on production (Scott Cytacki, Slack, 2026-10-01), so waiting costs nothing. [CLUE-712](https://concord-consortium.atlassian.net/browse/CLUE-712) adds a skill for deploying between releases; if it lands first, it is the way to restore the values sooner.
- R15. Immediately before the files are committed, the deployed values are read again from both projects. A value that has changed since the most recent reading in Background is investigated before anything is committed, not copied in, because the reading is the evidence that R3 and R4 record what each project should run.

**Release procedure**

- R16. The release skill's `functions-v2` steps (`cutting.md`, "Staging Firebase") read their values from the committed project files: no `functions-v2/.env` is built, copied in or deleted, the "don't create `.env.<projectId>` files" sentence is removed, and the param check compares the tag's `.env.<projectId>` with that project's deployed values. `shipping.md`'s "compare production's deployed params with each `.env`" says the same for `functions-v2`. The `authoring-api` steps, which can no longer say "the same four steps as functions-v2", are written out in full with their current `.env` behavior unchanged. CLUE-712 plans to move these Firebase deploy steps into a sub-skill shared by releases and between-release deploys; CLUE-659 lands first, so that work starts from steps that already read the committed files.
- R17. The README and the release skill state the CLI's behavior as Background establishes it: every non-secret param missing from the env files fails a `--non-interactive` deploy, default or not, and the skill's "deploys as empty when the file leaves it out" sentence is removed. No dry run is needed; the deploy path was traced end to end in both CLI versions.
- R18. The implementation PR carries the Deploy timing callout `docs/deploy.md` requires. The project files count as `functions` there (only tests and `.md` files under `functions-v2/` are exempt). The timing is the developer's call; see the open question below.

## Technical Notes

- `functions-v2/.gitignore` ignores `*.local`, and the root `.gitignore` ignores `.env` (exact name, any directory). Neither pattern matches `.env.<projectId>`, so no `.gitignore` change is needed. `firebase.json` excludes `.*` from the `functions-v2` upload, so the env files are read by the CLI and never shipped as source.
- CI runs the tests under `firebase emulators:exec --project demo-test`, which loads neither project file, so committing them changes nothing about the existing test run.
- The deploying machine for 7.6.0 used an uncommitted `functions-v2/.env` (Jira comment, 2026-09-24), and a Jira comment reports an untracked `.env.collaborative-learning-staging` carrying the FL params on another machine. Once the committed files land, a `git pull` onto a machine with the untracked file refuses to overwrite it, and a leftover `.env` still contributes any key the project files lack. R9 and R12 cover both, along with the Rollout's note on developers' main checkouts.
- **Verified end to end before planning:** a throwaway jest test loaded `src/index`, took the seven non-secret specs from `firebase-functions/params`' `declaredParams`, parsed a draft staging file with the pinned CLI's `loadUserEnvs`, and ran the CLI's `resolveParams` in non-interactive mode. Every param resolved from the file and nothing was left to write back, so R2 holds for the values in R3. The values with commas and colons parse unquoted.
- The 2026-10-01 production deploy came straight from `master` between releases, not through the release skill. Committing the files means such a deploy at least carries the right values, but it still ships unreleased functions code, which is why R14 leaves production to the release.
- `authoring-api` has the same exposure (`UNIT_SUMMARY_DIGEST_MODEL` and `UNIT_SUMMARY_MODEL`, both without defaults, in `src/routes/generate-unit-summary.ts`) and is out of scope below.

## Out of Scope

- Converting the hardcoded `gpt-4o-mini` in `get-ai-content.ts` and `on-class-data-doc-written.ts` to params (per the story).
- `authoring-api`'s own deploy-time params. Same convention, separate codebase, and the story scopes this to `functions-v2`. Worth a follow-up ticket, which should also correct `authoring-api/README.md`: it says the `.env.<projectId>` files there are gitignored, and `git check-ignore` shows they are not.
- Bumping `FL_CATALOG_COMMIT` (see the pin notes on PR #3000).
- Changing any secret or anything in Secret Manager.

## Open Questions

### RESOLVED: Judgment call: which params the files carry
**Context**: The story names only `OPENAI_MODEL`. The Jira comments add the five FL params, and CLUE-660 added `AI_PROMPT_TEXT_LOGGING` since.
**Options considered**:
- A) `OPENAI_MODEL` only, as the story's scope section says
- B) Every non-secret param the codebase declares

**Decision**: B. With A, every deploy prompts for the other six, then writes them into the tracked file or sets them to whatever the deployer types. That is the failure the story exists to remove, and Scott Cytacki's comment of 2026-09-24 makes the same point for FL.

### RESOLVED: Judgment call: `AI_PROMPT_TEXT_LOGGING` in the committed files
**Context**: The README says it "must never appear in ... any `.env.collaborative-learning-*` file".
**Options considered**:
- A) Leave it out, as the README says
- B) Commit it as `off` in both, and change the README rule to "never `on`"

**Decision**: B. The CLI prompts for a missing param even when it has a default, then writes the answer into `.env.<projectId>`. Leaving it out would dirty a tracked file on every deploy. Both projects already run with `off`, and the code ignores it outside the emulator regardless, so B changes no deployed behavior.

### RESOLVED: Judgment call: enforce the convention with a test, not only the README
**Context**: The story asks only for documentation.
**Options considered**:
- A) README rule only
- B) README rule plus a jest test tying the files to the declared params

**Decision**: B. The rule is "add the param to both files in the same commit", and nothing about a README catches a missed step; the prompt-and-write-back behavior would hide the miss until someone's working tree went dirty after a deploy. The test is small and needs no emulator.

### RESOLVED: When staging and production are deployed
**Context**: The Jira acceptance criteria need a staging deploy before the story closes.
**Decision** (Doug, 2026-09-30, revised 2026-10-01): staging deploys from the branch before merge (R12). Production was first planned as a deploy from `master` after merge, then moved to the next release (R14) after Scott Cytacki pointed out that between-release deploys are what broke ForeverLearning, and that it isn't in use on production.

### RESOLVED: Re-read the deployed values before committing
**Context**: The Background values were read on 2026-09-30, and a deploy in between would make the files record stale values.
**Decision** (Doug, 2026-09-30): yes, as a step before the commit (R15).

### RESOLVED: What FL values does the production file carry?
**Context**: Six production functions, `chatTutorOnWrite` among them, run with all five FL params empty; nine run with the staging values. The file sets the same value for every function, so committing it resolves the split one way or the other on the next full production deploy. Setting the FL values on `chatTutorOnWrite` makes a production conversation routed to ForeverLearning (by `chatTutorProvider` in a unit config, or the `chatProvider` URL param) able to succeed, where today it fails the turn. The Jira comments ask for the FL values in both files, and CLUE-683 (enable ForeverLearning) is sequenced after this story.
**Options considered**:
- A) The staging values, as the Jira comments ask. The next production deploy puts the FL config on the tutor.
- B) All five empty. That matches the tutor today; the nine functions that do not read FL lose values they never used, and CLUE-683 fills them in.
- C) The staging values, and hold the production deploy until CLUE-683 is ready to ship

**Decision**: A (Kirk Swenson, who built the ForeverLearning backend, in his Jira comment of 2026-10-01). The empty values are the defect, not a state to preserve: they caused the CLUE-677 demo failure, and his recorded production file carries the staging values.

### RESOLVED: Low confidence: should the deploy scripts run `--non-interactive`?
**Context**: If a future param is declared and not added to the files, an interactive deploy prompts and writes the answer into a tracked file, while `--non-interactive` fails with a list of the missing names.
**Decision**: Leave the `deploy:*` scripts alone. The release skill already deploys with `--non-interactive` and does not use them, and R7 fails CI before merge when a param is missing from the files.

### RESOLVED: Low confidence: how R7 finds "the params functions-v2 declares"
**Context**: The test needs the declared set to compare against. A regex over `src/` and `lib/src/` is simple but could miss a param built with a variable name or declared in `../shared`; asking `firebase-functions` for its registry of declared params is exact but means loading every module the functions import.
**Options considered**:
- A) Scan source for `define(String|Int|Boolean|Float|List)("NAME"`
- B) Load the function modules and read `firebase-functions/params`' declared-params registry

**Decision**: B. A throwaway jest test that imported `../src/index` and read `declaredParams` returned exactly the seven string params and three secrets in the Background table, without the emulator, in under six seconds. It is the registry the CLI builds its manifest from, so it cannot drift from what a deploy prompts for, and it includes anything declared in `lib/src/` or `../shared`, which a source scan of `src/` would miss.

### OPEN: Deploy timing for the implementation PR
**Context**: CLAUDE.md requires the callout and says the developer decides the timing. Both directions, as `docs/deploy.md` asks: the new client against these functions is unaffected because no client code changes; the currently released client against these functions sees only the env values change. For staging that is no change at all. For production it restores the FL config, so a conversation routed to ForeverLearning stops failing its turn, and an OpenAI conversation is untouched.
**Options considered**:
- A) `functions: before`. Safe to deploy as soon as it merges, because the released client is unaffected and the change only restores intended config. Recommended. It says when the change is safe to deploy, not when it will be: production picks it up with the next release (R14).
- B) `functions: with`, if ForeverLearning on production should go live only alongside a client release

**Decision**: <!-- FILL IN YOUR CHOICE (A/B/C) OR WRITE YOUR OWN ANSWER -->

## Self-Review

Roles: Senior Engineer, DevOps / Release Engineer, Security Engineer, QA Engineer. Each finding below was checked against the code or the CLI before it was written down; findings that did not survive were dropped.

### Senior Engineer

#### RESOLVED: The FL and model values would live in three files
`.env.example` on `master` already carries `OPENAI_MODEL` and all five FL values, identical to what staging runs. Committing the two project files makes three copies of the same six values, with nothing to say which one is right when they drift. Fixed in place: R13 keeps `.env.example` as the emulator template (it has to hold working values, because `demo-test` loads no project file) and has the R7 test assert that every value it shares with the staging file agrees.

---

### DevOps / Release Engineer

#### RESOLVED: A leftover alias file breaks the first deploy after merge
The CLI loads `.env.<alias>` as well as `.env.<projectId>`, and throws "Can't have both dotenv files with projectId ... and projectAlias ..." when both exist (confirmed with the pinned CLI's `loadUserEnvs` against a scratch directory). A deployer who kept values in `.env.staging` or `.env.production` would hit this on their first deploy after the committed files land. The failure is loud, not silent, so it only needs saying: R9 now names alias files alongside `.env` as things a deploying machine must not have.

#### RESOLVED: The README should say why subset deploys split config
Production's FL split on 2026-09-30 was across functions deployed at different times: a deploy of a subset updates only the functions it names. R9 now says so and points at the whole-codebase deploy the release skill uses.

---

### Security Engineer

No confirmed findings. The values the files will hold are already public in the tracked `.env.example`. R7's exact-set comparison against the declared non-secret params already keeps a secret name, or a stray `FUNCTIONS_EMULATOR` (which the CLI does not reserve and which `ai-categorize-document.ts` reads to gate prompt-text logging), out of either file.

---

### QA Engineer

No confirmed findings. The R7 test cannot pass vacuously: the declared set is non-empty by construction (a throwaway run returned seven string params), a missing file makes the read throw, and each bullet in R7 corresponds to a mutation (drop a key from one file, add an undeclared key, add a secret name, set `AI_PROMPT_TEXT_LOGGING=on`, change an `.env.example` value) that turns it red.
