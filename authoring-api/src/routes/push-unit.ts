import {Request, Response} from "express";
import {Octokit} from "@octokit/rest";
import {owner, repo} from "../helpers/github";

import {getBlobCachePath, getDb, getUnitUpdatesPath} from "../helpers/db";
import {AuthorizedRequest, sendErrorResponse, sendSuccessResponse} from "../helpers/express";
import {doPullUnit} from "./pull-unit";

const pushUnit = async (req: Request, res: Response) => {
  const unit = req.query.unit?.toString();
  const branch = req.query.branch?.toString();
  if (!unit || !branch) {
    return sendErrorResponse(res, "Missing required parameters: unit or branch.", 400);
  }

  if (branch === "main") {
    return sendErrorResponse(res, "Cannot push a unit to the main branch.", 400);
  }

  const {decodedToken} = req as AuthorizedRequest;
  const {name, email} = decodedToken || {};
  const author = name && email ? {name, email} : undefined;
  if (!author) {
    return sendErrorResponse(res, "Could not determine author information from token.", 400);
  }

  const authorizedRequest = req as AuthorizedRequest;
  const octokit = new Octokit({auth: authorizedRequest.gitHubToken});

  let newCommitSha: string;
  try {
    // get the updates
    const db = getDb();
    const updatesPath = getUnitUpdatesPath(branch, unit);
    const updatesRef = db.ref(updatesPath);
    const updatesSnapshot = await updatesRef.once("value");

    let updates: Record<string, string> = {};
    let currentKey = "n/a";
    try {
      updates = Object.entries(updatesSnapshot.val() ?? {}).reduce<Record<string, string>>((acc, [key, value]) => {
        // the keys were encoded when saving to Firebase, so decode them back
        currentKey = decodeURIComponent(key);
        const path = `curriculum/${unit}/${currentKey}`;
        // this both ensures the value is valid JSON and pretty-prints it for the commit
        // which makes it easier to review in GitHub later and matches the formatting of existing files
        acc[path] = JSON.stringify(JSON.parse(value as string), null, 2);
        return acc;
      }, {});
    } catch (e) {
      console.error(`Failed to parse ${currentKey} update from database:`, e);
      return sendErrorResponse(res, `The ${currentKey} update is not valid JSON.`, 500);
    }
    const updateCount = Object.keys(updates).length;
    if (updateCount === 0) {
      return sendErrorResponse(res, "No updates to push for this unit and branch.", 400);
    }

    // get the branch ref to find the latest commit
    const ref = await octokit.rest.git.getRef({owner, repo, ref: `heads/${branch}`});
    const latestCommitSha = ref.data.object.sha;

    // get the latest commit to find its tree
    const baseCommit = await octokit.rest.git.getCommit({owner, repo, commit_sha: latestCommitSha});
    const baseTreeSha = baseCommit.data.tree.sha;

    // create blobs for each update
    const blobs = await Promise.all(
      Object.entries(updates).map(async ([path, content]) => {
        const blob = await octokit.rest.git.createBlob({owner, repo, content, encoding: "utf-8"});
        return {
          path,
          sha: blob.data.sha,
          // 100644 means a normal file that has read/write permissions for the owner and read-only for everyone else
          mode: "100644" as const,
          type: "blob" as const,
        };
      })
    );

    // save the commits to the blob cache checked by getRawContent as the raw url isn't instantly updated
    // when a commit is made and we don't want quick subsequent page reloads to show old content
    Object.values(updates).forEach(async (content, index) => {
      const blob = blobs[index];
      if (blob) {
        const blobPath = getBlobCachePath(blob.sha);
        await db.ref(blobPath).set(content);
      }
    });

    // create a new tree based on the base tree + our blob entries
    const tree = await octokit.rest.git.createTree({owner, repo, base_tree: baseTreeSha, tree: blobs});
    const newTreeSha = tree.data.sha;

    // create the commit
    const commit = await octokit.rest.git.createCommit({
      owner,
      repo,
      message: `Updated ${updateCount} file${updateCount === 1 ? "" : "s"} in ${unit} unit`,
      tree: newTreeSha,
      parents: [latestCommitSha],
      author,
    });
    newCommitSha = commit.data.sha;

    // move the branch ref to point at the new commit (fast-forward)
    await octokit.rest.git.updateRef({
      owner,
      repo,
      ref: `heads/${branch}`,
      sha: newCommitSha,
      force: false,
    });
  } catch (error) {
    console.error("Failed to create commit:", error);
    return sendErrorResponse(res, "An error occurred while creating the commit.", 500);
  }

  try {
    // now re-pull the unit and reset it to clear out the updates
    await doPullUnit(octokit, branch, unit, true);

    return sendSuccessResponse(res, {newCommitSha});
  } catch (error) {
    console.error("Failed to re-pull unit after pushing updates:", error);
    return sendErrorResponse(res, "Pushed updates, but failed to re-pull the unit.", 500);
  }
};

export default pushUnit;
