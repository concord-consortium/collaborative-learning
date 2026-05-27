# Sparrows (Annotations) — Test Scripts

Cases involving sparrows (the `annotations` map at the document level). Sparrows can connect objects across tiles, so tile-deletion cases are particularly interesting.

See [README.md](README.md) for the single-person testing technique and reporting guidelines.

## 🚧 Sparrow pointing at deleted tile

**Setup:** Group document with two drawing tiles, each containing an object.

**Script:**
1. Pause user A's uploads.
2. User A: draw a sparrow (annotation) connecting one object in each drawing tile.
3. User B: delete the second drawing tile.
4. Resume user A's uploads.

**Expected outcome:** Sparrow add (touches `annotations` in the `doc` scope) and tile delete (touches `tileMap` in the `doc` scope) both fall under GD-9's single `doc` bucket, so the scopes overlap and user A's sparrow add should roll back at resume.

**Bad-state signal:** Sparrow renders broken or throws on render; document state diverges between users; uncaught error in the console.

**Observed results:**

**Needs retesting under GD-9.** Pre-GD-9 observation (from `group-docs-current-state.md` before the move): the sparrow rendered as a self-loop pointing to the remaining object — the same as if a single user deleted the tile after making the sparrow. That predates GD-9's scope-based rollback, so the current behavior may be different.
