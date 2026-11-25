# Phase 3: Shipping

Gated actions are marked **[approve]**; see "Approval gates" in SKILL.md.

## Project team approval

Read the tester's replies in the handover thread. Report to the developer what they approved, what
they found, and anything they asked. Bugs they found become stories for the next version, unless
the developer decides otherwise. The developer confirms the release goes ahead.

Release Production waits for the tester's confirmation that they tested the tag on the staging
portal. Approving stories on the branch build doesn't count. Say whether the replies include that
confirmation; if they don't, the developer decides whether to go ahead without it, and if they do,
propose a reply in the handover thread saying so **[approve]**.

A show-stopper means a patch release (`X.Y.1` cut from the release branch), which this skill
doesn't cover yet (SKILL.md). Leave this version's tag and pre-release as they are, work out the
patch with the developer, and record the steps.

## Production Firebase [approve]

Deploy what the deploy-timing decisions call for, with the same commands as staging (cutting.md)
and `--project collaborative-learning-ec215`. Compare production's deployed params first,
for each codebase with the tag's `<codebase>/.env.collaborative-learning-ec215`. Production and
staging can differ. Check `gcloud auth print-access-token` first: the login may have expired since
preparation, and the rules read needs it. Check it again before the read-backs after the deploys:
it has expired within a day of the last login.

Follow the recorded order:
- **`before`:** compare production's deployed copy with the tag ("Firebase deployables" in
  preparing.md), and deploy now, before Release Production, only if they differ.
- **`with`:** deploy immediately before Release Production and start the release right after, so
  the released client and the new part overlap as briefly as possible.
- **`after`:** don't deploy yet. Deploy it once Release Production has succeeded and
  `deployed-version.ts` shows production serving the tag.

## Migration scripts

Run each migration script in the release (`scripts/migrations/`, listed under `migrations` in the
deploy report) at its recorded timing. For a script, the timing says when to run it relative to
Release Production:
- **`before`:** run it while the release is being prepared (preparing.md), from the worktree
  detached at `origin/master` that the `before` deploys use. The tag doesn't exist yet. If it has
  already run against production, it doesn't run again at release time.
- **`with`:** run it immediately before Release Production, from the tag's checkout, and start the
  release right after.
- **`after`:** run it once Release Production has succeeded and `deployed-version.ts` shows
  production serving the tag, from the tag's checkout.

The service-account keys are git-ignored, so they're only in the developer's main checkout. Run
from there when `git diff <ref> -- scripts/` is empty, `<ref>` being the commit the timing names
(the tag, or `origin/master` for `before`); don't copy a key into a worktree.

Every script runs against staging first, then production, and on each a dry run comes first, then,
once its report looks right, the run that writes. The developer runs them, or asks Claude to. Each
write run, and each run with the production key (dry runs and read-only helpers included), needs
an approval that names it and its project; one approval can name a set of batches with the same
flags. For each one, give the commands from the script's header. Record what each run changed or
skipped in the release record.

**The key.** Scripts read `scripts/serviceAccountKey.json`, with no way to name another file:
- Before the first swap, list the `serviceAccountKey*.json` files and print each one's
  `project_id` (SKILL.md, "Never"). Keep every project's key in its own named file
  (`serviceAccountKey.production.json`, `serviceAccountKey.staging.json`; `.gitignore` matches the
  pattern), so a copy over `serviceAccountKey.json` never destroys the only copy of a key. In
  `scripts/README.md`'s layout the production key is `serviceAccountKey.json` itself: copy it to
  `serviceAccountKey.production.json` first.
- To target a project, copy its named file over `serviceAccountKey.json`. Check `project_id` in the
  same command, right before each run, against the project the approval named.
- Put back the key that was there before, in a `trap` so it happens even if the run fails.
- While a key other than the usual one is in place, run nothing else from that checkout: any other
  script would use it too, and an approved staging write would hit production.

**Roots:** a script that takes `--root` runs once per root. List the roots under both `authed/`
and `demo/` (`firestore.collection("authed").listDocuments()`, and the same for `demo`); a project
can hold other portals' roots besides its own. In 7.9.0 production's demo spaces had 51 of the 262
documents its dry runs found to repair.

**Size the run first.** Count the documents a run will check, per root. Don't time a `--limit` run
to estimate the whole: the script takes documents in id order, oldest first, and in 7.9.0 the
first 25 had no history at all. What a run costs depends on the history it reads (about 70,000
entries a minute in 7.9.0). Production's portal root took about 1.5 h for 4,657 documents, and one
demo document had a history of over 400,000 entries. For a split run, the first shuffled batch's
time is a fair guide to the rest.

