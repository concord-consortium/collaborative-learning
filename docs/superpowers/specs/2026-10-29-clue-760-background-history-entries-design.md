# CLUE-760: Background history entries for DataFlow

Status: design approved, 2026-11-02; updated 2026-11-04 for the CLUE-773 implementation (#3079,
#3080, #3081). Implementation builds on that stack and merges after it. CLUE-751 is not required
first; the rough edge it removes is noted in section 4.

## Why

A DataFlow tile runs for as long as it is in a document. Each tick (1 Hz by default, up to 20 Hz)
records a history entry. As a result:

- **History playback is close to useless** once a program has run for a while. Every tick is a
  slider stop, so the few changes the student actually made are lost among thousands of ticks. Play
  waits 500 ms per stop, so one minute at 20 Hz takes 10 minutes to play.
- **The saving indicator never settles.** Every tick changes the content and triggers a save, so
  the indicator keeps flashing "Saving..." for as long as the program runs.

Leslie (PI) wants teachers and researchers to see a meaningful, uncluttered history of changes to
a DataFlow program, not every tick.

## Why not a separate runtime state

CLUE-760's description proposes a second "runtime state" for program tiles. The values a program
produces would live in that state and would never go through history. Only the setup (blocks,
connections, settings) would be recorded and synced, and each viewer would run the program
themselves.

We are not taking that approach:

- **Viewers would see different values.** A program's values come from sensors, connected
  devices, timers and random generators. A viewer running the program themselves can't reproduce
  them. Today a teacher can watch a student's live values without running anything, because the
  values are saved with the document.
- **Playback would lose the values.** Researchers can replay what a program actually produced
  over time. With values outside history, that record is gone unless it is stored some other way.
- **Group documents get harder.** Every viewer becomes a writer of runtime state, which is the
  "two writers" problem the group-docs designs are trying to avoid.

Instead, ticks stay in history as entries flagged `background`. This follows GD-20
([background-entries-design.md](../../group-docs/background-entries-design.md)). Playback, saving
and the activity recorder treat them differently from user changes. That gives Leslie the
uncluttered history while keeping every value. The group-document bullets in the story (syncing
program tiles in group documents) move to the group-docs work (GD-18 through GD-20), which needs the
same flag.

## Goals

- Ticks and other entries produced by code, not by a person, are recorded with `background: true`.
- The playback slider stops only at user changes, evenly spaced. Play steps from one user change to
  the next.
- Old documents get the same playback, through a rule that recognizes old tick entries at read time
  and a one-off migration of stored entries.
- When only background entries have changed, the document saves every 3 seconds instead of every
  second, and the saving indicator stays still.
- The researcher dashboard's activity recorder ignores entries by the flag, not by a list of
  action names.

## Non-goals

- **Group documents.** No runner lock, no conflict rule, no revert hook. Those are GD-18 through
  GD-20.
- **A real-time slider, a Play speed control, or a "show every tick" toggle.** These go to a
  separate chore that builds live mockups from real student histories for the project team to
  react to. A story to build one follows only if the team wants it.
- **Renaming the entry's `created` timestamp, or adding `firstPatchAt` / `completedAt`.** These only
  matter for a time-based slider and are deferred with it.
- **Fixing playback failures in old histories.** That is CLUE-773. Hiding ticks does not fix them:
  moving between two user stops still applies every tick in between, so a bad tick still stops
  playback. CLUE-773 bridges the legacy DataFlow format, so most legacy documents play back to
  their start. Documents where a legacy `setProgram` set the program's id just before the tile's
  `addTile` entry still stop one entry before the add.
- **The rest of the Simulator work** (CLUE-761). CLUE-760 only flags the Simulator's `step` so the
  activity recorder doesn't regress (see below).

## Anti-goals

- **Never flag an entry that contains a person's change.** GD-20 later gives the flag conflict and
  undo meaning, so a user change marked `background` would be treated as disposable. A mixed action,
  or a tick that runs as a child of a user action, stays a user entry.
- **Viewers must not lose live values.** A teacher watching a running program still sees its
  values, at most a few seconds behind.
- **Playback must not get noticeably worse.** Saving less often can leave the saved content
  further behind history when a document closes. CLUE-760 narrows that by flushing. The full fix
  is CLUE-751 plus a later story that changes where playback starts (see "A known risk" in
  section 4).

## Design

### 1. Marking background entries

Add `asBackground({ producerTileId })` next to `withoutUndo()`
([without-undo.ts](../../../src/models/history/without-undo.ts)). A tile calls it in the body of an
action that code, not a person, triggers. It:

- marks the running call's environment as background, and as not undoable (it implies
  `withoutUndo()`);
