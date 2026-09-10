---
name: setting-up-portal-assignments
description: Use when a CLUE build needs a real portal launch rather than demo or qa appMode - release smoke tests against the Firebase security rules, or trying a version or branch as a real student or teacher. Also when creating or assigning a resource, external activity, offering, or assignment for a class on the staging or production portal.
---

# Setting up portal assignments

Most CLUE tests run in `demo` or `qa` appMode, whose Firebase paths are governed by rules
amounting to `if isAuthed()`. Only a launch from a portal assignment, carrying a portal
token, exercises the real `authed/<portal>` rules.

`scripts/setup-portal-assignment.ts` does the writing and handles the portal's traps. Your
job is the five decisions it cannot make, and the launch instructions at the end.

## 1. Identify the class — this is the step that goes wrong

**Class names are not unique.** "Class A" exists many times over on staging, under different
teachers. The script takes `--class-id` for that reason. Never pick a class by name alone.

**The API token is a shared admin service account, not the developer's own user.** It is
neither a teacher nor a student, so the obvious endpoint fails:

```
GET /api/v1/classes/mine   ->  403 Not authorized
```

That is the token working correctly. Do not treat it as broken, and do not go looking for a
different token.

Go from the teacher to their classes, rather than searching classes:

1. Identify the portal user. `git config user.email` gives the developer's address; find the
   matching user in the admin user index (`/users?search=<name>`). Expect more than one hit —
   people have a work account and a personal one, and separate test-teacher accounts.
2. That user's admin page links to their Teacher Page, `/portal/teachers/<teacher_id>` — note
   that the teacher id is **not** the user id.
3. `GET /api/v1/teachers/<teacher_id>/classes` lists exactly their classes, with ids.

Then `GET /api/v1/classes/<id>` for the chosen one to confirm `name`, `class_word`, `teachers`
and `students`.

Do not sweep a range of class ids looking for a match. It is slow, it hits every class in the
portal, and it can be refused outright as bulk enumeration.

**Show the developer the candidates and let them choose**, reporting id, name, and teacher
list. Near-identical names across accounts are the normal case, not the exception — one real
example: `Scotts Class A` (id 111, work account, 3 students) versus `Scott Gmail Class A`
(id 257, personal account, no students). Confirm the class actually has students if student
behavior is being tested.

Ask whose classes to use before starting. Default to the current developer, but offer a shared
test teacher if they would rather not use their own account.

## 2. Choose the unit

- **Curriculum units** live in the `clue-curriculum` repo (`curriculum/<unit>/content.json`)
  and are passed by code: `--unit seismic`. If that repo is checked out locally, list the
  directories under `curriculum/`.
- **Demo units** live here under `src/public/demo/units/<unit>/content.json` and are passed
  as a path: `--unit ./demo/units/qa/content.json`. Use these for units that exist only for
  testing, such as `qa` and `qa-class-wide`.

A release smoke test usually wants a real curriculum unit; a feature test often wants the
demo unit built for it.

## 3. Choose the problem

Read the unit's `content.json` and list the real investigations and problems rather than
guessing — a problem ordinal that does not exist gives CLUE no resource info, and it reports
"This CLUE resource is incorrectly configured" instead of loading.

Each investigation has an `ordinal` and a `problems` array whose entries have their own
`ordinal` and `title`. The parameter is `<investigation>.<problem>`, e.g. `1.1`.

For a curriculum unit not checked out locally:
`https://models-resources.concord.org/clue-curriculum/branch/main/<unit>/content.json`

## 4. Work out the CLUE path

`--clue-path` is the **deployed** path, either `version/<tag>` or `branch/<deployed-name>`.

**A branch's deployed name is not its git name.** The deploy action strips issue-tracker
prefixes and suffixes (`concord-consortium/s3-deploy-action`, `src/deploy-props.ts`):

```js
/^[A-Za-z]{2,}-[0-9]+-(.+)$/    // Jira prefix:    CLUE-123-my-feature  -> my-feature
/^#?[0-9]{8,}-(.+)$/            // Pivotal prefix: 187654321-my-feature -> my-feature
/^(.+)-#?[0-9]{8,}$/            // Pivotal suffix: my-feature-187654321 -> my-feature
```

