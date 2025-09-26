import {Request, Response} from "express";
import {getBranchesMetadataPath, getDb} from "../helpers/db";
import {sendErrorResponse, sendSuccessResponse} from "../helpers/express";

const getPulledUnits = async (req: Request, res: Response) => {
  const branch = req.query.branch?.toString();
  if (!branch) {
    return sendErrorResponse(res, "Missing required parameter: branch.", 400);
  }

  // for now just return all units under the branch that have been pulled for all users
  // in the future we may want to filter by what the user is allowed to see
  const snapshot = await getDb().ref(getBranchesMetadataPath(branch)).once("value");
  const branchMetadata = snapshot.val() || {};

  const units = Object.keys(branchMetadata.units || {});

  return sendSuccessResponse(res, {units});
};

export default getPulledUnits;
