import {Request, Response} from "express";
import {getBranchesMetadataPath, getDb} from "../helpers/db";
import {sendSuccessResponse} from "../helpers/express";

const getPulledBranches = async (req: Request, res: Response) => {
  // for now just return all branches that have been pulled for all users
  // in the future we may want to filter by what the user is allowed to see
  const snapshot = await getDb().ref(getBranchesMetadataPath()).once("value");
  const branchesMetadata = snapshot.val() || {};

  const branches = Object.keys(branchesMetadata);

  sendSuccessResponse(res, {branches});
};

export default getPulledBranches;
