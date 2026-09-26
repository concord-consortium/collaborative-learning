# Phase 1: Preparing the release

Gated actions are marked **[approve]**; see "Approval gates" in SKILL.md.

## Parameters

Agree these with the developer first and put them at the top of the release record:

| | Example |
|---|---|
| New version | `7.6.0` |
| Previous tag | `v7.5.0` (confirm with `deployed-version.ts`) |
| Jira fix version | `7.6.0`: bare version, no "CLUE " prefix |
| Jira release story | "Release 7.6.0", issue type `Release` |
| Release branch | `v7.6.x` |
| Target release day and time | from the developer |

## Preflight

- **dev-templates scripts:** the features this skill uses (`--details`, `--json`, the `gh` token
  fallback, epic subheadings, `slack` output without a quote prefix) are on dev-templates PR #22
  (branch `DEV-192-unlinked-prs-release-review`). Until it merges, check out that branch in
  `~/Development/dev-templates`.
- **Release story and next version:** check that Jira has the release story for this version, and
  a fix version for the next one to move stories into. Propose creating what's missing
  **[approve]**.
- **Previous version:** check it's marked released in Jira; if not, include it in the wrap-up.
- **Deployed versions:** `npx --prefix scripts tsx scripts/deployed-version.ts` after
  `git fetch --tags`. It checks every page a release deploys, on production and staging.
- **Jira token:** the dev-templates scripts (`~/Development/dev-templates/scripts`) use
  `JIRA_USER` and `JIRA_TOKEN` in their `.env`, and check the token when they start. Atlassian
  tokens expire; the developer renews theirs at
  https://id.atlassian.com/manage-profile/security/api-tokens.
- **GitHub token:** run those scripts with `GITHUB_TOKEN=` blanked, so they fall back to
  `gh auth token`. The `.env` value has gone stale before.
- **Other logins:** `gh auth status`; `gcloud auth print-access-token` (for reading deployed rules;
  `gcloud auth login` if it fails); `npx firebase projects:list`; the Atlassian and Slack
  connections in this session. If a connection drops, it takes a new session or `/mcp`.
- **Slack IDs:** channel and user IDs aren't recorded here because the repository is public. Look
  up #clue-dev, #clue, #releases and each person you'll mention with the Slack search tools.

## Triage (repeat until the version is ready)

Run the combined Jira and PR report from the dev-templates scripts:

```bash
GITHUB_TOKEN= npm --prefix ~/Development/dev-templates/scripts run -s unlinked-prs -- \
  CLUE <version> collaborative-learning <previous tag> master --details
```

For the deploy report below, save the `--json` form to a file in the scratchpad (`... --json >
<scratchpad>/unlinked-prs.json`). Use `master`, not `origin/master`, as the ref: it goes to the
GitHub compare API, not local git.

Sort each story into one of these, and propose an action for each:

| Situation | Proposed action |
|---|---|
| Code merged, story not Done | Ask the assignee or approver whether it can be marked Done (in the status post **[approve]**); transition it when they agree **[approve]** |
| Story is done once something is deployed (e.g. a backend) | Check the deployed state; propose Done, and removing any blocker link, once it's deployed **[approve]** |
| Waiting on code or project-team review | Name the people it's waiting on, for the status post |
| Merged PR with no story | Create a Chore **[approve]**: fix version, current sprint, assignee = PR author, a remote link to the PR, "relates to" any other Jira key the PR names, then Done |
| PR and story connected, but the script missed it | Add a remote link to the PR on the story **[approve]** |
| Story Done, PR still open, PR not needed for the release | Keep the story Done, and move the PR to its own story **[approve]**: no fix version, a remote link to the PR, "relates to" the old story, the new key in the PR title, the old key reworded in the PR body, a comment on the old story, and a note in the release-status thread |
| Missing fix version | Ask; add it **[approve]** |
| Sprint suggests another release | Show the sprint; never move a story because of it |
| Script output looks wrong | Note it in the record, as a dev-templates fix |

Other rules:
- **"Docs only" PRs:** before calling a PR docs only, grep for how the changed files are used (env
  params, pinned shas, URLs), not just imports.
- **Other repositories:** a story can have PRs in other repositories; the script labels them
  "(other repo)".
- **Jira keys in other repositories:** a key written in a PR in another repository links that PR to
  the story, which then shows up in triage. When writing PRs or comments elsewhere, avoid CLUE keys
  unless the link is wanted.
- **Codecov:** its checks fail on almost every PR; ignore them when judging readiness.
- **Jira REST:** the Atlassian connection covers issues but not versions. For anything else, write
  a small script in `scripts/local/` that reads the dev-templates `.env`.

**Status post in #clue-dev [approve]:** a new top-level message per round. It lists what's done
since the last post, then each open item with what it's waiting on and who (mention them). Before
drafting, read the replies in the previous status thread. Show the draft, and let the developer
edit it. Later replies and nudges go in the latest status post's thread.

