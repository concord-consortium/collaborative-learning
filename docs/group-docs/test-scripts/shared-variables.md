# SharedVariables — Test Scripts

Scripts exercising concurrent-edit cases involving the SharedVariables shared model. Tiles that reference variables: text, diagram, drawing.

See [README.md](README.md) for the single-person testing technique and reporting guidelines.

## 🐛⚠️ 1. Cross-scope reference drift (drawing → variable)

**Setup:** Group document. Both users in the same group, same document.

**Note on variable deletion:** CLUE's UI has no direct path to destroy a variable from SharedVariables. However, when a drawing tile or diagram tile **undoes** a new-variable action, the variable IS removed from the shared model. (The text tile's new-variable undo does NOT remove the variable — only drawing and diagram do.) This script uses that undo as a proxy for true deletion.

**Script:**
1. User A: add a diagram tile and a drawing tile, then create variable V1 via the diagram tile's new-variable button. V1 is now in the SharedVariables shared model and both users see it.
2. Pause user B's uploads.
3. User B: in the drawing tile, insert a reference to V1 (drawing tile's insert-variable button).
4. User A: undo the last action (the new-variable creation). This destroys V1 from the shared model.
5. Resume user B's uploads.

**Expected outcome (merge):** User A's destruction of V1 touches `shared:<SharedVariables>`. User B's insertion of the drawing chip touches `tile:<drawing>`. Scopes are disjoint, so the merge keeps both changes.

**Bad-state signal:** Drawing tile throws when rendering (unresolved reference), or shows an empty/placeholder variable that should not exist.

**Observed results (2026-04-24):**

- **User B, before resume:** User B receives and applies user A's variable-delete entry while user B's drawing still holds a chip referencing V1. From the UI the document looks fine. The browser console shows MST warnings about dangling references.
- **User B, at resume:** User B's queued history entry (adding the chip to the drawing) uploads successfully — scopes were disjoint from user A's delete, so the merge allowed it to survive.
- **User A, after user B resumes:** User A receives and applies user B's chip-add entry. The drawing does not show the variable (V1 no longer exists). Similar MST warnings appear in user A's console.

So the bad-state signal is visible only via console MST warnings, not in the UI. In principle, `updateAfterSharedModelChanges` on the drawing tile could detect the dangling reference and prune its chip — but it currently does not.

**Tracked in:** [CLUE-513](https://concord-consortium.atlassian.net/browse/CLUE-513) (nice to have).

## ❌ 2. Cross-scope reference drift (diagram → variable)

**Setup:** Group document. Both users in the same group, same document. Note: a document can only have one diagram tile, so this script uses the drawing tile's new-variable + undo as the destroy-V1 mechanism (same proxy as script 1).

**Script:**
1. User A: add a diagram tile and a drawing tile, then create variable V1 via the drawing tile's new-variable button. V1 is now in the SharedVariables shared model and both users see it.
2. Pause user B's uploads.
3. User B: in the diagram tile, insert V1 (diagram tile's insert-variable button, which adds a diagram node whose `variable` field references V1).
4. User A: undo the last action (the drawing tile's new-variable). This destroys V1 from the shared model.
5. Resume user B's uploads.

**Expected outcome (merge):** User A's destruction of V1 touches `shared:<SharedVariables>`. User B's insertion of the diagram node touches `tile:<diagram>`. Scopes are disjoint, so the merge keeps both changes.

**Bad-state signal:** Diagram tile fails to render because the node's variable reference no longer resolves, crashing the tile or the document.

**Observed results (2026-04-24):**

Reproduced. User B's document crashed with an MST unresolved-reference error:

```
[mobx-state-tree] Failed to resolve reference 'JhgtQZfARKuPI5re' to type
'Variable' (from node: /content/tileMap/apJHGfxcrTY1t-jQ/content/root/nodes/
Wxse_90_H0If0WNG/variable)
```

Unlike the drawing tile (script 1), the diagram tile models the variable association as a real `types.reference`. MST resolves strict references at property-access time; if the target `Variable` node is absent, resolution throws. In the drawing tile it's just a string id that gets looked up lazily at render time, so the failure mode is a console warning, not a crash.

- Diagram: `node_modules/@concord-consortium/diagram-view/dist/esm/diagram/models/dq-node.js:10-14` — `DQNode` declares `variable: types.reference(Variable)` (no `safeReference`, no `maybe`).
- Drawing: [src/plugins/shared-variables/drawing/variable-object.tsx:24-28](../../../src/plugins/shared-variables/drawing/variable-object.tsx#L24-L28) — `VariableChipObject` declares `variableId: types.string`.

**Recovery on reload:** Reloading either client clears the visible error. The saved document contains no variables in the shared model and no diagram node referencing the deleted variable, so the load is clean. The remote history, however, still contains user B's `DQRoot.insertNode` entry — likely because the MST crash prevented user B's post-merge state from being persisted, while the history entry had already been uploaded independently.

**Implications:**
- **Good for users:** reload recovers. The bad state is ephemeral from the end-user's perspective.
- **Bad for history replay:** the history scrubber will hit the same unresolved-reference crash when it reaches the orphaned `insertNode` entry.
- **Content/history drift:** the saved document's `lastHistoryEntryId` points at the second-to-last remote entry (the pre-insertNode state), not the entry that followed. CLUE-485's drift detection does not flag this — it only errors when the saved id is absent from the history entirely; here the id is still present, just not at the tail.

**Tracked in:** [CLUE-512](https://concord-consortium.atlassian.net/browse/CLUE-512) (required to fix).
