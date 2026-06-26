import {Request, Response} from "express";

import {sendErrorResponse, sendSuccessResponse} from "../helpers/express";
import {computeImageUsages} from "../helpers/unit-content";

// Returns, per library image key ("images/{file}"), the list of content-file paths (relative to
// curriculum/{unit}/) that reference it. Count = list length; unused images map to []. Scoped to
// the current unit + its teacher guide.
const getImageUsages = async (req: Request, res: Response) => {
  const unit = req.query.unit?.toString();
  const branch = req.query.branch?.toString();
  if (!unit || !branch) {
    return sendErrorResponse(res, "Missing required parameters: unit or branch.", 400);
  }

  try {
    const usages = await computeImageUsages(branch, unit);
    return sendSuccessResponse(res, {usages});
  } catch (error) {
    console.error("Failed to compute image usages:", error);
    return sendErrorResponse(res, "An error occurred while computing image usages.", 500);
  }
};

export default getImageUsages;