- records `producerTileId`, the id of the tile that owns the action. GD-20 makes it required
  because the tree monitor can't otherwise tell which tile an action belongs to;
- handles child actions the way `withoutUndo()` does: it warns when called from a child action,
  and `unlessChildAction: true` silences that and leaves the entry a user entry.

The tree monitor passes the flag through `addHistoryEntry` (in `recordAction`,
[tree-monitor.ts](../../../src/models/history/tree-monitor.ts)). `HistoryEntry`
([history.ts](../../../src/models/history/history.ts)) already has
`background: types.maybe(types.boolean)`, added by CLUE-773. It is absent on user entries and on
entries written before these changes. CLUE-760 adds one optional field:

- `producerTileId: types.maybe(types.string)`.

GD-20's other fields (`producerId`, `runnerSessionId`) wait for the runner lock. Old clients ignore
the new fields: MST drops snapshot properties a model doesn't define.

**Not every background entry comes from `asBackground()`.** CLUE-773's conversion entry, which
records old tiles being converted to the current format at load, is built directly
(`buildConversionEntry` in [schema-conversion.ts](../../../src/models/history/schema-conversion.ts))
with `background: true` and no `producerTileId`, because it belongs to the document rather than one
tile. So `producerTileId` stays optional, and code that reads the flag (playback, the save hook,
the activity recorder) reads `background` and never assumes a producer.

Shared-model follow-up records join the same entry, so a tick's changes to linked shared models are
covered by the entry's flag.

**What gets flagged in CLUE-760:**

- **`DataflowProgram.tickAndProcess`** ([dataflow-program-model.ts](../../../src/plugins/dataflow/model/dataflow-program-model.ts)).
  Today it doesn't call `withoutUndo()`, so each tick is undoable. `asBackground()` fixes that too.
- **Recorded cases.** While recording, every interval also calls `recordCase`
  ([recording-utilities.ts](../../../src/plugins/dataflow/model/utilities/recording-utilities.ts)).
  It calls the dataset's `addCanonicalCases` directly, so the root action is a generic dataset
  action that user edits also use. Wrap it in a DataFlow content action that calls `asBackground()`.
  *My call:* recorded cases are produced by code, so they are background, even though starting the
  recording was a user change. Starting, stopping and clearing a recording stay user changes.
- **`SimulatorTool.step`** ([simulator-content.ts](../../../src/plugins/simulator/model/simulator-content.ts)).
  The activity recorder already ignores it as a tick. Once the recorder reads the flag instead, the
  Simulator has to set it, or every step would start counting as student activity. *My call*,
  overlapping CLUE-761.

- **`DataflowProgram.processAfterProgramChange`** ([rete-manager.tsx](../../../src/plugins/dataflow/rete/rete-manager.tsx)).
  It runs when the tile loads, and again as a separate entry after a block is removed or a
  connection changes, to recompute values. Without the flag it would add a user stop each time the
  document is opened, and a second stop after each connection edit. Flagging it also makes it not
  undoable, so undoing a connection edit takes one undo instead of the two its FIXME complains about.
  *My call.*

`SharedProgramData.setProgramNodes` also runs every interval, but it only changes volatile state and
records no entry.

These are the actions CLUE-760 flags. Other tiles may have actions like these. Auditing them is
left to later stories.

### 2. Old entries

Entries written before this change have no `background` field. CLUE-760 handles them in two steps:

