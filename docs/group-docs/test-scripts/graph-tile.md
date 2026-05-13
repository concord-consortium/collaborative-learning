# Graph Tile — Test Scripts

See [README.md](README.md) for the single-person testing technique and reporting guidelines.

Graph tile cases involve concurrent edits to its linked dataset. The active scripts live in [shared-dataset.md](shared-dataset.md):

- [Cross-scope reference drift (graph → dataset attribute)](shared-dataset.md) — Y series blanks silently when an attribute it references is deleted concurrently. CLUE-514.
- [Computed-state drift (graph axis bounds vs dataset rows)](shared-dataset.md) — concurrent axis adjustment vs row adds. Verified handled by GD-9.
