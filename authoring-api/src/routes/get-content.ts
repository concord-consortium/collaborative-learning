import {Request, Response} from "express";
import {getRawUrl} from "../helpers/github";
import {escapeFirebaseKey, getDb, getUnitUpdatesPath} from "../helpers/db";
import {sendErrorResponse, sendSuccessResponse} from "../helpers/express";

const getContent = async (req: Request, res: Response) => {
  const unit = req.query.unit?.toString();
  const branch = req.query.branch?.toString();
  const path = req.query.path?.toString();
  if (!unit || !branch || !path) {
    return sendErrorResponse(res, "Missing required parameters: unit or branch or path.", 400);
  }

  // look first for updates
  const db = getDb();
  const escapedPath = escapeFirebaseKey(path);
  const contentPath = getUnitUpdatesPath(branch, unit, escapedPath);
  const snapshot = await db.ref(contentPath).once("value");
  const content = snapshot.val();
  if (content) {
    try {
      const jsonContent = JSON.parse(content);
      return sendSuccessResponse(res, {via: "update", content: jsonContent});
    } catch (error) {
      return sendErrorResponse(res, `Error parsing content: ${error}`, 500);
    }
  }

  // otherwise get from github
  const rawUrl = getRawUrl(branch, unit, path);
  try {
    const response = await fetch(rawUrl);
    if (response.ok) {
      const content = await response.json();
      return sendSuccessResponse(res, {via: "github", content});
    } else {
      return sendErrorResponse(res, `Error fetching file from GitHub: ${response.statusText}`, response.status);
    }
  } catch (error) {
    return sendErrorResponse(res, `Error fetching file from GitHub: ${error}`);
  }
};

export default getContent;
