# CLUE-760: Background history entries for DataFlow

Status: design approved, 2026-11-02; updated 2026-11-04 and 2026-11-10 for the CLUE-773 and
CLUE-751 implementations. The updates are awaiting review. CLUE-773 is on master. CLUE-760 builds on
CLUE-751 (#3086) and merges after it.

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
- **Fixing the playback failures that remain in old histories.** Hiding ticks does not fix them:
  moving between two user stops still applies every tick in between, so a bad tick still stops
  playback between two stops (see "Positions between stops" in section 3). CLUE-773 documents
  them, and none has a story yet:
  - legacy DataFlow documents where the `setProgram` that sets a tile's `program/id` is recorded
    just before the tile's `addTile` entry. Playback stops one entry before the add (section 6 of
    the [CLUE-773 design](2026-11-02-clue-773-history-migrations-design.md));
  - failures that aren't schema changes: session-end gaps, missing tiles or nodes, undoing the first
    entry, and content saved behind history (that design's Non-goals);
  - Drawing groups from before 1.1.0, and Graph entries from before layers, found by the audit of
    other tiles' past migrations (#3081's description).
- **The rest of the Simulator work** (CLUE-761). CLUE-760 only flags the Simulator's `step` so the
  activity recorder doesn't regress (see below).

## Anti-goals

- **Never flag an entry that contains a person's change.** GD-20 later gives the flag conflict and
  undo meaning, so a user change marked `background` would be treated as disposable. A mixed action,
  or a tick that runs as a child of a user action, stays a user entry.
- **Viewers must not lose live values.** A teacher watching a running program still sees its
  values, at most a few seconds behind.
- **Playback must not get noticeably worse.** Saving less often can leave the saved content
  further behind history. CLUE-751's load catch-up and its saves on the way out cover the owner's
  document. The full fix is a later story that starts playback from CLUE-751's exact id (see "A
  known risk" in section 4).

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
`background: types.maybe(types.boolean)`. It is absent on user entries and on
entries written before these changes. CLUE-760 adds one optional field:

- `producerTileId: types.maybe(types.string)`.

GD-20's other fields (`producerId`, `runnerSessionId`) wait for the runner lock. Old clients ignore
the new fields: MST drops snapshot properties a model doesn't define.

**Not every background entry comes from `asBackground()`.** The load entry, which records the
changes CLUE makes to the stored content while loading it (such as converting old tiles to their
current format), is built directly (`buildLoadEntry` in
[schema-conversion.ts](../../../src/models/history/schema-conversion.ts)) with `isLoadEntry: true`,
`background: true` and no `producerTileId`, because it belongs to the document rather than one tile.
So `producerTileId` stays optional, and code that reads the flag (playback, the save sender, the
activity recorder) reads `background` and never assumes a producer.

Shared-model follow-up records join the same entry, so a tick's changes to linked shared models are
covered by the entry's flag.

**What gets flagged in CLUE-760:**

- **`DataflowProgram.tickAndProcess`** ([dataflow-program-model.ts](../../../src/plugins/dataflow/model/dataflow-program-model.ts)).
  Today it doesn't call `withoutUndo()`, so each tick is undoable. `asBackground()` fixes that too.
- **Recorded cases.** While recording, every interval also calls `recordCase`
  ([recording-utilities.ts](../../../src/plugins/dataflow/model/utilities/recording-utilities.ts)).
  It calls the dataset's `addCanonicalCases` directly, so the root action is a generic dataset
  action that user edits also use. Wrap it in a DataFlow content action that calls `asBackground()`.
  Recorded cases are produced by code, so they are background, even though starting the recording
  was a user change. Starting, stopping and clearing a recording stay user changes.
- **`SimulatorTool.step`** ([simulator-content.ts](../../../src/plugins/simulator/model/simulator-content.ts)).
  The activity recorder already ignores it as a tick. Once the recorder reads the flag instead, the
  Simulator has to set it, or every step would start counting as student activity. This overlaps
  CLUE-761.

