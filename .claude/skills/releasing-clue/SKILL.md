---
name: releasing-clue
description: Use when preparing, cutting, testing or shipping a CLUE release — a new version in Jira, a vX.Y.x branch or vX.Y.Z tag, release notes, the staging or production release workflows, or deploying Firebase functions, rules or indexes for a release.
---

# Releasing CLUE

A CLUE release runs over several days: triage the Jira version until it is ready, cut the release
branch and smoke test it on staging, tag it and smoke test the tag, wait for the project team's
approval, then release to production. This skill is new, so it is deliberately conservative: **every action that changes
something other people see waits for the developer's explicit approval.**

It covers minor releases (`X.Y.0`, cut from master onto a new `vX.Y.x` branch). A patch release
(`X.Y.Z`, cut from an existing release branch) isn't covered yet: work it out with the developer
from these steps, record what differed, and add the patch path to this skill afterward.

**Resuming:** a release spans several sessions. If `releases/<version>.md` already exists, read
it first and continue from its last completed step rather than starting over.

## Approval gates

These actions are gated, marked **[approve]** in the phase files:

| Kind | Gated actions |
|---|---|
| Slack | sending, scheduling or replying anywhere other than the developer's own self-DM |
| Jira | creating or editing issues, transitions, links, labels, fix versions, releasing a version |
| git | creating branches or tags, `npm version`, commits, pushes |
| GitHub | releases, workflow runs, opening PRs, PR titles, bodies, labels or comments, merging |
| Portal | any write to a portal: clients, reports, resources, assignments |
| Firebase | deploying functions, rules or indexes to any project |
| Google Cloud | any `gcloud` or `firebase` command that creates, updates or deletes something: probe deploys, function deletes, Cloud Run service or env changes, in any project |

For each gated action:
1. Show exactly what will happen: the message text, the fields and values, or the command.
2. Wait for the developer to approve it.
3. Do it, then confirm the result (read it back, or check the run).

An approval covers the actions it names ("go ahead with all 3" covers those three) and nothing
after them. Approval of one Slack message doesn't cover the next, and approval on the previous
day doesn't carry over. A retry that changes anything (a value, a file, a flag) is a new action.
"Go ahead" given before a dry run has output covers the dry run; show the output, then ask.

An approval given ahead of time with conditions ("once the PR merges, CI is green and the author
answers") covers only the facts stated when it was given, and like any approval it doesn't carry
over to the next day. If the facts differ when the time comes, stop and ask: for example, the
answer came another way (a Jira change instead of a reply), or the cut now includes commits nobody
mentioned. A rule the developer approves for changing an approved message ("drop any story that's
Done by then") is part of that approval; any other change to the text needs a new preview.

A standing instruction like "you don't need to ask me before posting" doesn't lift a gate while
this skill is new. Say so, keep asking, and suggest the developer change this skill if a gate is
more trouble than it's worth. When unsure whether something is gated, it is.

Not gated:
- Reading: Jira and GitHub queries, `gh run watch`, `firebase functions:list`, dry runs,
  `deployed-version.ts`, reading Slack threads.
- Messages sent or scheduled in the developer's own self-DM, which only they see: previews (the
  preview is how they approve the real post) and reminders.
- The smoke test spec, which writes test data to staging Firebase as the test users and removes it,
  once you've checked the assignment's resource URL has `firebaseEnv=staging` (cutting.md).
  Without it the spec writes to production Firebase, so it is gated.

## The release record

Every release keeps a record in `releases/<version>.md` in this skill's directory. Create it at the
start from the template in `releases/README.md`, and add to it after every step: what was done,
what was decided and by whom, and anything this skill didn't cover or got wrong. The record is how
the skill improves, so a surprise that isn't written down is lost. At the end, commit it
**[approve]**.

## Phases

Work through them in order, reading each file when you reach it. Triage repeats until the version
is ready. One overlap: the release notes and pre-announcement (preparing.md) can be finished while
the branch is tested in cutting.md, as long as they're done before the tag.

1. [preparing.md](preparing.md): preflight, Jira and PR triage, status posts, deploy timing,
   Firebase and external dependencies, release notes, the pre-announcement.
2. [cutting.md](cutting.md): the release branch and a full regression run on it, staging portal
   and Firebase, a smoke test on the branch, then the tag, GitHub pre-release and a smoke test on the tag, handing over to the
   project team, Release Staging.
3. [shipping.md](shipping.md): approval, production Firebase, Release Production, promoting the
   GitHub release, Jira wrap-up, announcements, and the record. It ends with a "Done when"
   checklist; go through it before calling the release finished.

## Never

- Read `.env` files that hold keys (`scripts/.env`, `dev-templates/scripts/.env`, `cypress.env.json`).
  Scripts read them; you print key names at most.
- Decide a deploy timing yourself. Ask the PR's author (see "Deploy timing" in `docs/deploy.md`).
- Deploy RTDB rules, or run `firebase deploy` with `--force`, without checking what's deployed
  (see preparing.md).
- Write bare Jira keys in Slack. The Jira bot posts a preview card for each one; write
  `[CLUE-123](https://concord-consortium.atlassian.net/browse/CLUE-123)` every time the key
  appears, not just the first, or reword ("can it be marked Done"). The self-DM preview can't show
  a card, since that DM isn't connected to Jira, so before posting, search the draft for keys that
  aren't inside `[...](...)`.

## Common mistakes

| Mistake | Instead |
|---|---|
| Treating an earlier approval as covering a similar later action | Ask again, and name the action |
| Calling a PR "docs only" because no code imports the file | Grep for how the file is referenced (env params, shas, URLs) |
| Moving a story to the next version because its sprint says so | Surface the sprint, and let the developer decide |
| Holding a story open for a PR the release doesn't need | Mark it Done, and move the PR to its own story (preparing.md) |
| Posting straight to a channel | Preview in the developer's self-DM first; Claude can't edit or delete messages |
| Waiting for someone's reply with nothing to bring you back | Nothing pushes a Slack reply to the session. Within a session, a background timer or watcher brings you back to check; across sessions, schedule a reminder in the developer's self-DM (`slack_schedule_message`) |
