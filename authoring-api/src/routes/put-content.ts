import {Request, Response} from "express";
import admin from "firebase-admin";

import {escapeFirebaseKey, getDb, getUnitMetadataUpdatesPath, getUnitUpdatesPath} from "../helpers/db";
import {sendErrorResponse, sendSuccessResponse} from "../helpers/express";

const putContent = async (req: Request, res: Response) => {
  const unit = req.query.unit?.toString();
  const branch = req.query.branch?.toString();
  const path = req.query.path?.toString();
  if (!unit || !branch || !path) {
    return sendErrorResponse(res, "Missing required parameters: unit or branch or path.", 400);
  }

  if (branch === "main") {
    return sendErrorResponse(res, "Cannot save content on the main branch.", 400);
  }

  const content = req.body?.content;
  if (!content) {
    return sendErrorResponse(res, "Missing or invalid body parameter: content.", 400);
  }
  if (typeof content !== "object") {
    return sendErrorResponse(res, "Missing or invalid body parameter: content must be an object.", 400);
  }

  // we store the content as a string
  const stringContent = JSON.stringify(content);

  const db = getDb();
  const escapedPath = escapeFirebaseKey(path);
  const contentPath = getUnitUpdatesPath(branch, unit, escapedPath);
  await db.ref(contentPath).set(stringContent);

  const unitMetadataUpdatePath = getUnitMetadataUpdatesPath(branch, unit, escapedPath);
  await db.ref(unitMetadataUpdatePath).set(admin.database.ServerValue.TIMESTAMP);

  return sendSuccessResponse(res, {});
};

export default putContent;
