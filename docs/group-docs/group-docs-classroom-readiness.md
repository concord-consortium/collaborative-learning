# Group Documents: Classroom Readiness

What's left before group documents can be used in classrooms, framed as an MVP. The work splits into three tracks because they have different risk and scope: general readiness for everyday tile use, DataFlow tile support, and collaborative text-tile editing.

For technical context, see [group-docs-plan.md](group-docs-plan.md). For current behavior and observed issues, see [group-docs-current-state.md](group-docs-current-state.md) and [test-scripts/](test-scripts/).

## General readiness

Where things stand today: most CLUE tiles can be used in a group document. Two students editing different tiles, or different parts of the same shared dataset, merge cleanly. Two students editing the same tile have "last student wins" semantics — no data corruption, but uncommitted work can be lost.

### Required for MVP

- **Undo rendering bugs** — a handful of cases where a model change isn't reflected in the UI. These affect single-user undo too, not just group docs. Tracked under [GD-7](group-docs-plan.md#gd-7-undo-bugs); several already in code review.
- **Diagram tile crash** — the diagram tile crashes when another user deletes a referenced variable (CLUE-512).
- **Test framework** — Playwright multi-context tests ([GD-16](group-docs-plan.md#gd-16-e2e-test-framework)). Provides regression safety for the MVP and is a prerequisite for the more complex tracks below.

### After MVP

These items aren't ship-blockers because students can work around the underlying issues during initial classroom use. Worth doing later but not gating launch.

- **Shared model conflict resolution** ([GD-10](group-docs-plan.md#gd-10-shared-model-merging)). Concurrent edits to the same shared model currently roll back instead of merging cleanly. This covers both two students editing the same table and the less-obvious case of one student editing a table while another edits a graph linked to the same dataset — the focus indicator only shows the tile each student is in, not the shared model behind it, so the second case can go unnoticed. Workable for an MVP if students are coached to coordinate on shared datasets. Worth doing post-MVP because shared-dataset collaboration is a natural pattern.
- **Per-tile UI hardening** ([GD-11](group-docs-plan.md#gd-11-tile-hardening-as-needed) transient UI state). Cursor jumps, lost selection, drag interruption only happen when multiple students edit the same tile at once. The focus indicator lets students avoid this.
- **Non-crash stale-reference bugs** — CLUE-513 (drawing chip persists when a referenced variable is deleted by another user) and CLUE-514 (graph silently blanks Y series when a referenced attribute is deleted). Visual artifacts that recover on refresh; not crashes.
- **Finer-grained `doc` scope** ([GD-15](group-docs-plan.md#gd-15-finer-grained-doc-scope)). Concurrent tile additions, layout edits, or annotation (sparrow) adds currently conflict and one side rolls back, even though the changes are independent. Two students adding tiles or annotations to the same document at the same time is likely to be a popular collaborative pattern, so this is worth doing post-MVP.

## DataFlow readiness

Where things stand today: a running DataFlow tile in a group document is a blocker. The simulation tick produces a continuous stream of history entries that conflict with everything else, rolling back other users' edits.

Three plan items in dependency order:

- **Settled-state document saves** ([GD-18](group-docs-plan.md#gd-18-settled-state-document-saves)) — saves the document only when the receive-side state machine is settled, so saves reflect canonical state. Prerequisite for the next item.
- **Transaction-free history** ([GD-19](group-docs-plan.md#gd-19-transaction-free-history)) — replaces the per-document Firestore transaction with a multi-parent DAG, removing the write-rate choke point DataFlow's tick rate hits.
- **Background entries** ([GD-20](group-docs-plan.md#gd-20-background-entries-dataflow)) — adds a background flag and runner lock so DataFlow's tick changes flow through history without conflicting with user edits.

This track is significant work and adds system complexity. The intent is to land the test framework first (GD-16, in the General track) so this work has automated regression coverage from day one.

A concrete design is mostly done for this. The GD-20 design has the most open questions, and there isn't a specific design for how the DataFlow tile UI will handle conflicts. 1 week of Scott's time for implementation time might be enough for a initial version. That will probably result in unexpected issues. So 3 weeks would be a better estimate for this work. The second 2 weeks could be a different developer.

## Collaborative text-tile editing

Where things stand today: the text tile uses "last student wins". Two students editing the same paragraph at the same time will lose one student's work, and one student typing while another's edit arrives will see their cursor jump or their uncommitted text overwritten.

The plan item ([GD-21: Collaborative Text-Tile Editing](group-docs-plan.md#gd-21-collaborative-text-tile-editing)) covers both the model side (fine-grained patches per keystroke instead of full-text replacement) and the UI side (apply patches directly to Slate's editor state so cursor and selection are preserved).

There isn't a concrete design for supporting this. It requires a whole new system for recording and sharing changes between the multiple users editing the tile. And the tile's UI components need access to these recorded changes, so they can be applied with minimal disruption. Perhaps it'll take 1 week of Scott's time to come up with a design and then possibly a week to implement that design.

## Not included

Plan items that aren't part of any track above. Listed for completeness so the omission is intentional, not an oversight.

- **[CLUE-517: Undo/Redo (deferred)](group-docs-plan.md#clue-517-undoredo-deferred)** — there are several issues that can happen when a student undoes their own changes after remote changes have modified the same things. One example is when one student edits a tile and another deletes it, the first student's undo silently errors (console message, button looks broken). It might be best to disable the undo button in group documents until we address this. The initial fix for this is pretty straight forward: when there is a conflict with the undo then it is disabled. That prevents corruption but it can also be frustrating. For example student A does a lot of work on a tile and then student B deletes it. With simple approach the students would have to figure out that student B should undo their change to get it back. Another feature to make this better is to show students document revisions, (like google docs does) then students can restore revisions.
- **[GD-14: Intra-Tile Merging](group-docs-plan.md#gd-14-intra-tile-merging)** — generalization of the collaborative text work to other tiles (drawing, geometry, etc.). Some of these tiles will work well with only minor changes; they don't all require special handling like the text tile. This work is punted on the assumption that text is the dominant collaborative-editing pattern; other tiles can stay on "last student wins" for now.
- **Dev tooling and legacy-code hardening** — [GD-12](group-docs-plan.md#gd-12-debug-re-render-controls) (debug re-render controls), [GD-13](group-docs-plan.md#gd-13-auto-revert-stress-mode) (auto-revert stress mode), [GD-22](group-docs-plan.md#gd-22-reliability-and-robustness) (reliability fixes in the legacy concurrent history manager). Internal debugging tools and code cleanup, not user-visible. This can make the work above faster and safer so they would be good to do if we can afford it.
