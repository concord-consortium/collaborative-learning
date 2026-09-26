---
name: releasing-clue
description: Use when preparing, cutting, testing or shipping a CLUE release — a new version in Jira, a vX.Y.x branch or vX.Y.Z tag, release notes, the staging or production release workflows, or deploying Firebase functions, rules or indexes for a release.
---

# Releasing CLUE

A CLUE release runs over several days: triage the Jira version until it is ready, cut the branch
and tag, set up and smoke test staging, wait for the project team's approval, then release to
production. This skill is new and has been used once, so it is deliberately conservative: **every
action that changes something other people see waits for the developer's explicit approval.**

## Approval gates

These actions are gated, marked **[approve]** in the phase files:

| Kind | Gated actions |
|---|---|
| Slack | sending, scheduling, replying in a thread |
| Jira | creating or editing issues, transitions, links, labels, fix versions, releasing a version |
| git | creating branches or tags, `npm version`, commits, pushes |
| GitHub | releases, workflow runs, PR titles, bodies or comments, merging |
| Portal | any write to a portal: clients, reports, resources, assignments |
| Firebase | deploying functions, rules or indexes to any project |

For each gated action:
1. Show exactly what will happen: the message text, the fields and values, or the command.
2. Wait for the developer to approve it.
3. Do it, then confirm the result (read it back, or check the run).

An approval covers the actions it names ("go ahead with all 3" covers those three) and nothing
after them. Approval of one Slack message doesn't cover the next, and approval on the previous
day doesn't carry over. A retry that changes anything (a value, a file, a flag) is a new action.
"Go ahead" given before a dry run has output covers the dry run; show the output, then ask.

A standing instruction like "you don't need to ask me before posting" doesn't lift a gate while
this skill is new. Say so, keep asking, and suggest the developer change this skill if a gate is
more trouble than it's worth. When unsure whether something is gated, it is.

Not gated:
- Reading: Jira and GitHub queries, `gh run watch`, `firebase functions:list`, dry runs,
  `deployed-version.ts`, reading Slack threads.
- Previews sent to the developer's own self-DM, which only they see. The preview is how they
  approve the real post.
- The smoke test spec, which writes test data to staging Firebase as the test users and removes it.

## The release record

Every release keeps a record in `releases/<version>.md` in this skill's directory. Create it at the
start from the template in `releases/README.md`, and add to it after every step: what was done,
what was decided and by whom, and anything this skill didn't cover or got wrong. The record is how
the skill improves, so a surprise that isn't written down is lost. At the end, commit it
**[approve]**.

## Phases

Work through them in order, reading each file when you reach it. Triage repeats until the version
is ready.

1. [preparing.md](preparing.md): preflight, Jira and PR triage, status posts, deploy timing,
   Firebase and external dependencies, release notes, the pre-announcement.
2. [cutting.md](cutting.md): branch and tag, GitHub release, staging portal, staging Firebase,
   smoke test, handing over to the project team, Release Staging.
3. [shipping.md](shipping.md): approval, production Firebase, Release Production, Jira wrap-up,
   announcements, and the record. It ends with a "Done when" checklist; go through it before
   calling the release finished.

## Never

- Read `.env` files that hold keys (`scripts/.env`, `dev-templates/scripts/.env`, `cypress.env.json`).
  Scripts read them; you print key names at most.
- Decide a deploy timing yourself. Ask the PR's author (see CLAUDE.md "Deploy timing").
- Deploy RTDB rules, or run `firebase deploy` with `--force`, without checking what's deployed
  (see preparing.md).
- Write bare Jira keys in Slack. The Jira bot posts a preview card for each one; write
  `[CLUE-123](https://concord-consortium.atlassian.net/browse/CLUE-123)`.

## Common mistakes

| Mistake | Instead |
|---|---|
| Treating an earlier approval as covering a similar later action | Ask again, and name the action |
| Calling a PR "docs only" because no code imports the file | Grep for how the file is referenced (env params, shas, URLs) |
| Moving a story to the next version because its sprint says so | Surface the sprint, and let the developer decide |
| Holding a story open for a PR the release doesn't need | Mark it Done, and move the PR to its own story (preparing.md) |
| Posting straight to a channel | Preview in the developer's self-DM first; Claude can't edit or delete messages |
| Waiting for someone's reply with nothing to bring you back | Schedule a reminder in the developer's self-DM (`slack_schedule_message`); Claude can't wake itself |