- **`DataflowProgram.processAfterProgramChange`** ([rete-manager.tsx](../../../src/plugins/dataflow/rete/rete-manager.tsx)).
  It runs when the tile loads, and again as a separate entry after a block is added or removed or a
  connection changes, to recompute values. Without the flag it would add a user stop each time the
  document is opened, and a second stop after each block or connection edit.

  The usual fix for a follow-up entry like this is to group it into the user's action, so one
  change makes one entry. That is preferred over making an action not undoable, because a
  not-undoable change that a later user change relies on can leave the document in a state where
  undoing that user change, or the undo after it, fails. Here the flag is the better fix, because
  `processAfterProgramChange` writes only what a tick writes:
  - It runs the same `process()` as a tick, without `inTick`, and doesn't add a tick. Source blocks
    (number, generator, timer, sensor) only produce new values inside a tick.
  - Derived blocks save their computed value into the current tick's entry
    (`tickEntries/<currentTick>/nodeValue`, through `saveNodeValue`). The control block also writes
    `timerRunning` there, and the demo output block writes its `tilt`, as they do on every tick.
    The rest is volatile state.
  - It doesn't change blocks, connections or settings.

  Grouping would also be worse for undo here. A tick keeps only the most recent `kMaxNodeValues`
  tick entries, so once enough ticks have run, a user entry holding a `tickEntries/<tick>/...`
  patch can't be undone: its inverse patch points into an entry that is gone. Kept as its own
  background entry, undoing a connection edit undoes only the connection, and the next tick
  recomputes the values. This is the same undo-around-ticks situation as every tick, so it gets no
  handling of its own. The FIXMEs about the second history entry
  ([dataflow-program-model.ts](../../../src/plugins/dataflow/model/dataflow-program-model.ts),
  rete-manager.tsx) are resolved by this and are removed.

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

The legacy DataFlow history bridge has `isLegacyDataflowPatch`
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
  format, such as the follow-up that stores legacy DataFlow load entries. The rule recognizes legacy ticks by their legacy paths,
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
- **An "earliest available" stop.** Playback has an oldest position it can reach, for a legacy
  tile whose old state its history bridge can't rebuild (`oldestReachablePosition` in
  [tree-manager.ts](../../../src/models/history/tree-manager.ts)), and says "Earlier history isn't
  available." there instead of the failure banner. The slider doesn't mark the range before it
  yet; CLUE-773 left that to this rework. The bridge's boundary is a tile's last legacy entry, often
  a tick, so that position usually falls between two user stops, and "the stop before" would be a
  stop playback can't reach. So, mirroring the latest stop:
  - the oldest reachable position gets its own stop, unless a stop is already there;
  - the stops before it are shown as unavailable, and the slider can't move onto them.

  The bridges find their conversions from the history alone, so the slider can know the boundary
  before any seek reaches it, rather than only after `oldestReachablePosition` is set. How
  "unavailable" looks is left to the builder.

### 4. Saving

CLUE-751 replaces the save hook's throttle with `ContentSaveSender`
([content-save-sender.ts](../../../src/models/document/content-save-sender.ts)), and its design
leaves the background-only rate and indicator rule to CLUE-760. The sender saves the content
snapshot kept when each local entry completed, once that entry commits, so a tick-only save is an
exact save like any other. CLUE-760 adds two rules to it:

- **Two rates.** The sender takes the gap per save (`getMinimumGapMs`). A save goes out within 1
  second of a user change, as today. When every entry the save covers since the last completed save
  is background, the gap is 3 seconds. An exact save knows the entries it covers, because it is
  built from a committed entry. The sender always sends the newest save, so a user change during a
  slow wait just makes the pending save go out sooner. Intermediate saves keep CLUE-751's 5-second
  cadence.
- **The indicator follows user changes only.** The sender sets `SaveState.Saving` on every local
  content change (`handleContentChanged`), before the change's entry exists. A change made only by
  background calls doesn't set it, and "Saved" shows only when a save covering a user change
  completes. A failed save shows `Retrying` whatever it carried, because content not reaching the
  database is something the student should know about.
- **Telling the two apart at a content change.** History entries are recorded asynchronously, so
  the change handler can't wait for `document.history`. The tree monitor already tracks the calls
  whose changes no entry holds yet (`getRunningCallsWithChanges`, `hasCallWithUnrecordedChanges`,
  added by CLUE-751). Have it also answer whether all of those calls are background. Check whether a
  synchronous tick's call is still tracked when the handler runs, or has moved to the finished
  calls whose records haven't reached the manager, and cover both.

**The way out is CLUE-751's.** When the hook unmounts, the sender keeps going for up to 30 seconds
until an exact save covers the latest change. On `pagehide`, an individual document sends its newest
usable committed snapshot at once, skipping the gap. Both apply to the 3-second gap too, so CLUE-760
adds no flush of its own.

**A known risk: content behind history.** Playback assumes the content it starts from includes every
entry in Firestore: `setNumHistoryEntriesAppliedFromFirestore`
([tree-manager.ts](../../../src/models/history/tree-manager.ts)) sets the position to the last entry's
index + 1. If the content is missing the last few ticks, scrubbing back undoes ticks it never had,
and fails. For example, the inverse of adding a tick entry is removing a key that isn't there.

CLUE-751 narrows this but doesn't close it:

