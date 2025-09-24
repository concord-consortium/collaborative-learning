import {Request, Response} from "express";
import {getDb, getUnitFilesPath, unescapeFirebaseKey, UnitFiles} from "../helpers/db";
import {sendErrorResponse, sendSuccessResponse} from "../helpers/express";

const getPulledFiles = async (req: Request, res: Response) => {
  const unit = req.query.unit?.toString();
  const branch = req.query.branch?.toString();
  if (!unit || !branch) {
    return sendErrorResponse(res, "Missing required parameters: unit or branch.", 400);
  }

  const snapshot = await getDb().ref(getUnitFilesPath(branch, unit)).once("value");
  const files: UnitFiles|undefined = snapshot.val();

  if (!files) {
    return sendErrorResponse(res, "No files found for the specified unit and branch.", 500);
  }

  // keys are escaped firebase keys, so unescape them
  const unescapedFiles = Object.keys(files).reduce<UnitFiles>((acc, escapedKey) => {
    const key = unescapeFirebaseKey(escapedKey);
    acc[key] = files[escapedKey];
    return acc;
  }, {});

  return sendSuccessResponse(res, {files: unescapedFiles});
};

export default getPulledFiles;
