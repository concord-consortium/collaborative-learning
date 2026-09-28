// Core logic for GET /unitSummaryStatus: the current manifest, sourceHash, and per-problem sizes
// for a live unit -- no Markdown. Kept separate from routes/unit-summary-status.ts (the thin
// Express handler) so it is testable without Express. The interesting behavior (a stable
// sourceHash/manifest when nothing changed, a changed problemHash after an edit, a manifest
// mismatch after a rename/reorder) belongs to assembleUnit itself and is covered by
// assemble-unit.test.ts; this is a thin, order-preserving projection of its result.
import {IUnitSummaryStatusResponse} from "../../../shared/unit-summary-types";
import {AssembledUnit} from "./assemble-unit";

export function computeUnitSummaryStatus(assembled: AssembledUnit): IUnitSummaryStatusResponse {
  return {
    sourceHash: assembled.sourceHash,
    sourceManifest: assembled.sourceManifest,
    problemSizes: assembled.problems.map((p) => ({ordinal: p.ordinal, markdownLength: p.markdown.length})),
  };
}
