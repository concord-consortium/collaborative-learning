import {Request, Response} from "express";
import admin from "firebase-admin";
import {Octokit} from "@octokit/rest";

import {AuthorizedRequest, sendErrorResponse, sendSuccessResponse} from "../helpers/express";
import {owner, repo} from "../helpers/github";
import {
  escapeFirebaseKey, getDb, getUnitFilesPath, getUnitMetadataUpdatesPath,
} from "../helpers/db";
import {getUnitContent, readEffectiveContentText, stageContentUpdate} from "../helpers/unit-content";
import {rewriteImageReference} from "../helpers/image-references";

// Renames a library image and rewrites every reference to it (current unit + teacher guide) so
// used images can be renamed without breaking content.
//
// The image file is moved in GitHub immediately (a single tree commit that re-points the existing
// blob to the new path and removes the old one). The reference rewrites are staged as unpushed
// "updates" — the author pushes them through the normal pipeline; previews resolve them right away.
const renameImage = async (req: Request, res: Response) => {
  const unit = req.query.unit?.toString();
  const branch = req.query.branch?.toString();
  if (!unit || !branch) {
    return sendErrorResponse(res, "Missing required parameters: unit or branch.", 400);
  }
  if (branch === "main") {
    return sendErrorResponse(res, "Cannot rename images on the main branch.", 400);
  }

  const fromFileName = req.body.fromFileName?.toString();
  const toFileName = req.body.toFileName?.toString();
  if (!fromFileName || !toFileName) {
    return sendErrorResponse(res, "Missing required body parameters: fromFileName or toFileName.", 400);
  }
  if (fromFileName === toFileName) {
    return sendErrorResponse(res, "The new name matches the current name.", 400);
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(toFileName)) {
    return sendErrorResponse(res, "Invalid name: only alphanumeric, dash, underscore, and dot are allowed.", 400);
  }

  const fromKey = `images/${fromFileName}`;
  const toKey = `images/${toFileName}`;

  try {
    const db = getDb();
    const filesRef = db.ref(getUnitFilesPath(branch, unit));
    const escapedFrom = escapeFirebaseKey(fromKey);
    const escapedTo = escapeFirebaseKey(toKey);

    const [fromSnap, toSnap] = await Promise.all([
      filesRef.child(escapedFrom).get(),
      filesRef.child(escapedTo).get(),
    ]);
    if (!fromSnap.exists()) {
      return sendErrorResponse(res, `Image "${fromFileName}" was not found in the library.`, 404);
    }
    if (toSnap.exists()) {
      return sendErrorResponse(res, `An image named "${toFileName}" already exists.`, 409);
    }
    const fileData = fromSnap.val();
    const blobSha: string = fileData.sha;

    // Move the blob in GitHub as a single commit: add new path (reusing the existing blob sha),
    // remove the old path. Follows the tree/commit pattern in push-unit.ts.
    const octokit = new Octokit({auth: (req as AuthorizedRequest).gitHubToken});
    const ref = await octokit.rest.git.getRef({owner, repo, ref: `heads/${branch}`});
    const latestCommitSha = ref.data.object.sha;
    const baseCommit = await octokit.rest.git.getCommit({owner, repo, commit_sha: latestCommitSha});
    const tree = await octokit.rest.git.createTree({
      owner,
      repo,
      base_tree: baseCommit.data.tree.sha,
      tree: [
        {path: `curriculum/${unit}/images/${toFileName}`, mode: "100644", type: "blob", sha: blobSha},
        {path: `curriculum/${unit}/images/${fromFileName}`, mode: "100644", type: "blob", sha: null},
      ],
    });
    const commit = await octokit.rest.git.createCommit({
      owner,
      repo,
      message: `Rename image ${fromFileName} to ${toFileName} in unit ${unit}`,
      tree: tree.data.sha,
      parents: [latestCommitSha],
    });
    await octokit.rest.git.updateRef({owner, repo, ref: `heads/${branch}`, sha: commit.data.sha, force: false});

    // Update the files map: drop the old key, add the new one (same blob, so same sha).
    await filesRef.child(escapedFrom).remove();
    await filesRef.child(escapedTo).set(fileData);

    // Rewrite references across the unit's content and stage them as unpushed updates.
    const {contentFiles} = await getUnitContent(branch, unit);
    let updatedFileCount = 0;
    await Promise.all(contentFiles.map(async (file) => {
      const text = await readEffectiveContentText(branch, unit, file);
      const {text: rewritten, changed} = rewriteImageReference(unit, text, fromFileName, toFileName);
      if (changed) {
        updatedFileCount++;
        await stageContentUpdate(branch, unit, file.escapedPath, rewritten);
        await db.ref(getUnitMetadataUpdatesPath(branch, unit, file.escapedPath))
          .set(admin.database.ServerValue.TIMESTAMP);
      }
    }));

    return sendSuccessResponse(res, {updatedFileCount});
  } catch (error) {
    console.error("Failed to rename image:", error);
    return sendErrorResponse(res, "An error occurred while renaming the image.", 500);
  }
};

export default renameImage;