1. **At read time.** One function, `isLegacyBackgroundEntry(entry)`, decides whether an entry with
   no `background` field was a tick. Playback uses `entry.background ?? isLegacyBackgroundEntry(entry)`,
   so the change can be tried on old documents as soon as it ships.
2. **A one-off migration**, run in each environment after the new code is deployed. It applies the
   same function to stored entries and writes `background: true` into the stored entry JSON. It lives
   in [scripts/](../../../scripts/) beside the other Firestore scripts.

The release after the migration has run removes the read-time call. The function then lives only in
the script. Both steps sharing one function means they can't disagree.

**The rule.** `isTickEntry` in the activity recorder is the starting point, but it matches on
`model`, and **older entries have no `model` field**. In a 2024 document from the
`clue-dataflow-behavior` study, no entry has one. The rule
has to work from the action path and the patches:

- **DataFlow ticks:** `tickAndProcess` actions.
- **Legacy DataFlow (before about May 2024):** ticks were recorded as `setProgram`, which also
  recorded every user change to the program. A `setProgram` record counts as a tick only if every
  patch is a `replace` of `program/values/<n>/currentValues/...` or
  `program/values/<n>/recentValues/...`. Possibly `program/nodes/<n>/data/demoOutput` too: it
  changes 366 times in that document, and it looks tick-driven. That needs checking. Any other
  patch (moving, adding or removing a node, changing a setting) makes it a user change.
- **Simulator:** `step` actions on a Simulator tile.

CLUE-773's legacy DataFlow bridge has `isLegacyDataflowPatch`
([legacy-dataflow-history-bridge.ts](../../../src/plugins/dataflow/model/legacy-dataflow-history-bridge.ts)).
It answers a different question, whether a patch is in the legacy format, so it can't be the tick
rule: a legacy node move is legacy but not a tick. Share its parsing of tile and `program/values`
paths rather than duplicating it.

Check the rule against the study data before writing it. For each candidate rule, count how many
entries it flags and look at a sample of entries it flags and doesn't flag, across several years.
Old DataFlow recordings (`addCanonicalCases` on a DataFlow tile's dataset) may not be
distinguishable from user edits to the dataset. If they can't be told apart, leave them as user
entries.

**The migration script:**

- Covers personal documents' history and group documents' history (the concurrent manager stores it
  under the metadata document).
- There are likely millions of tick entries. Estimate the count and the write cost first, write in
  batches, and make the script resumable and safe to rerun.
- Old clients keep writing unflagged entries until every open tab has reloaded. Rerun the script
  before the release that removes the read-time call.
- A developer with the production service-account key runs it against production.
- It must run before any future script that rewrites legacy DataFlow patches into the current
  format (a follow-up CLUE-773 mentions). The rule recognizes legacy ticks by their legacy paths,
  so it can't find them once those paths are rewritten.

### 3. Playback

In [playback-control-model.ts](../../../src/components/playback/playback-control-model.ts):

- **Background entries are never stops of their own.** They are still applied when moving between
  stops. Stops stay evenly spaced, as today.
- **A user stop shows the document right after that change**, as a history stop does today. The
  values shown are the latest ones from before the change, because the program hasn't ticked
  since.
- **A "latest" stop at the end** shows the whole history whenever background entries follow the
  last user change, which is always the case while a program runs. So the end of the slider is still
  the live document.
- **Comments and links get stops at their exact positions.** These are stops for events from
  outside the document, so not every stop is a change by the document's authors. Their markers make
  that clear.
  - A **comment** keeps today's stop: the document after the entry just before it, which is what
    its author was looking at. While a program runs, that is usually a background entry between two
    user stops. Comments already have markers.
  - A **link** into a history entry (`studentDocumentHistoryId`) gets a stop at that entry, and a
    marker, if the entry has no stop already. Today a link to a background entry would land between
    stops, and the reader couldn't get back to it after moving the slider. The marker works like
    the comment markers. The point is that a reader can look around the history and come back to
    the place the link pointed to. CLUE-635 (highlight a range of entries from a link) builds on
    this.
- **Stops stay in history order.** A comment or link stop sits between the user stops around it,
  so Play and the slider never move backward through history.
- **Play** steps from stop to stop at the current 500 ms.
- **Following the end.** While a viewer is at the end, new background entries keep arriving and
  move the latest stop rather than adding stops. The follow-end reaction must apply them, so it has
  to watch the history length, not only `lastStopIndex`.
- **Positions between stops.** A seek that stops on a failing entry can leave the document between
  two stops. The thumb shows the stop before that position. A failure marker goes on the stop that
  playback couldn't reach.
- **An "earliest available" stop.** CLUE-773 adds an oldest position that playback can reach, for
  a legacy tile whose old state its bridge can't rebuild (`oldestReachablePosition` in
  [tree-manager.ts](../../../src/models/history/tree-manager.ts)), and says "Earlier history isn't
  available." there instead of the failure banner. It leaves the slider treatment to whichever
  story lands second, which is this one. The bridge's boundary is a tile's last legacy entry, often
  a tick, so that position usually falls between two user stops, and "the stop before" would be a
  stop playback can't reach. So, mirroring the latest stop:
  - the oldest reachable position gets its own stop, unless a stop is already there;
  - the stops before it are shown as unavailable, and the slider can't move onto them.

  The bridges find their conversions from the history alone, so the slider can know the boundary
  before any seek reaches it, rather than only after `oldestReachablePosition` is set. How
  "unavailable" looks is left to the builder.