So `CLUE-654-portal-assignment-setup` deploys to `branch/portal-assignment-setup/`. Apply the
regexes rather than assuming, then **confirm the path returns 200 before using it** — a 404
here is far more likely to be the wrong path than an unbuilt branch.

Stripping means names collide: `CLUE-1-add-widget` and `CLUE-2-add-widget` both deploy to
`branch/add-widget/` and overwrite each other.

## 5. Choose the portal and Firebase project

Default to `--portal staging` for testing. Both portals have a `clue` OAuth client, so the
redirect step works against either.

The script pairs `firebaseEnv` to the portal automatically; override with `--firebase-env`
only deliberately, and keep the student and teacher launches on the *same* Firebase project or
the teacher will see no student work.

Tokens live in `scripts/.env`: `PORTAL_STAGING_ACCESS_TOKEN` and `PORTAL_ACCESS_TOKEN`. See
"Running scripts that connect with the portal" in `scripts/README.md`.

## 6. Run it

Start with `--dry-run`; it reports what it would create versus reuse and writes nothing.

```bash
cd scripts
npx tsx setup-portal-assignment.ts \
  --clue-path version/v7.5.0 \
  --class-id 111 \
  --unit seismic \
  --problem 1.1 \
  --dry-run
```

Then re-run without it. Every step is idempotent, so re-running after changing one flag
reuses whatever already matches. Other flags: `--portal`, `--firebase-env`, `--name`,
`--no-report`, `--no-redirect`, `--activity-id`, `--oauth-client-id`. `--help` lists them all.

## 7. Tell the developer how to launch it

**Launch the assignment from inside the class.** Running a resource directly from its own
page (`/eresources/<id>`) never sends a token, whatever the activity's settings, so CLUE
starts in preview mode and writes to `/demo/`.

**Launch as the teacher once before testing teacher views of student work.** CLUE itself
writes the Firestore `authed/<portal>/classes/<class_hash>` document on teacher login
(`syncTeacherClassesAndOfferings`), and the rules' `teacherIsInClass()` reads it. A first-try
permission error on a teacher read is usually this, not a bug in the build.

**Confirm the launch is authed** — `appMode` should be `authed`, and writes should land under
`/authed/portals/…` rather than `/demo/…`. If it says `demo`, no token arrived.

The teacher report link is `/portal/offerings/<offering>/external_report/<report>`, which also
appears on the assignment for a teacher in that class.

## What the script handles for you

Do not re-derive these; they are already right in the script, and are listed so you recognise
them if something looks odd.

| Concern | How it is handled |
|---|---|
| `append_auth_token` | Always set true. Without it the portal sends neither token nor `domain`/`domain_uid`, and CLUE falls back to preview mode. |
| Report `firebaseEnv` | The report URL carries its own, so teacher and students reach the same Firebase project. |
| Report URL has no `unit`/`problem` | A `unit` param on a teacher launch overrides the offering's own resource info silently. |
| Activity URL keeps `unit` and `problem` | Both the student path and the teacher path read them from the activity URL. |
| OAuth redirect URI | Appended to the shared `clue` client, verified nothing was dropped. Matching is exact, so the trailing slash matters. |
| `rule` parameter | The offering endpoint's allowlist slug; see the comment at its call site. |
| Resource name contains "CLUE" | `isClueAssignment()` matches on that or on `collaborative-learning` in the URL; a non-matching offering vanishes from the teacher's switcher. |

## What the script does NOT guard

- **Tool must stay unset on the activity.** The script never sets `tool_id`, which is correct.
  If someone sets one to LARA by hand, `lara_activity_or_sequence?` sends the offering down a
  branch that **replaces the entire query string**, destroying `unit` and `problem`.
- **Student enrollment.** A student must already be in the class roster; CLUE refuses to start
  otherwise. The script does not enroll anyone.
- **Whether the deployed CLUE path exists.** Check it returns 200 yourself (see step 4).

## Verifying this skill after editing it

See [testing.md](testing.md) for the scenario and rubric. Both checks are read-only; never
verify by running the script without `--dry-run`.
