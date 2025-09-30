import {Request, Response} from "express";
import {AuthorizedRequest, sendErrorResponse, sendSuccessResponse} from "../helpers/express";
import {newOctoKit, owner, repo} from "../helpers/github";
import {escapeFirebaseKey, getDb, getUnitFilesPath, UnitFile} from "../helpers/db";

const putImage = async (req: Request, res: Response) => {
  const unit = req.query.unit?.toString();
  const branch = req.query.branch?.toString();
  if (!unit || !branch) {
    return sendErrorResponse(res, "Missing required parameters: unit or branch.", 400);
  }

  const image = req.body.image?.toString();
  const fileName = req.body.fileName?.toString();
  if (!image || !fileName) {
    return sendErrorResponse(res, "Missing required body parameters: image or fileName.", 400);
  }
  // Validate fileName: only allow alphanumeric, dash, underscore, dot, no slashes or traversal
  if (!/^[a-zA-Z0-9._-]+$/.test(fileName)) {
    return sendErrorResponse(res, "Invalid fileName: only alphanumeric, dash, underscore, and dot are allowed.", 400);
  }

  let sha = undefined;

  try {
    const authorizedRequest = req as AuthorizedRequest;
    const octokit = newOctoKit(authorizedRequest.gitHubToken);

    const path = `curriculum/${unit}/images/${fileName}`;
    const filesPath = getUnitFilesPath(branch, unit);
    const db = getDb();
    const fileRef = db.ref(filesPath);
    const escapedFilesKey = escapeFirebaseKey(`images/${fileName}`);
    const snapshot = await fileRef.child(escapedFilesKey).get();

    if (snapshot.exists()) {
      const fileData: UnitFile = snapshot.val();
      sha = fileData.sha;
    }

    const message = sha ?
      `Update image ${fileName} in unit ${unit}` :
      `Add image ${fileName} to unit ${unit}`;

    const response = await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      branch,
      path,
      message,
      content: image,
      sha,
    });

    if (response.status !== 201 && response.status !== 200) {
      console.error("GitHub API response:", response);
      return sendErrorResponse(res, "Failed to upload image to GitHub.", 500);
    }

    sha = response.data.content?.sha;

    // update the files list in the unit's content in Firebase
    // the client listens for changes to this and will update accordingly
    fileRef.update({[escapedFilesKey]: {sha}});

    console.log("Image uploaded/updated successfully");
  } catch (error) {
    console.error("Error uploading image:", error);
    return sendErrorResponse(res, "Failed to upload image to GitHub.", 500);
  }

  return sendSuccessResponse(res, {sha});
};

export default putImage;