**Long runs:** a script that takes `--doc` (repeatable) checks only those documents. To split a
long dry run, list the root's document ids once, shuffle them so each batch mixes old and new, and
write them to batch files in `scripts/output/`. Run each batch with
`$(sed 's/^/--doc /' <batch file>)`; zsh splits the command substitution into arguments, and a
batch of over 1,000 ids fits on the command line. Run them in the background, one at a time,
swapping the key in for each run and back after it exits.

**Write runs:** for every root, pass only the documents its dry run found to repair, plus those it
skipped as recently edited. That's a fraction of what the dry run read: in 7.9.0, 211 of the
portal root's 4,657. Afterward, dry run the repaired documents again by `--doc` to confirm nothing
is left to repair.

**Skips:** a document skipped because it changed recently (still being edited) needs a second run
later; add it to the follow-ups. A document the script refuses for its own reasons stays as it is;
list it in the record.

## Release Production [approve]

```bash
date -u +%Y-%m-%dT%H:%M:%SZ                                        # <dispatched>, before the run
gh workflow run release-production.yml --ref master -f version=v<X.Y.Z>
gh run list --workflow release-production.yml --event workflow_dispatch \
  --json databaseId,createdAt --jq '.[] | select(.createdAt >= "<dispatched>") | .databaseId'
gh run watch <id> --exit-status
```

Find the run id as for Release Staging (cutting.md): repeat the `gh run list` until it prints an
id created after `<dispatched>`, never the newest run from before it.

Check the log as for staging: OIDC, four `copy:` lines, to `index.html`, `editor/index.html`,
`authoring/index.html` and `authoring-iframe/index.html`, and the tag's commit as Rollbar's
`version`. Then
`deployed-version.ts`: production and staging should both show the tag's commit.

## GitHub release [approve]

Promote the release now that production serves it:

```bash
gh release edit v<X.Y.Z> --prerelease=false --latest
```

Check the release list shows it as Latest, with no Pre-release badge.

## Jira [approve]

- **Close the release story:** transition it to Done.
- **Mark the version released,** with today's date. The Atlassian connection has no version tools,
  so use the REST API from a small script in `scripts/local/` that reads the dev-templates `.env`:
  `GET /rest/api/3/project/CLUE/versions` to find the id, then
  `PUT /rest/api/3/version/<id>` with `{"released": true, "releaseDate": "YYYY-MM-DD"}`.
  `/version/<id>/unresolvedIssueCount` shows what's still open; read it after closing the release
  story, which otherwise counts as open. It can lag the transition: right after closing the story
  it still counted it, and a minute later it didn't. If it's off by the story you just closed,
  check with a JQL search (`fixVersion = "<X.Y.Z>" AND resolution is EMPTY`) and read it again. Unlike the Jira UI, the API doesn't make you move
  unresolved issues. Leave a story whose code shipped on this version. An open story nobody
  triaged may be a clone of one in the release, since cloning keeps the fix version: look at its
  comments and creation time, and ask the developer where it goes.
- **Earlier versions:** check that the previous version is marked released too.

## Announcements [approve]

- **#clue:** reply in the pre-announcement's thread: "CLUE <X.Y.Z> is now live:
  https://collaborative-learning.concord.org/", plus the GitHub release link.
- **#releases:** a top-level post, "CLUE <X.Y.Z> is released: <GitHub release link>", followed by
  the `slack` release notes, converted to standard markdown and with the same sections flattened as
  in the pre-announcement (preparing.md).
  Every CLUE release is announced here, separately from #clue.
- **A slipped release:** if the timing the pre-announcement gave passes before the release, propose
  a reply in its thread with the new timing **[approve]**, so projects aren't left waiting.
- **Open stories:** nudge the owners of stories still open on the version, in the latest
  release-status post's thread. A scheduled message works for someone in another timezone; it is
  gated like any other message.

## Follow-ups and the record

- **Follow-up stories:** list anything found during the release that needs one (bugs, script
  problems, process gaps), and create the ones the developer wants **[approve]**.
- **Finish the record:** add what went differently from this skill, and what the skill should
  change.
- **Commit the record [approve],** with any skill changes the developer agrees to, on a branch
  with a PR.

## Done when

Check each of these before calling the release finished, and report any that aren't done:

- [ ] Production and staging serve the tag (`deployed-version.ts`)
- [ ] GitHub release promoted: Latest, not a pre-release
- [ ] Production Firebase has what the deploy-timing decisions called for, `after` parts included
- [ ] Each migration script in the release has been run against production at its timing, and the
  usual service-account key is back in `scripts/serviceAccountKey.json`
- [ ] Worktrees made for `before` deploys removed
- [ ] Release story Done; Jira version (and the previous one) released
- [ ] #clue: "now live" reply in the pre-announcement's thread
- [ ] #releases: announcement with the GitHub release link and notes
- [ ] Owners of still-open stories nudged
- [ ] Follow-up stories created, or listed as declined
- [ ] Release record finished and committed