### 4. Saving

In [use-document-sync-to-firebase.ts](../../../src/hooks/use-document-sync-to-firebase.ts):

- **Two rates.** A save goes out within 1 second of a user change, as today. When everything since
  the last save is background, it goes out within 3 seconds. Each save sends the latest snapshot,
  so a user change during a slow wait just makes the pending save go out sooner.
- **The indicator follows user changes only.** A background-only snapshot doesn't set
  `SaveState.Saving`, and "Saved" shows only when a save covering a user change completes. A failed
  save shows `Retrying` whatever it carried, because content not reaching the database is something
  the student should know about. *My call.*
- **Telling the two apart.** The hook needs to know, when a snapshot arrives, whether its changes
  came only from background actions. History entries are recorded asynchronously, so it can't wait
  for `document.history`. The tree monitor knows at `onFinish` whether the call was background. Have
  it keep a synchronous flag that the snapshot handler reads and clears. Check that `onFinish` runs
  before MST emits the snapshot.
- **Flush on the way out.** When the document unmounts or the page hides, send a pending save right
  away. A slower rate otherwise risks losing the last seconds of values when the student closes the
  document.

**A known risk: content behind history.** Playback assumes the saved content includes every entry in
Firestore. `setNumHistoryEntriesAppliedFromFirestore` ([tree-manager.ts](../../../src/models/history/tree-manager.ts))
sets the position to the last entry's index + 1. If the content was saved before the last few ticks,
scrubbing back undoes ticks the content never had, and fails. For example, the inverse of adding a
tick entry is removing a key that isn't there. This can already happen within today's 1-second
throttle. A 3-second rate makes the window wider, and flushing on the way out narrows it again, but
a flush can't be relied on when a tab closes.

