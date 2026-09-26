# Portal launch specs

Specs here launch CLUE the way a class does: log in to a real portal as a student or teacher,
follow the portal's redirect to CLUE, and run against real Firebase under the portal's rules.
Most other specs use `qa` or `demo` appMode, which skip all of that.

## Which workflows run them

No workflow picks these up by folder. Each workflow lists the portal specs it runs in its
`spec:` input (comma-separated, after `cypress/e2e/functional/**`), because each needs portal
users and an assignment the workflow has to provide. **A new spec here runs nowhere until you
add it to a workflow.** To dispatch one alone, also add it to the `test` choices in
`.github/workflows/manual-regression.yml`.

## `student_teacher_launch_spec.js`

A student launches an assignment, adds text to their problem document, launches again and finds
it; the teacher launches the assignment's report and finds it on the dashboard; the student then
removes it. Every run writes text unique to itself and checks only for that, so leftovers from a
failed run, or another run at the same time, do not affect the result.

`PORTAL_LAUNCH_TARGET` chooses what a launch runs:

- `baseUrl` (default): only the query string of the portal's redirect is kept, and it runs on the
  build at the Cypress `baseUrl` — a local, branch or older build. The version in the portal
  resource's URL is ignored.
- `portal`: the portal's redirect is visited as is, so the run also tests the resource's and
  report's URLs. Use this for a release. The `baseUrl` then only needs to be on the CLUE site
  (`https://collaborative-learning.concord.org/`), so Cypress doesn't wait for a local server.

Either way the spec checks, from the portal's redirects, that the report runs the same CLUE path
and `firebaseEnv` as the assignment; a mismatched report would show the teacher none of the
student's work.

Settings, read by `cypress/support/portal-launch.js`:

| Key | |
|---|---|
| `PORTAL_LAUNCH_STUDENT_USERNAME` / `_PASSWORD` | a student in the offering's class |
| `PORTAL_LAUNCH_TEACHER_USERNAME` / `_PASSWORD` | a teacher of that class |
| `PORTAL_LAUNCH_OFFERING_ID` | the assignment (portal offering) the student launches |
| `PORTAL_LAUNCH_REPORT_ID` | the external report the teacher launches for it |
| `PORTAL_LAUNCH_TARGET` | optional, `baseUrl` (default) or `portal`; see above |
| `PORTAL_LAUNCH_PORTAL_URL` | optional, default `https://learn.portal.staging.concord.org` |
| `PORTAL_LAUNCH_EXPECTED_VERSION` | optional; when set, the version CLUE shows must match |

Without the first six the spec declares no tests at all, so a run lacking them reports 0 tests
rather than a skipped one.

Keep the credentials in `cypress.env.json` (or in secrets, in CI) and pass the ids on the command
line. Always pass `--config baseUrl=...` and no `--env testEnv=...`, which would replace it.
For a release, testing the portal's own settings:

```bash
npx cypress run --spec cypress/e2e/portal/student_teacher_launch_spec.js \
  --config baseUrl=https://collaborative-learning.concord.org/ \
  --env PORTAL_LAUNCH_TARGET=portal,PORTAL_LAUNCH_OFFERING_ID=1242,PORTAL_LAUNCH_REPORT_ID=77,PORTAL_LAUNCH_EXPECTED_VERSION=7.6.0
```

For a local build, through the same assignment:

```bash
npx cypress run --spec cypress/e2e/portal/student_teacher_launch_spec.js \
  --config baseUrl=http://localhost:8080/ \
  --env PORTAL_LAUNCH_OFFERING_ID=1242,PORTAL_LAUNCH_REPORT_ID=77
```

`scripts/setup-portal-assignment.ts` creates an assignment and report and prints their ids. Use
different users and assignments for different schedules, so they do not share Firebase state.
