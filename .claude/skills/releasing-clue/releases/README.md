# Release records

One file per release, `<version>.md`, written while the release happens. The records serve two
purposes:

- **History:** what happened in each release, what was decided and why.
- **Test cases for the skill:** a skill can't be run without doing a release, but it can be checked
  against past releases. Would it have handled each situation a record describes?

## Writing a record

Create it at the start of the release, and add to it after every step. Start from:

```markdown
# Release record: CLUE <version> (<start date> to <end date>)

| | |
|---|---|
| New version | |
| Previous tag | |
| Jira fix version | |
| Jira release story | |
| Release branch | |
| Developer | |

## Steps
<!-- One section per step, named as in the skill. What was done, the commands where useful,
     what was decided and by whom. -->

## Skill gaps
<!-- Anything the skill didn't cover, got wrong, or made harder than it needed to be. -->
```

Keep Slack channel, user and message IDs, tokens, and personal account details out: the
repository is public. People's names and Jira keys are fine.

## Checking a skill change against the records

Before merging a change to the skill, check it against every record:
1. Give a fresh agent the changed skill and one record.
2. Ask it to walk through the record step by step. For each situation, it says what the skill
   would have had it do, and whether that matches what happened or would have been better.
3. Ask it to list situations the skill doesn't cover, and any gated action the skill would let
   happen without approval.

Fix what's found, or note in the PR why it doesn't apply. Older records describe older
processes, so a difference can be intended; say so in the PR.
