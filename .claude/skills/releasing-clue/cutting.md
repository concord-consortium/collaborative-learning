# Phase 2: Cutting and staging

Gated actions are marked **[approve]**; see "Approval gates" in SKILL.md.

The release branch comes first and the tag later. A pushed tag never moves, so a fix found after
it means a patch release; smoke testing the branch first lets a fix go in before the tag. The
order:

1. Before cutting: checks.
2. Release branch, its CI, and a full regression run on it.
3. Staging portal: the branch set.
4. Staging Firebase.
5. Smoke test on the branch. A failure means a fix on the branch, then repeat.
6. Version and tag, once the release notes and pre-announcement (preparing.md) are done.
7. GitHub pre-release.
8. Staging portal: the version set.
9. Smoke test on the tag.
10. Hand over to the project team.
11. Release Staging.

## Before cutting

- **The developer confirms what must be in the release.** A story that isn't Done doesn't block the cut
  if its code is merged; say which ones you're treating that way.
- **Checks:** `git fetch --tags`. Look for merges since the last triage, and read what each one
  changes; a merge freeze doesn't stop people merging, so show the developer any that landed
  during it. Master's CI is green (`gh run list --branch master`). Neither the branch nor the tag
  exists on origin yet.
- **Regression tests:** CI Regression skips its Cypress jobs on a tag or a release branch (they run
  only on master or with the `run regression` label), so those runs mean nothing. The gate is a
  Manual Regression run on the release branch itself ("Release branch" below). Before cutting,
  master's CI Regression run for the commit you'll cut from is a guide to picking `<sha>`:

  ```bash
  gh run list --workflow ci-regression.yml --branch master --commit <sha> \
    --json databaseId,status,conclusion,url
  ```

  If it failed, tell the developer what you found before cutting: they may want an earlier
  commit, or a fix first. If it's still running or doesn't exist (master's runs cancel each other
  when merges land close together), say so and carry on; the branch run covers it.

  Failures across unrelated specs, on a commit that can't have caused them, can mean a live
  outage outside the repo, such as production functions that stop starting. Tell the developer
  straight away. While investigating, check the failure is still happening (an error count over
  the last few minutes) before trusting any test's result, and again between tests: a probe run
  after the outage ends says nothing about its cause.

## Release branch [approve]

Work in a separate worktree, so the developer's checkout isn't touched. `<sha>` is the master
commit whose regression run you checked:

```bash
git worktree add -b v<X.Y>.x ../v<X.Y>.x <sha>                             # [approve]
git -C ../v<X.Y>.x push origin v<X.Y>.x                                     # [approve]
```

If a merge freeze is on, lift it once the branch is on origin: a reply in the status thread
**[approve]** saying the branch is made and merging to master is fine again.

The push starts CI Base, which builds and deploys to `branch/v<X.Y>.x/`. Find its run with `gh run
list --workflow ci.yml --branch v<X.Y>.x`, then `gh run watch <id> --exit-status`; it must pass
before the smoke test. Confirm `https://collaborative-learning.concord.org/branch/v<X.Y>.x/` loads
(a 200). CI Functions v2 doesn't run here: `functions-v2.yml` only runs on pushes that change
`functions-v2/`, `shared/` or the workflow, which a new branch at a master commit doesn't. It runs
for the tag, and for a fix on the branch that changes those paths.

**Full regression on the branch [approve].** Manual Regression with `test=all` runs the same
specs as CI Regression (`cypress/e2e/functional/**` and the portal specs it opts in) against the
branch's code, without a PR:

```bash
date -u +%Y-%m-%dT%H:%M:%SZ                                        # <dispatched>, before the run
gh workflow run manual-regression.yml --ref master -f branch=v<X.Y>.x -f browser=chrome -f test=all
gh run list --workflow manual-regression.yml --event workflow_dispatch \
  --json databaseId,createdAt,displayTitle --jq '.[] | select(.createdAt >= "<dispatched>"
    and .displayTitle == "Manual Regression on v<X.Y>.x (all)") | .databaseId'
gh run watch <id> --exit-status
```