When the next step waits on someone's reply, schedule a reminder in the developer's self-DM so the
work picks up again.

## Deploy timing

Every PR that touches functions, rules or indexes should carry a Deploy timing callout (see
"Deploy timing" in `docs/deploy.md`). Roll them up:

```bash
npx --prefix scripts tsx scripts/release-deploy-report.ts --unlinked-prs <scratchpad>/unlinked-prs.json
```

Run it from a checkout of the commit being released (master before the cut, the release worktree
after): which `shared/` files count as functions code comes from the current checkout. It gives the strictest timing per part (`before`, `with` or `after` the client) and a "to ask"
list of PR authors missing a callout. Ask them **[approve]** for Slack or PR comments; never fill in
a timing yourself.

## Firebase deployables

What changed (after `git fetch`): `git diff --name-status <previous tag> origin/master -- firestore.rules database.rules.json
firestore.indexes.json firebase.json functions-v1 functions-v2 authoring-api shared`.

What's deployed (read-only; projects are `staging` = collaborative-learning-staging and
`production` = collaborative-learning-ec215):
- **Functions:** `npx firebase functions:list --project <project> --json`.
  `source.storageSource.generation` is the deploy time in microseconds, and
  `environmentVariables` shows each function's non-secret params. For 1st-gen functions use
  `gcloud functions describe <fn> --project <project> --region us-central1 --format='value(updateTime)'`.
  Compare deploy times with `git log --first-parent <range> -- functions-v2 shared` to see which
  merges each project is missing. Production's 1st-gen functions are in codebase `default` on
  nodejs16, while staging's are in `functions-v1`; a `functions-v1` deploy to production needs a
  decision about that first.
- **Indexes:** `npx firebase firestore:indexes --project <project>`. Strip the implicit `__name__`
  field before comparing with `firestore.indexes.json`.
- **Firestore rules:** the Firebase Rules API (`releases/cloud.firestore`) with a gcloud token.
  A diff with only comment changes doesn't need a deploy.
- **RTDB rules:** `https://<instance>.firebaseio.com/.settings/rules.json`, with instances
  `collaborative-learning-staging-default-rtdb` (staging) and `collaborative-learning-ec215`
  (production). Both projects have had
  console-only rules that aren't in `database.rules.json`, so deploying from the repo would
  silently delete them. Compare first, and don't deploy RTDB rules unless the developer decides to.
- **Secrets:** `npx firebase functions:secrets:get <NAME> --project <project>` shows metadata only.

Per part, work out: must it deploy, has it already, and when relative to the client. Check both
directions: the new client against the deployed part, and the *released* client against the new
part. Decisions come from the PR authors and the developer. An index deploy prompts before deleting
extra indexes, so never pass `--force`.

Also record the deploy **order**. The default is indexes (wait until they show Enabled), then
rules, then functions, then the client. Read each touching PR for its own order (one release had
a PR asking for one function to deploy before the rest).

## External dependencies

Check, and note in the record: portal launch parameters, token-service, report-service,
ForeverLearning, and curriculum units. For units, read the curriculum on GitHub `main` (what
production loads, `models-resources.concord.org/clue-curriculum/branch/main/<unit>/content.json`),
not a local clone.

For rules changes, write a UI test plan: rules only apply to portal launches, so name the units
that turn the feature on.

## Release notes

```bash
npm --prefix ~/Development/dev-templates/scripts run -s release-notes-jira CLUE <version>
```

Add `slack` for the Slack form, which already writes keys as links. Sections: Story → Features,
Bug → Bug Fixes, Chore/Task or label `under-the-hood` → Under the Hood.

Review for jargon titles (`SPIKE:`, code identifiers), near-duplicates, internal stories that
belong under the hood, and stories not yet Done. Propose fixes:
- **A blurb:** a `Blurb: …` paragraph at the top of the description replaces the title in the
  notes. A bug's blurb describes the fix; a story's describes the new capability.
- **The `under-the-hood` label.**

Apply the ones the developer approves **[approve]**, and read each one back. To add a blurb
without disturbing the description, use REST: get the description (ADF), prepend a paragraph, put
it back, then check the paragraph count went up by one. Don't rewrite the whole description.

## Pre-announce in #clue [approve]

A top-level post, so projects running CLUE can prepare:
1. An intro line with the planned timing (day, and morning, afternoon or evening), and a
   one-sentence summary.
2. The `slack` release notes.
3. "The GitHub release link will be added here when <version> is released."

Preview it in the developer's self-DM first. The Slack tool takes standard markdown, so convert the
script's Slack formatting: `*bold*` becomes `**bold**` and `_italic_` becomes `*italic*`. At
release, reply in this post's thread; Claude can't edit it.
