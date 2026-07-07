// Reads a unit's authored content for image-usage scanning and reference rewriting.
//
// The pulled `files` map (populated by pull-unit) lists every file path with its current git blob
// `sha`. We use that to enumerate content.json files cheaply (no git-tree walk at scan time) and to
// key a per-(unit, blob) image-reference cache so repeated scans only re-read files whose content
// changed.

import {getRawUrl} from "./github";
import {
  authoringPath, getBlobCachePath, getDb, getUnitFilesPath, getUnitUpdatesPath,
  unescapeFirebaseKey, UnitFiles,
} from "./db";
import {buildUsageMap, extractImageKeys} from "./image-references";

// Keyed by both unit and blob sha: extractImageKeys is unit-dependent (references embed the unit
// code), so a blob shared across units must not reuse another unit's extracted keys.
const getImageRefIndexPath = (unit: string, sha: string) => `${authoringPath}/imageRefIndex/${unit}/${sha}`;

const isContentFile = (path: string) => path.endsWith("content.json");
const isImageFile = (path: string) => path.startsWith("images/");

export interface UnitContentFile {
  // unescaped, relative to curriculum/{unit}/ e.g. "investigation-0/problem-1/x/content.json"
  path: string;
  // firebase-escaped key into the files/updates maps
  escapedPath: string;
  // git blob sha of the committed content (absent for never-committed files)
  sha?: string;
  // pending unpushed edit (stringified JSON), if any
  updateText?: string;
}

export interface UnitContent {
  // library image keys ("images/{file}")
  imageKeys: string[];
  // image key -> blob sha (for GitHub delete/move)
  imageShas: Record<string, string | undefined>;
  contentFiles: UnitContentFile[];
}

// Load the files + pending updates maps and split into library images and content files.
export async function getUnitContent(branch: string, unit: string): Promise<UnitContent> {
  const db = getDb();
  const [filesSnap, updatesSnap] = await Promise.all([
    db.ref(getUnitFilesPath(branch, unit)).get(),
    db.ref(getUnitUpdatesPath(branch, unit)).get(),
  ]);
  const files: UnitFiles = filesSnap.val() ?? {};
  const updates: Record<string, string> = updatesSnap.val() ?? {};

  const imageKeys: string[] = [];
  const imageShas: Record<string, string | undefined> = {};
  const contentFiles: UnitContentFile[] = [];

  Object.entries(files).forEach(([escapedPath, file]) => {
    const path = unescapeFirebaseKey(escapedPath);
    if (isImageFile(path)) {
      imageKeys.push(path);
      imageShas[path] = file.sha;
    } else if (isContentFile(path)) {
      contentFiles.push({path, escapedPath, sha: file.sha, updateText: updates[escapedPath]});
    }
  });

  return {imageKeys, imageShas, contentFiles};
}

// Resolve the effective content text for a file: pending update wins, then the cached blob, then
// GitHub raw. (get-content.ts uses the same update-then-GitHub precedence; we add the blob-cache
// tier in between to avoid re-fetching unchanged committed files during a scan.)
async function readEffectiveContentText(branch: string, unit: string, file: UnitContentFile): Promise<string> {
  if (file.updateText != null) {
    return file.updateText;
  }
  const db = getDb();
  if (file.sha) {
    const blobSnap = await db.ref(getBlobCachePath(file.sha)).get();
    const blob = blobSnap.val();
    if (typeof blob === "string") {
      return blob;
    }
  }
  const response = await fetch(getRawUrl(branch, unit, file.path));
  if (!response.ok) {
    throw new Error(`Failed to fetch ${file.path}: ${response.statusText}`);
  }
  return response.text();
}

// Image keys referenced by a file. Committed files (with a stable sha and no pending edit) are
// cached by blob sha so unchanged files are never re-fetched/re-parsed on later scans.
async function extractKeysForFile(branch: string, unit: string, file: UnitContentFile): Promise<string[]> {
  const cacheable = file.sha != null && file.updateText == null;
  const db = getDb();
  if (cacheable) {
    const cachedSnap = await db.ref(getImageRefIndexPath(unit, file.sha!)).get();
    const cached = cachedSnap.val();
    if (Array.isArray(cached)) {
      return cached;
    }
  }
  const text = await readEffectiveContentText(branch, unit, file);
  const keys = extractImageKeys(unit, text);
  if (cacheable) {
    // Firebase drops empty arrays; that's fine — a miss simply recomputes (cheaply) next time.
    await db.ref(getImageRefIndexPath(unit, file.sha!)).set(keys);
  }
  return keys;
}

// image key ("images/{file}") -> referencing content-file paths. Unused images map to [].
export async function computeImageUsages(branch: string, unit: string): Promise<Record<string, string[]>> {
  const {imageKeys, contentFiles} = await getUnitContent(branch, unit);
  const perFile = await Promise.all(
    contentFiles.map(async (file) => ({path: file.path, keys: await extractKeysForFile(branch, unit, file)}))
  );
  return buildUsageMap(imageKeys, perFile);
}

export {readEffectiveContentText};
