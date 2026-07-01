import {Request, Response} from "express";
import {Octokit} from "@octokit/rest";

import {AuthorizedRequest, sendErrorResponse, sendSuccessResponse} from "../helpers/express";
import {describeGitHubError, owner, repo} from "../helpers/github";
import {escapeFirebaseKey, getDb, getUnitFilesPath} from "../helpers/db";
import {computeImageUsages} from "../helpers/unit-content";
import {isPathSafeImageFileName, isValidUnitCode} from "../helpers/image-references";

// Deletes a library image from GitHub and the Firebase files map. Only permitted when the image is
// unused in the current unit + teacher guide (re-verified here so a stale client can't force it).
const deleteImage = async (req: Request, res: Response) => {
  const unit = req.query.unit?.toString();
  const branch = req.query.branch?.toString();
  if (!unit || !branch) {
    return sendErrorResponse(res, "Missing required parameters: unit or branch.", 400);
  }
  if (!isValidUnitCode(unit)) {
    return sendErrorResponse(res, "Invalid unit code.", 400);
  }
  if (branch === "main") {
    return sendErrorResponse(res, "Cannot delete images on the main branch.", 400);
  }

  const fileName = req.body.fileName?.toString();
  if (!fileName) {
    return sendErrorResponse(res, "Missing required body parameter: fileName.", 400);
  }
  // Delete removes an EXISTING file rather than introducing a new name, so it accepts any path-safe
  // name — including messy legacy ones (spaces, "&", etc.) that the strict allowlist rejects. Those
  // are exactly the unused images an author needs to be able to clean up; the strict check is only
  // for names we create (upload / rename destination).
  if (!isPathSafeImageFileName(fileName)) {
    return sendErrorResponse(res, "Invalid fileName: it must not contain slashes or control characters.", 400);
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
    const {message, statusCode} = describeGitHubError(error, "An error occurred while deleting the image.");
    return sendErrorResponse(res, message, statusCode);
  }
};

export default deleteImage;
