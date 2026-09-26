# Phase 3: Shipping

Gated actions are marked **[approve]**; see "Approval gates" in SKILL.md.

## Project team approval

Read the tester's replies in the handover thread. Report to the developer what they approved, what
they found, and anything they asked. Bugs they found become stories for the next version, unless
the developer decides otherwise. The developer confirms the release goes ahead.

## Production Firebase [approve]

Deploy what the deploy-timing decisions call for, with the same steps as staging (cutting.md) and
`--project collaborative-learning-ec215`. Compare production's deployed params with the `.env`
first; production and staging can differ.

Order matters when a part is `with` the client. Deploy it immediately before Release Production
and start the release right after, so the released client and the new part overlap as briefly as
possible.

## Release Production [approve]

```bash
gh workflow run release-production.yml --ref master -f version=v<X.Y.Z>
gh run list --workflow release-production.yml --limit 1  # the run id
gh run watch <id> --exit-status
```

Check the log as for staging: OIDC, and four `copy:` lines, to `index.html`, `editor/index.html`,
`authoring/index.html` and `authoring-iframe/index.html`. Then
`deployed-version.ts`: production and staging should both show the tag's commit.

## Jira [approve]

- **Close the release story:** transition it to Done.
- **Mark the version released,** with today's date. The Atlassian connection has no version tools,
  so use the REST API from a small script in `scripts/local/` that reads the dev-templates `.env`:
  `GET /rest/api/3/project/CLUE/versions` to find the id, then
  `PUT /rest/api/3/version/<id>` with `{"released": true, "releaseDate": "YYYY-MM-DD"}`.
  `/version/<id>/unresolvedIssueCount` shows what's still open. Unlike the Jira UI, the API doesn't
  make you move unresolved issues. Leave a story whose code shipped on this version.
- **Earlier versions:** check that the previous version is marked released too.

## Announcements [approve]

- **#clue:** reply in the pre-announcement's thread: "CLUE <X.Y.Z> is now live:
  https://collaborative-learning.concord.org/", plus the GitHub release link.
- **#releases:** a top-level post, "CLUE <X.Y.Z> is released: <GitHub release link>", followed by
  the `slack` release notes converted to standard markdown (as in preparing.md's pre-announcement).
  Every CLUE release is announced here, separately from #clue.
- **Open stories:** nudge the owners of stories still open on the version, in the latest
  release-status post's thread. A scheduled message works for someone in another timezone.

## Follow-ups and the record

- **Follow-up stories:** list anything found during the release that needs one (bugs, script
  problems, process gaps), and create the ones the developer wants **[approve]**. One known issue:
  `release.yml` gives Rollbar the commit the workflow ran from (master), not the tag's.
- **Finish the record:** add what went differently from this skill, and what the skill should
  change.
- **Commit the record [approve],** with any skill changes the developer agrees to, on a branch
  with a PR.

## Done when

Check each of these before calling the release finished, and report any that aren't done:

- [ ] Production and staging serve the tag (`deployed-version.ts`)
- [ ] Production Firebase has what the deploy-timing decisions called for
- [ ] Release story Done; Jira version (and the previous one) released
- [ ] #clue: "now live" reply in the pre-announcement's thread
- [ ] #releases: announcement with the GitHub release link and notes
- [ ] Owners of still-open stories nudged
- [ ] Follow-up stories created, or listed as declined
- [ ] Release record finished and committed
