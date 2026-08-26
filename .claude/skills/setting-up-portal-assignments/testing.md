# Testing this skill

How to verify this skill still works after editing it, without writing anything to a portal.

Two complementary checks. The first tests the judgment the skill teaches; the second tests
that the judgment survives contact with the real portal API.

**Both are read-only.** `--dry-run` is enforced by `PortalSession.readOnly`, which throws on
any non-GET rather than trusting each call site to check — see the comment on that field for
why. Never verify this skill by running the script without `--dry-run`.

## Check 1 — plan scoring

Give a fresh agent the scenario below and the skill, require read-only, and score the command
it constructs. Every decision the skill teaches is visible in that command before anything
executes.

Run at least 3 reps; single samples lie. For a baseline, run the same scenario with the skill
withheld and compare — a check that passes with and without the skill is not evidence the
skill did anything.

### Scenario

> A developer wants to test the git branch `CLUE-652-firebase-env-jwt-app` on the staging
> portal, as a real student and as a teacher, using the `seismic` unit, problem 1.3, in
> Scott Cytacki's class called "Class A". Read
> `.claude/skills/setting-up-portal-assignments/SKILL.md` and follow it. Do not run the
> script without `--dry-run`.

### Rubric

| # | Expected | Why it is the test |
|---|---|---|
| 1 | `--class-id 111` | Class names are not unique. Found via the teacher route (`/api/v1/teachers/<id>/classes`), **not** `GET /api/v1/classes/mine` (403s for the admin token) and **not** a sweep of class ids. The one item no unaided agent got right. |
| 2 | `--clue-path branch/firebase-env-jwt-app` | The Jira prefix is stripped by the deploy action. `branch/CLUE-652-firebase-env-jwt-app` is a fail. |
| 3 | `--unit seismic` | A curriculum unit is passed by code; a demo unit would be a `./demo/units/<x>/content.json` path. |
| 4 | `--problem 1.3` confirmed against the unit's `content.json` | Seismic investigation 1 has problems 1.1–1.5. An ordinal picked without checking is a fail even when it happens to be valid. |
| 5 | Says to launch from the class, not the resource page | A resource-page run never sends a token. |
| 6 | Says to launch as teacher once before checking teacher views | `teacherIsInClass()` reads a Firestore doc CLUE writes on teacher login. |

Items 5 and 6 are guidance, not flags — look for them in the agent's report.

## Check 2 — dry-run assertion

Have the agent actually run its command with `--dry-run` and report the output verbatim. This
exercises the real class lookup, the real admin-index pagination, and the real report and
client lookups, all read-only.

A correct run for the scenario above prints lines matching:

```
Class 111: Scotts Class A (teachers: Scott Cytacki, ...)
OAuth client 6: app_id "clue"
```

and, because nothing exists at that URL yet, an Activity line saying it cannot tell whether it
would create or reuse. That uncertainty is correct behaviour, not a defect: the only existence
probe the portal offers is a write, so a dry run cannot use it.

Failure modes worth distinguishing:

- `403 Not authorized` on the class lookup → the agent used `classes/mine`.
- `No portal OAuth client found` → admin-index pagination regressed.
- A `Read-only session refused ...` error → a dry run reached a write. That is a script bug,
  not an agent mistake; fix the script.

## What these checks do not cover

The write paths — creating an activity, offering, or report — are exercised only by a real
run. Verify those against a disposable class, or a locally-run portal
(`rigse/docs/testing-resource-launches-locally.md`), not against a class anyone is using.
