import {Request, Response} from "express";

import {sendErrorResponse, sendSuccessResponse} from "../helpers/express";
import {isValidUnitCode} from "../helpers/image-references";
import {assembleUnit} from "../helpers/assemble-unit";
import {computeUnitSummaryStatus} from "../helpers/unit-summary-status";

// GET /unitSummaryStatus?unit=...&branch=... -- the live unit's current manifest, sourceHash, and
// per-problem sizes (no Markdown). The authoring panel compares this against a saved summary's
// own sourceManifest/sourceHash to decide whether it looks stale.
const unitSummaryStatus = async (req: Request, res: Response) => {
  const unit = req.query.unit?.toString();
  const branch = req.query.branch?.toString();
  if (!unit || !branch) {
    return sendErrorResponse(res, "Missing required parameters: unit or branch.", 400);
  }
  if (!isValidUnitCode(unit)) {
    return sendErrorResponse(res, "Invalid unit code.", 400);
  }

  try {
    const assembled = await assembleUnit(branch, unit);
    return sendSuccessResponse(res, computeUnitSummaryStatus(assembled));
  } catch (error) {
    console.error("Failed to compute unit summary status:", error);
    const message = error instanceof Error ? error.message : String(error);
    return sendErrorResponse(res, message, 500);
  }
};

export default unitSummaryStatus;
