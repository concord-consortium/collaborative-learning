# Phase 2: Cutting and staging

Gated actions are marked **[approve]**; see "Approval gates" in SKILL.md.

## Before cutting

- **The developer confirms what must be in the tag.** A story that isn't Done doesn't block the cut
  if its code is merged; say which ones you're treating that way.
- **Checks:** `git fetch --tags`. Look for merges since the last triage, and read what each one
  changes. Master's CI is green (`gh run list --branch master`). Neither the branch nor the tag
  exists on origin yet.
- **Regression tests:** CI Regression skips its Cypress jobs on a tag (they run only on master or
  with the `run regression` label), so the tag's run means nothing. The signal is master's CI
  Regression run for the exact commit you'll cut from:

  ```bash
  gh run list --workflow ci-regression.yml --branch master --commit <sha> \
    --json databaseId,status,conclusion,url
  ```

  If that run passed, carry on. If it failed, is still running, or doesn't exist (master's runs
  cancel each other when merges land close together), stop and tell the developer what you
  found. They choose how to proceed, for example: wait for a run in progress; re-run all its jobs
  **[approve]** (`gh run rerun <id>`, never `--failed`, since Cypress Cloud splits the specs
  across the jobs); cut from an earlier master commit with a green run; or go ahead anyway.
  Record the choice.

## Branch, version and tag

Work in a separate worktree, so the developer's checkout isn't touched. `<sha>` is the master
commit whose regression run you checked:

```bash
git worktree add -b v<X.Y>.x ../v<X.Y>.x <sha>                             # [approve]
npm --prefix ../v<X.Y>.x version <X.Y.Z>                                    # [approve]
git -C ../v<X.Y>.x push origin v<X.Y>.x v<X.Y.Z>                            # [approve]
```

`npm version` commits `package.json` and `package-lock.json` with the message `<X.Y.Z>`, and
creates the annotated tag `v<X.Y.Z>`. Only release branches get the version; master's
`package.json` stays behind.

Pushing the tag starts CI Base, which builds and deploys to `version/v<X.Y.Z>/`, along with CI
Functions v2 and CI Regression. The branch push starts its own runs; watch **the tag's**. For each
of `ci.yml` and `functions-v2.yml`, find the run with `gh run list --workflow <file> --branch
v<X.Y.Z>`, then `gh run watch <id> --exit-status`. Both must pass before Release Staging. Confirm
`https://collaborative-learning.concord.org/version/v<X.Y.Z>/` loads.

## GitHub release [approve]

```bash
npm --prefix <dev-templates>/scripts run -s release-notes-jira CLUE <X.Y.Z> > <scratchpad>/notes.md
gh release create v<X.Y.Z> --title <X.Y.Z> --notes-file <scratchpad>/notes.md \
  --prerelease --latest=false
```

The title is the bare version. The notes include the epic subheadings. The release is a
pre-release until it reaches production, so the release list's Latest badge always marks what
production serves; shipping.md promotes it. If this version never ships (a show-stopper leads to
a new patch), it stays a pre-release and keeps its notes, since tags are never moved.

## Staging portal

Point learn.portal.staging.concord.org at the release. Dry run first; show the output, then run it
for real **[approve]**:

```bash
npx --prefix scripts tsx scripts/update-portal-release.ts --tag v<X.Y.Z> \
  --report-id 10 --report-id <teacher report ids> --activity-id <resource ids> --dry-run
```

It adds the release's version and branch folders to the `clue` OAuth client's redirect URIs, and
moves the named reports and resources to the release, names included. Re-running is safe.

Which reports to move: 10 ("CLUE (test)"), plus the teacher reports the resources you move have
attached, usually "CLUE Teacher Tools (vX.Y.Z, staging FB)" and "(vX.Y.x branch, staging FB)". A
resource's edit page (`/eresources/<id>/edit`) shows its attached reports; the admin index
`/admin/external_reports` lists them all.

Which resources to move:
- **Resources to find:** list every staging resource pinned to a version or branch. There's no
  script for this yet: use the admin search API
  `/api/v1/search/search?query=&per_page=5000&private=true&include_templates=true`, which includes
  private and draft resources, and keep URLs containing `/version/` or `/branch/`, other than
  `branch/master`. Archived resources aren't returned.