`--ref master` picks the workflow file; `branch=` picks the code it tests. Other developers
dispatch this workflow too, often for a single spec, so match the run's title, which names its
branch and test, as well as its time. Repeat the `gh run list` until it prints an id. It
must pass before the tag; it can run alongside the steps below. If it fails, tell the developer
what failed. To retry a flake, re-run all its jobs **[approve]** (`gh run rerun <id>`, never
`--failed`, since Cypress Cloud splits the specs across the jobs). A real failure is a fix on the
branch ("A fix before the tag"). Each full run counts against CLUE's monthly Cypress budget, so
don't start one the release doesn't need.

## Staging portal: the branch set

Point learn.portal.staging.concord.org at the release. Run the portal scripts from the developer's
main checkout: the portal tokens are in its `scripts/.env`, which the release worktree doesn't
have (don't copy it). Dry run first; show the output, then run it for real **[approve]**:

```bash
npx --prefix scripts tsx scripts/update-portal-release.ts --tag v<X.Y.Z> \
  --report-id <report ids> --activity-id <resource ids> --dry-run
```

It adds the release's version and branch folders to the `clue` OAuth client's redirect URIs, and
moves the named reports and resources to the release, names included. Re-running is safe, though
each real run is still **[approve]**. It keeps each record's form: a `version/` URL moves to
`version/v<X.Y.Z>/` and a `branch/` URL to `branch/v<X.Y>.x/`.

So it runs twice, with the planned tag both times. Sort the reports and resources to move (below)
by their URL. Now, before the tag exists, move the ones on `branch/`. After the tag, move the ones
on `version/` ("Staging portal: the version set"). Moving those now would point them at a
`version/` folder that doesn't exist yet.

Which reports to move: 10 ("CLUE (test)"), plus the teacher reports the resources you move have
attached, usually "CLUE Teacher Tools (vX.Y.Z, staging FB)" and "(vX.Y.x branch, staging FB)". A
resource's edit page (`/eresources/<id>/edit`) shows its attached reports; the admin index
`/admin/external_reports` lists them all.

Which resources to move:
- **Resources to find:** list every staging resource pinned to a version or branch. There's no
  script for this in `scripts/` yet: write a read-only one in `scripts/local/` on `PortalSession`
  (`readOnly = true`) that uses the admin search API
  `/api/v1/search/search?query=&per_page=5000&private=true&include_templates=true`, which includes
  private and draft resources, and keep URLs containing `/version/` or `/branch/`, other than
  `branch/master`. Archived resources aren't returned.
- **Move without asking which:** the previous release's smoke-test resources ("(vX.Y.Z, staging
  FB)" and "(vX.Y.x branch, staging FB)", created by the admin API user); the project team
  tester's resources; and the developer's own pins.
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
at the branch (fast-forwarded to `origin/v<X.Y>.x` first, as in "Version and tag"), the same way
production will be deployed. Each part below is its own **[approve]**.
First compare staging's deployed copy of each part with the branch ("Firebase deployables" in
preparing.md), and skip a part that already matches. After the tag, compare again: the version
commit changes only the root `package.json` and `package-lock.json`, so a part deployed from the
branch normally still matches, unless a fix came into the branch after the deploy.
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
Then read the deployed rules back (preparing.md) and compare them with the worktree's
`firestore.rules`.

**RTDB rules:** only when the developer has decided to, after comparing the deployed rules with the
file (preparing.md):
`npx firebase deploy --only database --project <project> --config <worktree>/firebase.json --non-interactive`.

**functions-v2** and **authoring-api** take the same four steps. Below, `<codebase>` is
`functions-v2` or `authoring-api`.