- **The owner's document catches up at load.** Loaded from an exact save that is behind its history,
  it applies the missing entries, up to 200 (`kCatchUpMaxEntries` in
  [load-catch-up.ts](../../../src/models/history/load-catch-up.ts)). At a 3-second gap and 20 Hz, the
  usual gap is about 60 entries. Playback builds its copy from the live document, so the owner's
  playback starts from content that includes every entry.
- **Another viewer's document doesn't catch up.** A teacher's or researcher's copy of the content
  can be behind history by up to the save gap, which is now 3 seconds while only ticks change, so
  their playback can still fail on the last few ticks.

CLUE-760 accepts the remaining risk. CLUE-751 makes the content's `lastHistoryEntryId` exact, and a
later story starts playback from it. Playback's JSON copy, which crosses load entries, starts from
the same content, so it has the same limit.

### 5. Activity recorder

In [activity-recorder.ts](../../../src/models/stores/activity-recorder.ts), `onLocalEntryUploaded`
skips entries with `background: true`. Remove `kTickEntries` and `isTickEntry`. The recorder only
sees entries this client just wrote, which always carry the flag, so it doesn't need the legacy rule.

Recorded cases stop counting as activity (see section 1). A student who starts a recording and walks
away no longer shows as active.

The recorder also skips load entries (`entry.isLoadEntry`), which a tick can flush into history
when an old document opens with a running DataFlow tile. Load entries carry `background: true`, so
the background check covers them and that clause goes too.

## Related work

- **CLUE-773** (merged): playback across tile format changes: load entries, the JSON copy that
  crosses them, and the legacy DataFlow bridge. It added the `background` field and the oldest
  reachable position this design builds on, and its design lists the playback failures that remain.
- **CLUE-751 / GD-18:** settled-state saves. Its `ContentSaveSender` takes the background-only gap
  and indicator rule from section 4, and its load catch-up narrows the content-behind-history risk.
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
- Recorded cases are background.
- The Simulator's `step` is flagged here, not in CLUE-761.
- `processAfterProgramChange` is background, because it writes only what a tick writes. A follow-up
  entry that changes anything else is grouped into the user's action instead.
- A failed background-only save still shows `Retrying`.

## My calls (check these)

- A link marker is added here, as a single point; CLUE-635 adds ranges.
- `producerTileId` is stored now. `producerId` and `runnerSessionId` are not.
- An "earliest available" stop at the oldest reachable position, with the stops before it
  unavailable.

## Left to the builder

- The exact legacy rule, checked against the study data as described above.
- How the tree monitor tells the save sender that a content change was background-only.
- The migration script's batching, resume and cost estimate.
- Whether `asBackground()` checks in development that `producerTileId` names a real tile.

## Testing

- **Tree monitor:** an action calling `asBackground()` records `background: true` and its
  `producerTileId`, and isn't undoable. A child action calling it warns and records a user entry.
  Shared-model follow-up records stay in the flagged entry.
- **DataFlow:** after adding a block, removing one, and adding and removing a connection, the
  `processAfterProgramChange` entry is background, and every patch in it is under a block's
  `tickEntries` or is a demo output's `tilt`. A new write elsewhere fails the test, which is the
  signal to group that change into the user's action instead. Undoing a connection edit takes one
  undo.
- **Legacy rule:** cases from real entry shapes: `tickAndProcess`, values-only `setProgram`,
  `setProgram` with a node move, Simulator `step`, and an entry with no `model`.
- **Playback model:** stops skip background entries. A user stop lands right after its entry. The
  latest stop appears only when background entries follow the last user change. A comment made
  between ticks, and a link to a tick, each get a stop at their exact position, in history order.
  Following the end applies new background entries. Positions between stops map to the right stop,
  and so do failure markers. A load entry is never a stop. A legacy document whose bridge
  can't rebuild the old state gets an earliest available stop, and the stops before it can't be
  reached.
- **Performance:** playback across load entries was measured one entry at a time (CLUE-773). Here one move between user
  stops applies every tick in between, and in a document with a load entry or a bridged legacy
  DataFlow tile each of those entries also moves the JSON copy. Time a move across thousands of ticks in a legacy DataFlow document.
- **Save sender:** saves covering only background entries are sent at most every 3 seconds, and
  background-only content changes leave the indicator alone. A user change saves within 1 second
  and shows the indicator, including one made during a 3-second wait. `pagehide` still sends the
  newest committed snapshot at once while only ticks are pending. A failed background-only save
  shows `Retrying`.
- **Tree monitor:** it reports a content change as background-only when every call holding
  unrecorded changes is background, whether the call is still running or has finished and its record
  hasn't reached the manager.
- **Activity recorder:** background entries are skipped, including load entries.
- **Cypress:** a document with a running DataFlow tile shows only user stops, and the indicator
  stays still while the program runs with no edits.
