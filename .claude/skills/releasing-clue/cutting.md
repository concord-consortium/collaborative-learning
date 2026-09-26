# Phase 2: Cutting and staging

Gated actions are marked **[approve]**; see "Approval gates" in SKILL.md.

## Before cutting

- **The developer confirms what must be in the tag.** A story that isn't Done doesn't block the cut
  if its code is merged; say which ones you're treating that way.
- **Checks:** `git fetch --tags`. Look for merges since the last triage, and read what each one
  changes. Master's CI is green (`gh run list --branch master`). Neither the branch nor the tag
  exists on origin yet.

## Branch, version and tag

Work in a separate worktree, so the developer's checkout isn't touched:

```bash
git worktree add -b v<X.Y>.x ../v<X.Y>.x origin/master                     # [approve]
npm --prefix ../v<X.Y>.x version <X.Y.Z>                                    # [approve]
git -C ../v<X.Y>.x push origin v<X.Y>.x v<X.Y.Z>                            # [approve]
```

`npm version` commits `package.json` and `package-lock.json` with the message `<X.Y.Z>`, and
creates the annotated tag `v<X.Y.Z>`. Only release branches get the version; master's
`package.json` stays behind.

Pushing the tag starts CI Base, which builds and deploys to `version/v<X.Y.Z>/`, along with CI
Functions v2 and CI Regression. The branch push starts its own CI Base run; watch **the tag's**:
find it with `gh run list --workflow ci.yml --branch v<X.Y.Z>`, then `gh run watch <id>
--exit-status`. Confirm `https://collaborative-learning.concord.org/version/v<X.Y.Z>/` loads.

## GitHub release [approve]

```bash
npm --prefix ~/Development/dev-templates/scripts run -s release-notes-jira CLUE <X.Y.Z> > <scratchpad>/notes.md
gh release create v<X.Y.Z> --title <X.Y.Z> --notes-file <scratchpad>/notes.md
```

The title is the bare version. The notes include the epic subheadings. Check GitHub marks it Latest.

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
  FB)", created by the admin API user); the project team's test resources (Leslie's); and the
  developer's own pins.
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
at the tag, the same way production will be deployed. For functions-v2:

1. **Build and compare params:** keep `functions-v2/.env` in the developer's checkout (gitignored).
   If it's missing, build it from a deployed function's non-secret values (`functions:list --json`
   → `environmentVariables`; `chatTutorOnWrite` carries all of them). Find every param the tag
   declares by grepping for `defineString`, `defineInt` and `defineBoolean` in `functions-v2/src`
   **and** `functions-v2/lib/src` (committed source lives there too). Every one needs a value, even
   one with a default, or a non-interactive deploy fails. Compare the file with each project's
   deployed values. Don't create `.env.<projectId>` files: they aren't gitignored, the Firebase
   CLI loads them too, and committing them is its own story (CLUE-659).
2. **Install:** `npm --prefix <worktree>/shared ci` and `npm --prefix <worktree>/functions-v2 ci`.
3. **Deploy:** copy `functions-v2/.env` into the worktree, then run
   `npx firebase deploy --only functions:functions-v2 --project collaborative-learning-staging --config <worktree>/firebase.json --non-interactive`.
4. **Clean up and check:** delete the copied `.env`, and check the functions' deploy times and
   params.

Deploy all of functions-v2, not a subset. Each function keeps the params it was deployed with, and
string params default to empty, so a deploy without the ForeverLearning values would wipe them from
`chatTutorOnWrite`. Use firebase-tools 15 or later through `npx firebase` (check `npx firebase
--version`); the copy inside `functions-v2/node_modules` has been a broken install.

## Smoke test

Run the portal launch spec against a release assignment on staging. It launches as a student,
checks the edit persists, and checks the teacher sees it:

```bash
npx cypress run --spec cypress/e2e/portal/student_teacher_launch_spec.js \
  --config baseUrl=https://collaborative-learning.concord.org/ \
  --env PORTAL_LAUNCH_TARGET=portal,PORTAL_LAUNCH_OFFERING_ID=<offering>,PORTAL_LAUNCH_REPORT_ID=<report>,PORTAL_LAUNCH_EXPECTED_VERSION=<X.Y.Z>
```

Credentials come from `cypress.env.json`; in a worktree, symlink the main checkout's file. See
`cypress/e2e/portal/README.md`. `PORTAL_LAUNCH_TARGET=portal` launches the portal's own URLs, so it
also checks the resource and report setup. If there's no assignment for the release yet, use the
setting-up-portal-assignments skill; creating one is a portal write **[approve]**.

The console shows a couple of Firestore `permission-denied` snapshot-listener errors around each
launch and document switch. They were there in 7.5.0 too; compare with the previous version before
calling one a regression.

## Hand over to the project team [approve]

Tell the tester (Leslie) in #clue-dev that the release is ready on the staging portal. Write the
draft to a temporary Markdown file for the developer to edit, then post it. Include:
- the version URL and the release notes link;
- which of their resources changed, and that staging Firebase starts without their old work;
- where the other staging-Firebase resources are.

Keep a testing checklist out of the post unless the developer wants one.

## Release Staging [approve]

```bash
gh workflow run release-staging.yml --ref master -f version=v<X.Y.Z>
gh run list --workflow release-staging.yml --limit 1     # the run id
gh run watch <id> --exit-status
```

The log should show "Assuming role with OIDC" and four `copy:` lines, to `staging.html`, `editor/`,
`authoring/` and `authoring-iframe/`. Then check with `deployed-version.ts`. The staging page is
`https://collaborative-learning.concord.org/staging.html`.
