import {Request, Response} from "express";
import {getRawUrl} from "../helpers/github";
import {escapeFirebaseKey, getDb, getUnitContentPath} from "../helpers/db";

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
  const contentPath = getUnitContentPath(branch, unit, escapedPath);
  const snapshot = await db.ref(contentPath).once("value");
  const content = snapshot.val();
  if (content) {
    return res.send(content);
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