1. **Compare params:** the release has `<codebase>/.env.collaborative-learning-staging` and
   `<codebase>/.env.collaborative-learning-ec215`. They set every non-secret param the code
   declares (`deploy-env-files.test.ts` in each codebase fails CI otherwise). Compare
   `<worktree>/<codebase>/.env.<project>` with the project's deployed values (`functions:list
   --json` → `environmentVariables`). A difference is either something this release changes or a
   deploy that went out from somewhere else; find out which before deploying. Don't copy a `.env`
   into the worktree: the CLI deploys every key a plain `.env` sets, as well as the project file's.
2. **Install:** `npm --prefix <worktree>/shared ci` and `npm --prefix <worktree>/<codebase> ci`.
3. **Deploy:**
   `npx firebase deploy --only functions:<codebase> --project <project> --config <worktree>/firebase.json --non-interactive`.
4. **Check:** `git -C <worktree> status --short` is empty (a deploy that asked for a param would
   have written to a project file), and check the functions' deploy times and params.

Deploy all of a codebase, not a subset. Each function keeps the params it was deployed with, so a
subset deploy leaves the others on older values.

**functions-v1:** stop and ask. Production's 1st-gen functions are in codebase `default` on
nodejs16 while staging's are in `functions-v1` (preparing.md), so a `--only
functions:functions-v1` deploy doesn't do the same thing on both projects. Work out the commands
with the developer and record them.

After each deploy, check what's deployed matches the worktree (preparing.md, "What's deployed").

## Smoke test on the branch

Run the portal launch spec against a release assignment on staging. It launches as a student,
checks the edit persists, and checks the teacher sees it. It runs twice: here, against an
assignment whose resource is on `branch/v<X.Y>.x/`, and after the tag against one on
`version/v<X.Y.Z>/`. Each needs its own resource, teacher report and offering for the test class,
since the spec checks the report's CLUE path matches the resource's. The previous release's
smoke-test set has both, assigned in the developer's class and created by the admin API user:
resources named "(vX.Y.Z, staging FB)" and "(vX.Y.x branch, staging FB)", with the matching
teacher reports. `GET /api/v1/classes/<id>` lists the class's offerings with their URLs.

First check the assignment's resource URL is on the expected path (`branch/v<X.Y>.x/` here) and
includes `firebaseEnv=staging` (the resource's edit page, or the portal API). On the branch the
spec can't check the version, so the path is what shows it tested the branch build. The spec writes to whichever Firebase the resource launches into, so
without it the run writes test data to production. In that case, stop and ask: running it is then
**[approve]**.

```bash
npx cypress run --spec cypress/e2e/portal/student_teacher_launch_spec.js \
  --config baseUrl=https://collaborative-learning.concord.org/,retries=0 \
  --env PORTAL_LAUNCH_TARGET=portal,PORTAL_LAUNCH_OFFERING_ID=<offering>,PORTAL_LAUNCH_REPORT_ID=<report>