- **Move without asking which:** the previous release's smoke-test resources ("(vX.Y.Z, staging
  FB)", created by the admin API user); the project team tester's resources; and the developer's
  own pins.
- **List and ask about:** anyone else's old pins. Leave feature-branch resources alone.

**Staging Firebase.** A resource without `firebaseEnv=staging` uses production Firebase, where the
new functions aren't deployed yet. To test server-side changes, a resource needs
`firebaseEnv=staging`, and its teacher report must use the same Firebase. Otherwise the teacher sees
none of the students' work. Switching also means the tester won't see their earlier work. So
propose it, and say that in the handover.

There's no script for switching yet (`update-portal-release.ts` leaves attached reports alone on
purpose). Write one in `scripts/local/` on `PortalSession` from `scripts/lib/portal-api.ts`: on
`/eresources/<id>`, submit `external_activity[url]` with `firebaseEnv=staging` added, then
`update_external_reports=1` with `external_reports[]` swapped to a staging-Firebase report. Dry run
first, then **[approve]**, then read each resource back.

Portal writes to resources other people own may also be blocked by Claude Code's permission check
until the developer allows them.

## Staging Firebase [approve]

Deploy what the deploy-timing decisions call for, in the recorded order, from the release worktree
at the tag, the same way production will be deployed. Each part below is its own **[approve]**.
Parts marked `after` deploy here too, so the project team can test them, but staging.html keeps
serving the previous release against them until Release Staging; tell the developer so they can
decide whether that matters.

Every command takes `--project <project>` and `--config <worktree>/firebase.json`. The `npm run
deploy:*` scripts pass neither and `.firebaserc` has no default project, so don't use them. Use
firebase-tools 15 or later through `npx firebase` (check `npx firebase --version`), not the copy
in `functions-v2/node_modules` or `authoring-api/node_modules`: those packages pin firebase-tools
13. Below, `<project>` is `collaborative-learning-staging` here and `collaborative-learning-ec215`
in shipping.md.

**Indexes:**
`npx firebase deploy --only firestore:indexes --project <project> --config <worktree>/firebase.json`.
Leave off `--non-interactive` and `--force`: the CLI asks before deleting indexes that aren't in
the file, and the answer is no unless the developer decides otherwise. Wait until the new indexes
show Enabled (`npx firebase firestore:indexes --project <project>`, or the console) before the
next part.

**Firestore rules:**
`npx firebase deploy --only firestore:rules --project <project> --config <worktree>/firebase.json --non-interactive`.
Then read the deployed rules back (preparing.md) and compare them with the tag's `firestore.rules`.

**RTDB rules:** only when the developer has decided to, after comparing the deployed rules with the
file (preparing.md):
`npx firebase deploy --only database --project <project> --config <worktree>/firebase.json --non-interactive`.

**functions-v2:**