CLUE-760 accepts this risk. Starting playback from the content's `lastHistoryEntryId` doesn't fix it
yet: that id can be behind the content (the save stamps the latest entry that existed when the
snapshot was taken, not the snapshot's own entry), and the playback copy doesn't carry it. CLUE-751
makes the id exact, and a later story then changes where playback starts. CLUE-773 doesn't change
it: its JSON copy starts from the saved content, as playback does.

CLUE-751 (save only when history is settled) reworks the same hook. Whichever lands second builds on
the other. A tick-only save is still a save of a settled state, because ticks are synchronous.

### 5. Activity recorder

In [activity-recorder.ts](../../../src/models/stores/activity-recorder.ts), `onLocalEntryUploaded`
skips entries with `background: true`. Remove `kTickEntries` and `isTickEntry`. The recorder only
sees entries this client just wrote, which always carry the flag, so it doesn't need the legacy rule.

Recorded cases stop counting as activity (see section 1). A student who starts a recording and walks
away no longer shows as active.

So do CLUE-773's conversion entries. They are uploaded through the same path, and `isTickEntry`
doesn't match them, so today one counts as activity when it is flushed. With a running DataFlow
tile, the first tick flushes it, so opening an old document logs activity the student didn't cause.

## Related work

- **CLUE-773:** playback across tile format changes: conversion entries, the JSON copy that crosses
  them, and the legacy DataFlow bridge. It adds the `background` field and the oldest reachable
  position this design builds on.
- **CLUE-751 / GD-18:** settled-state saves. Same save hook.
- **GD-19 / GD-20:** the group-document side of background entries. This change is GD-20's tagging
  phase plus a simple version of its scrubber phase, without the lock or the conflict rule.
- **CLUE-761:** Simulator history replay.
- **CLUE-635:** highlight a range of history entries from a link. Builds on the link stop and
  marker added here.
- **The live slider mockups chore** (not yet created): a real-time slider (option B), multiple
  sessions, snapping to user changes among ticks, and a "show every tick" view (option D), built
  from real student histories.

## Decided

- Ticks stay in history, flagged `background`, rather than moving to a separate runtime state.
- Tiles declare their own background actions with `asBackground()`. There is no central list.
- `background` is stored on the entry. Its definition is GD-20's: "produced by code, not by direct
  user activation". It is not "hide in the viewer".
- Old entries are handled both at read time and by a migration. The read-time code is removed the
  release after the migration.
- Background-only saves go out every 3 seconds, and user changes keep the 1-second throttle. The
  saving indicator ignores background-only saves.
- The slider hides background entries and keeps stops evenly spaced. Play steps from stop to stop.
- A user stop shows the document right after the change, with a "latest" stop at the end.
- Comments and links get their own stops, with markers, at their exact positions.
- CLUE-760 doesn't change where playback starts. That waits for CLUE-751 and a later story.
- The activity recorder uses the flag.

## My calls (check these)

- Recorded cases are background.
- `processAfterProgramChange` is background.
- The Simulator's `step` is flagged here, not in CLUE-761.
- A link marker is added here, as a single point; CLUE-635 adds ranges.
- A failed background-only save still shows `Retrying`.
- `producerTileId` is stored now. `producerId` and `runnerSessionId` are not.
- An "earliest available" stop at CLUE-773's oldest reachable position, with the stops before it
  unavailable.

## Left to the builder

- The exact legacy rule, checked against the study data as described above.
- How the tree monitor exposes "this snapshot was background-only" to the save hook.
- The migration script's batching, resume and cost estimate.
- Whether `asBackground()` checks in development that `producerTileId` names a real tile.

## Testing

- **Tree monitor:** an action calling `asBackground()` records `background: true` and its
  `producerTileId`, and isn't undoable. A child action calling it warns and records a user entry.
  Shared-model follow-up records stay in the flagged entry.
- **Legacy rule:** cases from real entry shapes: `tickAndProcess`, values-only `setProgram`,
  `setProgram` with a node move, Simulator `step`, and an entry with no `model`.
- **Playback model:** stops skip background entries. A user stop lands right after its entry. The
  latest stop appears only when background entries follow the last user change. A comment made
  between ticks, and a link to a tick, each get a stop at their exact position, in history order.
  Following the end applies new background entries. Positions between stops map to the right stop,
  and so do failure markers. A conversion entry is never a stop. A legacy document whose bridge
  can't rebuild the old state gets an earliest available stop, and the stops before it can't be
  reached.
- **Performance:** CLUE-773 measured playback one entry at a time. Here one move between user
  stops applies every tick in between, and in a document with a conversion each of those entries
  also moves the JSON copy. Time a move across thousands of ticks in a legacy DataFlow document.
- **Save hook:** background-only snapshots save at most every 3 seconds and leave the indicator
  alone. A user change saves within 1 second and shows the indicator. A pending save is flushed on
  unmount.
- **Activity recorder:** background entries are skipped, including conversion entries.
- **Cypress:** a document with a running DataFlow tile shows only user stops, and the indicator
  stays still while the program runs with no edits.
