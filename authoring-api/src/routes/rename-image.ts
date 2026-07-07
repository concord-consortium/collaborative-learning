import {Request, Response} from "express";
import admin from "firebase-admin";
import {Octokit} from "@octokit/rest";

import {AuthorizedRequest, sendErrorResponse, sendSuccessResponse} from "../helpers/express";
import {describeGitHubError, owner, repo} from "../helpers/github";
import {
  escapeFirebaseKey, getDb, getUnitFilesPath, getUnitMetadataUpdatesPath, getUnitUpdatesPath,
} from "../helpers/db";
import {getUnitContent, readEffectiveContentText} from "../helpers/unit-content";
import {
  isPathSafeImageFileName, isValidImageFileName, isValidUnitCode, rewriteImageReference,
} from "../helpers/image-references";

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
  if (!isValidUnitCode(unit)) {
    return sendErrorResponse(res, "Invalid unit code.", 400);
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
  // The source need only be safe to interpolate as a path (no separators/traversal) — this lets
  // authors rename messy legacy names (spaces, "&", etc.) toward clean ones. The destination is held
  // to the strict allowlist so every rename moves toward a clean name.
  if (!isPathSafeImageFileName(fromFileName)) {
    return sendErrorResponse(res, "Invalid current name: it must not contain slashes or control characters.", 400);
  }
  if (!isValidImageFileName(toFileName)) {
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

    // Compute all reference rewrites BEFORE mutating anything, so a read failure here leaves the
    // unit completely untouched rather than half-renamed.
    const {contentFiles} = await getUnitContent(branch, unit);
    const rewrites = (await Promise.all(contentFiles.map(async (file) => {
      const text = await readEffectiveContentText(branch, unit, file);
      const {text: rewritten, changed} = rewriteImageReference(unit, text, fromFileName, toFileName);
      return changed ? {escapedPath: file.escapedPath, rewritten} : null;
    }))).filter((r): r is {escapedPath: string; rewritten: string} => r !== null);

    // Move the blob in GitHub as a single commit: add new path (reusing the existing blob sha),
    // remove the old path. Follows the tree/commit pattern in push-unit.ts. This is the only
    // irreversible step, so it runs first — if it fails, nothing in Firebase has changed yet.
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

    // Apply every Firebase change in a single atomic multi-location update so the files-map swap and
    // the staged reference rewrites can't land partially: the old image key is dropped and the new
    // one added (same blob, so same sha), and each rewritten content file is staged as an unpushed
    // update with a metadata timestamp (the same updates + metadata shape put-content writes).
    const updates: Record<string, unknown> = {
      [getUnitFilesPath(branch, unit, escapedFrom)]: null,
      [getUnitFilesPath(branch, unit, escapedTo)]: fileData,
    };
    rewrites.forEach(({escapedPath, rewritten}) => {
      updates[getUnitUpdatesPath(branch, unit, escapedPath)] = rewritten;
      updates[getUnitMetadataUpdatesPath(branch, unit, escapedPath)] = admin.database.ServerValue.TIMESTAMP;
    });
    try {
      await db.ref().update(updates);
    } catch (dbError) {
      // The GitHub blob already moved but Firebase didn't record it, so the unit is half-renamed
      // (blob only at the new path, files-map still pointing at the old one). Best-effort revert the
      // commit to restore consistency; if even the revert fails, a unit re-pull resyncs from GitHub.
      console.error("Firebase update failed after the GitHub rename; reverting the commit.", dbError);
      try {
        const revertTree = await octokit.rest.git.createTree({
          owner,
          repo,
          base_tree: commit.data.tree.sha,
          tree: [
            {path: `curriculum/${unit}/images/${fromFileName}`, mode: "100644", type: "blob", sha: blobSha},
            {path: `curriculum/${unit}/images/${toFileName}`, mode: "100644", type: "blob", sha: null},
          ],
        });
        const revertCommit = await octokit.rest.git.createCommit({
          owner,
          repo,
          message: `Revert rename of ${fromFileName} (could not persist in Firebase)`,
          tree: revertTree.data.sha,
          parents: [commit.data.sha],
        });
        await octokit.rest.git.updateRef({
          owner, repo, ref: `heads/${branch}`, sha: revertCommit.data.sha, force: false,
        });
      } catch (revertError) {
        console.error("Revert also failed; unit may be inconsistent until re-pulled.", revertError);
      }
      throw dbError;
    }

    return sendSuccessResponse(res, {updatedFileCount: rewrites.length});
  } catch (error) {
    console.error("Failed to rename image:", error);
    const {message, statusCode} = describeGitHubError(error, "An error occurred while renaming the image.");
    return sendErrorResponse(res, message, statusCode);
  }
};

export default renameImage;
