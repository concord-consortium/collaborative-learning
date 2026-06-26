import {Request, Response} from "express";
import {Octokit} from "@octokit/rest";

import {AuthorizedRequest, sendErrorResponse, sendSuccessResponse} from "../helpers/express";
import {owner, repo} from "../helpers/github";
import {escapeFirebaseKey, getDb, getUnitFilesPath} from "../helpers/db";
import {computeImageUsages} from "../helpers/unit-content";

// Deletes a library image from GitHub and the Firebase files map. Only permitted when the image is
// unused in the current unit + teacher guide (re-verified here so a stale client can't force it).
const deleteImage = async (req: Request, res: Response) => {
  const unit = req.query.unit?.toString();
  const branch = req.query.branch?.toString();
  if (!unit || !branch) {
    return sendErrorResponse(res, "Missing required parameters: unit or branch.", 400);
  }
  if (branch === "main") {
    return sendErrorResponse(res, "Cannot delete images on the main branch.", 400);
  }

  const fileName = req.body.fileName?.toString();
  if (!fileName) {
    return sendErrorResponse(res, "Missing required body parameter: fileName.", 400);
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(fileName)) {
    return sendErrorResponse(res, "Invalid fileName: only alphanumeric, dash, underscore, and dot are allowed.", 400);
  }

  const imageKey = `images/${fileName}`;

  try {
    const usages = await computeImageUsages(branch, unit);
    const refs = usages[imageKey];
    if (refs === undefined) {
      return sendErrorResponse(res, `Image "${fileName}" was not found in the library.`, 404);
    }
    if (refs.length > 0) {
      return sendErrorResponse(res, `Cannot delete "${fileName}": it is used in ${refs.length} place(s).`, 409);
    }

    const db = getDb();
    const fileRef = db.ref(getUnitFilesPath(branch, unit));
    const escapedKey = escapeFirebaseKey(imageKey);
    const snapshot = await fileRef.child(escapedKey).get();
    if (!snapshot.exists()) {
      return sendErrorResponse(res, `Image "${fileName}" was not found in the library.`, 404);
    }
    const sha = snapshot.val().sha;

    const octokit = new Octokit({auth: (req as AuthorizedRequest).gitHubToken});
    await octokit.rest.repos.deleteFile({
      owner,
      repo,
      branch,
      path: `curriculum/${unit}/images/${fileName}`,
      message: `Delete image ${fileName} from unit ${unit}`,
      sha,
    });

    await fileRef.child(escapedKey).remove();

    return sendSuccessResponse(res, {});
  } catch (error) {
    console.error("Failed to delete image:", error);
    return sendErrorResponse(res, "An error occurred while deleting the image.", 500);
  }
};

export default deleteImage;
