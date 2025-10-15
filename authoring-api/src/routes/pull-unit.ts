import {Request, Response} from "express";
import admin from "firebase-admin";
import {Octokit} from "@octokit/rest";
import {getBaseUnitPath, owner, getRawUrl, repo} from "../helpers/github";

import {
  BranchesMetadata, BranchMetadata, escapeFirebaseKey, getBranchesMetadataPath, getDb,
  getUnitFilesPath, getUnitUpdatesPath, unescapeFirebaseKey, UnitFiles, UnitMetadata,
} from "../helpers/db";
import {AuthorizedRequest, sendErrorResponse, sendSuccessResponse} from "../helpers/express";

export const doPullUnit = async (octokit: Octokit, branch: string, unit: string, reset: boolean) => {
  const {data: {commit: {sha: branchSha}}} = await octokit.rest.repos.getBranch({
    owner,
    repo,
    branch,
  });

  const {data: {tree}} = await octokit.rest.git.getTree({
    owner,
    repo,
    tree_sha: branchSha,
    recursive: "1",
  });

  const baseUnitPath = getBaseUnitPath(unit);
  const files = tree.filter((item) => {
    return item.path && item.sha && item.type === "blob" && (
      item.path.startsWith(baseUnitPath) || item.path === baseUnitPath
    );
  }).reduce<UnitFiles>((acc, item) => {
    const path = item.path!.substring(baseUnitPath.length);
    const key = escapeFirebaseKey(path);
    acc[key] = {sha: item.sha!};
    return acc;
  }, {});

  for (const [key, file] of Object.entries(files)) {
    const path = unescapeFirebaseKey(key);
    if (!path.endsWith(".json")) {
      // we only need to check the type for JSON files
      continue;
    }
    if (path === "content.json") {
      file.type = "unit";
    } else if (path === "teacher-guide/content.json") {
      file.type = "teacher-guide";
    } else {
      // we have to parse exemplars to get the title, otherwise we could have
      // just checked the path
      file.type = path.startsWith("exemplars/") ? "exemplar" : "unknown";

      const url = getRawUrl(branch, unit, path);
      try {
        const response = await fetch(url);
        if (response.ok) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const json: any = await response.json();
          if (json.type) {
            file.type = json.type;
          }
          if (json.title) {
            file.title = json.title;
          }
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        file.type = "missing";
      }
    }
  }

  // update the database
  const filesPath = getUnitFilesPath(branch, unit);
  const updatesPath = getUnitUpdatesPath(branch, unit);
  const branchesMetadataPath = getBranchesMetadataPath();

  const db = getDb();
  const fileRef = db.ref(filesPath);
  const updatesRef = db.ref(updatesPath);
  const branchesMetadataRef = db.ref(branchesMetadataPath);

  // set the files and maybe reset the updates
  await fileRef.set(files);
  if (reset) {
    await updatesRef.remove();
  }

  // add the branch and unit to the metadata
  await branchesMetadataRef.transaction((currentMetadata: BranchesMetadata|null) => {
    const currentBranchMetadata: BranchMetadata = currentMetadata?.[branch] ?? {units: {}};
    currentBranchMetadata.units[unit] = currentBranchMetadata.units[unit] ?? {} as UnitMetadata;
    const unitMetadata = currentBranchMetadata.units[unit];
    unitMetadata.pulledAt = admin.database.ServerValue.TIMESTAMP;
    if (reset) {
      delete unitMetadata.updates;
    }
    return {...currentMetadata, [branch]: currentBranchMetadata};
  });
};

const pullUnit = async (req: Request, res: Response) => {
  const unit = req.query.unit?.toString();
  const branch = req.query.branch?.toString();
  if (!unit || !branch) {
    return sendErrorResponse(res, "Missing required parameters: unit or branch.", 400);
  }

  if (branch === "main") {
    return sendErrorResponse(res, "Cannot pull a unit on the main branch.", 400);
  }

  // reset is optional
  const reset = req.query.reset === "true";

  try {
    const authorizedRequest = req as AuthorizedRequest;
    const octokit = new Octokit({auth: authorizedRequest.gitHubToken});

    await doPullUnit(octokit, branch, unit, reset);

    return sendSuccessResponse(res, {});
  } catch (error) {
    console.error("Failed to fetch repository tree:", error);
    return sendErrorResponse(res, "An error occurred while fetching the repository data.", 500);
  }
};

export default pullUnit;