```

On the branch, leave out `PORTAL_LAUNCH_EXPECTED_VERSION`: until `npm version` runs, the branch
has master's `package.json` version, so CLUE doesn't show `<X.Y.Z>` yet. The report is usually
"CLUE Teacher Tools (vX.Y.x branch, staging FB)".

The run must report `Tests: 1, Passing: 1`. `retries=0` turns off the retries CI uses, so a failure
that only happens sometimes still fails the check. Treat any failure as a finding, not a flake to
rerun past. A failed run leaves its marker tile behind, and a new run stops on a marker from the
last 15 minutes, so rerun after a fix with `PORTAL_LAUNCH_DELETE_RECENT_MARKERS=true` added to
`--env`.

Credentials come from `cypress.env.json`; in a worktree, symlink the main checkout's file. See
`cypress/e2e/portal/README.md`. `PORTAL_LAUNCH_TARGET=portal` launches the portal's own URLs, so it
also checks the resource and report setup. If there's no assignment for the branch or the version
yet, use the setting-up-portal-assignments skill; creating one is a portal write **[approve]**.
Before the first run on a new assignment, launch it once as the student, joining a group, and once
as the teacher.

The console shows a couple of Firestore `permission-denied` snapshot-listener errors around each
launch and document switch. They were there in 7.5.0 too; compare with the previous version before
calling one a regression.

**A fix before the tag.** If the smoke test, or anything else before the tag, finds a problem,
stop and work out with the developer how the fix reaches the branch (for example, merged to
master and cherry-picked **[approve]**). Then watch the branch's CI again, rerun the full
regression on the branch, redeploy any Firebase part the fix touches, and rerun the branch smoke
test. If the fix adds a story to the version after the
pre-announcement went out, tell the developer: the GitHub release will list it and the post won't,
and a reply in the post's thread can cover it. Record what was done.

## Version and tag [approve]

Once the branch's regression run and smoke test pass, on the branch's current commit, and the
release notes and pre-announcement are done, bring the
worktree up to date with origin's branch and check what's on it since `<sha>`. A fix that reached
the branch on GitHub leaves the worktree behind, and `npm version` would tag the commit before it.

```bash
git -C ../v<X.Y>.x fetch origin
git -C ../v<X.Y>.x merge --ff-only origin/v<X.Y>.x                          # local only
git -C ../v<X.Y>.x log --oneline <sha>..HEAD                                # what the tag adds
npm --prefix ../v<X.Y>.x version <X.Y.Z>                                    # [approve]
git -C ../v<X.Y>.x push --atomic origin v<X.Y>.x v<X.Y.Z>                   # [approve]
```

`--atomic` pushes both or neither, so a rejected branch push can't leave a tag on origin.

`npm version` commits `package.json` and `package-lock.json` with the message `<X.Y.Z>`, and
creates the annotated tag `v<X.Y.Z>`. Only release branches get the version; master's
`package.json` stays behind.

Pushing the tag starts CI Base, which builds and deploys to `version/v<X.Y.Z>/`, along with CI
Functions v2 and CI Regression. The branch push starts its own runs; watch **the tag's**. For each
of `ci.yml` and `functions-v2.yml`, find the run with `gh run list --workflow <file> --branch
v<X.Y.Z>`, then `gh run watch <id> --exit-status`. Both must pass before Release Staging. Confirm
`https://collaborative-learning.concord.org/version/v<X.Y.Z>/` loads; a 200 is enough here, since
`deployed-version.ts` checks the compiled version after Release Staging.

## GitHub release [approve]

```bash
npm --prefix <dev-templates>/scripts run -s release-notes-jira CLUE <X.Y.Z> > <scratchpad>/notes.md
gh release create v<X.Y.Z> --title <X.Y.Z> --notes-file <scratchpad>/notes.md \
  --prerelease --latest=false
```

The title is the bare version. Flatten the same sections as in the pre-announcement ("Release
notes" in preparing.md): remove their epic subheadings from `notes.md`. The release is a
pre-release until it reaches production, so the release list's Latest badge always marks what
production serves; shipping.md promotes it. If this version never ships (a show-stopper leads to
a new patch), it stays a pre-release and keeps its notes, since tags are never moved.

## Staging portal: the version set

Run `update-portal-release.ts` again, as in "Staging portal: the branch set", with the reports
and resources on `version/`: dry run, then **[approve]**. The OAuth client already has both
folders, so only the records change. A second dry run afterward should show nothing left to
change.

## Smoke test on the tag

Run the spec as in "Smoke test on the branch", against the assignment on `version/v<X.Y.Z>/`
(report usually "CLUE Teacher Tools (vX.Y.Z, staging FB)"), with
`PORTAL_LAUNCH_EXPECTED_VERSION=<X.Y.Z>` added to `--env`. Check the resource's path and
`firebaseEnv` first, as there. If it fails, stop and tell the developer: the tag can't change, so a fix now
means a patch release.

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