1. **Compare params:** the tag has `functions-v2/.env.collaborative-learning-staging` and
   `functions-v2/.env.collaborative-learning-ec215`. They set every non-secret param the tag
   declares (`functions-v2/test/deploy-env-files.test.ts` fails CI otherwise). Compare
   `<worktree>/functions-v2/.env.<project>` with the project's deployed values (`functions:list
   --json` → `environmentVariables`). A difference is either something this release changes or a
   deploy that went out from somewhere else; find out which before deploying. Don't copy a `.env`
   into the worktree: the CLI deploys every key a plain `.env` sets, as well as the project file's.
2. **Install:** `npm --prefix <worktree>/shared ci` and `npm --prefix <worktree>/functions-v2 ci`.
3. **Deploy:**
   `npx firebase deploy --only functions:functions-v2 --project <project> --config <worktree>/firebase.json --non-interactive`.
4. **Check:** `git -C <worktree> status --short` is empty (a deploy that asked for a param would
   have written to a project file), and check the functions' deploy times and params.

Deploy all of functions-v2, not a subset. Each function keeps the params it was deployed with, so a
subset deploy leaves the others on older values.

**authoring-api:**

1. **Build and compare params:** keep `authoring-api/.env` in the developer's checkout
   (gitignored). If it's missing, build it from a deployed function's non-secret values
   (`functions:list --json` → `environmentVariables`). Find every param the tag declares by
   grepping for `defineString`, `defineInt` and `defineBoolean` in `authoring-api/src`, and check
   the file sets each one: the CLI asks for any param the file leaves out, even one with a default,
   so a non-interactive deploy fails. `authoring-api/.env.example` lists the current ones. Compare
   the file with each project's deployed values.
2. **Install:** `npm --prefix <worktree>/shared ci` and `npm --prefix <worktree>/authoring-api ci`.
3. **Deploy:** copy `authoring-api/.env` into the worktree, then run
   `npx firebase deploy --only functions:authoring-api --project <project> --config <worktree>/firebase.json --non-interactive`.
4. **Clean up and check:** delete the copied `.env`, and check the functions' deploy times and
   params.

**functions-v1:** stop and ask. Production's 1st-gen functions are in codebase `default` on
nodejs16 while staging's are in `functions-v1` (preparing.md), so a `--only
functions:functions-v1` deploy doesn't do the same thing on both projects. Work out the commands
with the developer and record them.

After each deploy, check what's deployed matches the tag (preparing.md, "What's deployed").

## Smoke test

Run the portal launch spec against a release assignment on staging. It launches as a student,
checks the edit persists, and checks the teacher sees it.

First check the assignment's resource URL includes `firebaseEnv=staging` (the resource's edit
page, or the portal API). The spec writes to whichever Firebase the resource launches into, so
without it the run writes test data to production. In that case, stop and ask: running it is then
**[approve]**.

```bash
npx cypress run --spec cypress/e2e/portal/student_teacher_launch_spec.js \
  --config baseUrl=https://collaborative-learning.concord.org/,retries=0 \
  --env PORTAL_LAUNCH_TARGET=portal,PORTAL_LAUNCH_OFFERING_ID=<offering>,PORTAL_LAUNCH_REPORT_ID=<report>,PORTAL_LAUNCH_EXPECTED_VERSION=<X.Y.Z>
```

The run must report `Tests: 1, Passing: 1`. `retries=0` turns off the retries CI uses, so a failure
that only happens sometimes still fails the check. Treat any failure as a finding, not a flake to
rerun past. A failed run leaves its marker tile behind, and a new run stops on a marker from the
last 15 minutes, so rerun after a fix with `PORTAL_LAUNCH_DELETE_RECENT_MARKERS=true` added to
`--env`.

Credentials come from `cypress.env.json`; in a worktree, symlink the main checkout's file. See
`cypress/e2e/portal/README.md`. `PORTAL_LAUNCH_TARGET=portal` launches the portal's own URLs, so it
also checks the resource and report setup. If there's no assignment for the release yet, use the
setting-up-portal-assignments skill; creating one is a portal write **[approve]**. Before the
first run on a new assignment, launch it once as the student, joining a group, and once as the
teacher.

The console shows a couple of Firestore `permission-denied` snapshot-listener errors around each
launch and document switch. They were there in 7.5.0 too; compare with the previous version before
calling one a regression.

## Hand over to the project team [approve]

Tell the project team's tester in #clue-dev that the release is ready on the staging portal. Write the
draft to a temporary Markdown file for the developer to edit, then post it. Include:
- the version URL and the release notes link;
- which of their resources changed, and that staging Firebase starts without their old work;
- where the other staging-Firebase resources are.

Keep a testing checklist out of the post unless the developer wants one.

## Release Staging [approve]

```bash
date -u +%Y-%m-%dT%H:%M:%SZ                                        # <dispatched>, before the run
gh workflow run release-staging.yml --ref master -f version=v<X.Y.Z>
gh run list --workflow release-staging.yml --event workflow_dispatch \
  --json databaseId,createdAt --jq '.[] | select(.createdAt >= "<dispatched>") | .databaseId'
gh run watch <id> --exit-status
```

`gh workflow run` returns before the run exists, and the newest run until then is the previous
release's, which already succeeded, so watching it would report a false pass. Repeat the `gh run
list` until it prints an id; take only a run created after `<dispatched>`.

The log should show "Assuming role with OIDC" and four `copy:` lines, to `staging.html`, `editor/`,
`authoring/` and `authoring-iframe/`. Then check with `deployed-version.ts`. The staging page is
`https://collaborative-learning.concord.org/staging.html`.
