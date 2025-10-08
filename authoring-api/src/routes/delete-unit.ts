import {Request, Response} from "express";

import {
  getDb,
  getUnitMetadataPath, getUnitPath,
} from "../helpers/db";
import {sendErrorResponse, sendSuccessResponse} from "../helpers/express";

const deleteUnit = async (req: Request, res: Response) => {
  const unit = req.query.unit?.toString();
  const branch = req.query.branch?.toString();
  if (!unit || !branch) {
    return sendErrorResponse(res, "Missing required parameters: unit or branch.", 400);
  }

  try {
    const db = getDb();
    await db.ref(getUnitPath(branch, unit)).remove();
    await db.ref(getUnitMetadataPath(branch, unit)).remove();

    return sendSuccessResponse(res, {});
  } catch (error) {
    console.error("Failed to delete unit:", error);
    return sendErrorResponse(res, "An error occurred while deleting the unit.", 500);
  }
};

export default deleteUnit;
