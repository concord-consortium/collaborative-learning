import {Request, Response} from "express";
import {getRawUrl} from "../helpers/github";
import {
  escapeFirebaseKey, getBlobCachePath, getDb, getUnitFilesPath, getUnitUpdatesPath, UnitFile,
} from "../helpers/db";

const getRawContent = async (req: Request, res: Response) => {
  const matches = req.path.match(/^\/?([^/]+)\/([^/]+)\/(.+)$/);
  if (!matches) {
    // don't use the sendErrorResponse helper here since it adds extra json formatting
    res.status(400).send("Bad Request: Invalid path format. Expected /rawContent/:branch/:unit/:path");
    return;
  }

  const branch = matches[1];
  const unit = matches[2];
  const path = matches[3];

  // look first for updates
  const db = getDb();
  const escapedPath = escapeFirebaseKey(path);
  const contentPath = getUnitUpdatesPath(branch, unit, escapedPath);
  const snapshot = await db.ref(contentPath).once("value");
  if (snapshot.exists()) {
    return res.send(snapshot.val());
  }

  // next look in the blob cache for any committed files as the raw content
  // url isn't instantly updated when a commit is made
  const unitFilePath = getUnitFilesPath(branch, unit, escapedPath);
  const fileSnapshot = await db.ref(unitFilePath).once("value");
  if (fileSnapshot.exists()) {
    const {sha} = fileSnapshot.val() as UnitFile;
    if (sha) {
      const blobPath = getBlobCachePath(sha);
      const blobSnapshot = await db.ref(blobPath).once("value");
      if (blobSnapshot.exists()) {
        return res.send(blobSnapshot.val());
      }
    }
  }

  // otherwise get from github
  const rawUrl = getRawUrl(branch, unit, path);
  try {
    const response = await fetch(rawUrl);
    if (!response.ok) {
      return res.status(response.status).send(`Error fetching content from GitHub: ${response.statusText}`);
    }
    const rawContent = await response.text();
    return res.send(rawContent);
  } catch (error) {
    return res.status(500).send(`Error fetching content from GitHub: ${error}`);
  }
};

export default getRawContent;
