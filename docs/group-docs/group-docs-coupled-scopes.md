# Future Idea: Opt-in Coupled Scopes

Design proposal that came out of the cross-scope reference drift scripts in [test-scripts/shared-variables.md](test-scripts/shared-variables.md) and [test-scripts/shared-dataset.md](test-scripts/shared-dataset.md). Captured here for future reference; tracked as [GD-24](group-docs-plan.md#gd-24-opt-in-coupled-scopes-held-in-reserve) and would build on [GD-17: Type-Aware Merge Delegation](group-docs-plan.md#gd-17-type-aware-merge-delegation).

The scripts in [test-scripts/](test-scripts/) show that a tile can end up in an inconsistent state when a shared model it depends on is mutated by another user. The current scope-based merge treats these as disjoint because the patches don't touch the same path.

**Idea:** Add a per-(tile type, shared-model type) coupling setting. If the pair (tile X, shared-model Y) is declared coupled, every history entry produced by a tile of type X gets an additional `shared:<smId>` scope for each shared model of type Y the tile is attached to (or, more conservatively, every shared model of type Y in the document).

**Effect on shared-variables script 1:** A local drawing edit carries `tile:<drawing>` *plus* the extra `shared:<SV>`. The remote destroy-V1 carries `shared:<SV>`. Scopes now overlap → conflict → the drawing edit rolls back instead of landing on top of a destroyed variable.

**Why this shape:** it's targeted. Only the known-risky tile ↔ shared-model pairs expand the conflict surface; everything else keeps the benefit of disjoint-scope merge. Users keep most of their concurrent work — only the edits genuinely at risk of producing inconsistent state get reverted.

**Candidate couplings (from the scripts):**
- (Drawing, SharedVariables) — [test-scripts/shared-variables.md script 1](test-scripts/shared-variables.md)
- (Diagram, SharedVariables) — [test-scripts/shared-variables.md script 2](test-scripts/shared-variables.md)
- (Graph, SharedDataSet) — [test-scripts/shared-dataset.md scripts 1, 3](test-scripts/shared-dataset.md)
- (Table, SharedDataSet) — [test-scripts/shared-dataset.md script 2](test-scripts/shared-dataset.md)
- (DataCard, SharedDataSet) — [test-scripts/shared-dataset.md script 4](test-scripts/shared-dataset.md)

**Open questions:**
- Scope computation today is a pure path→string map. Adding coupling means passing the tile type and the document's shared-model registry into `getEntryScopeKeys` (or a sibling function).
- Tight version: only shared models in the tile's own `sharedModels()` list. Looser version: every shared model of the matching type in the document. The looser version catches more cases but reverts more aggressively.
- Declarative placement: the coupling could live in tile-plugin registration (the same place toolbar buttons and shared-model types are registered).
