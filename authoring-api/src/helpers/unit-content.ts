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

// Load the files + pending updates maps and build one UnitContentFile record per path, of any
// file type -- unlike getUnitContent below, this applies no content.json/images filter, since a
// section can reference a file under any name (see assemble-unit.ts).
//
// A path is included if it appears in EITHER map: most saved content ends up in both, but nothing
// guarantees that, so a brand-new, update-only file must not be silently dropped.
export async function loadUnitFileInventory(branch: string, unit: string): Promise<UnitContentFile[]> {
  const db = getDb();
  const [filesSnap, updatesSnap] = await Promise.all([
    db.ref(getUnitFilesPath(branch, unit)).get(),
    db.ref(getUnitUpdatesPath(branch, unit)).get(),
  ]);
  const files: UnitFiles = filesSnap.val() ?? {};
  const updates: Record<string, string> = updatesSnap.val() ?? {};

  const escapedPaths = new Set([...Object.keys(files), ...Object.keys(updates)]);
  return Array.from(escapedPaths).map((escapedPath) => ({
    path: unescapeFirebaseKey(escapedPath),
    escapedPath,
    sha: files[escapedPath]?.sha,
    updateText: updates[escapedPath],
  }));
}

// Load the inventory and split into library images and content files -- what image-usage
// scanning needs. The content.json/images split is a convenience filter for that one caller, not
// a statement about what is part of the curriculum: it includes teacher guides, exemplars, and
// orphan files, and would miss a referenced section file under a nonstandard name.
export async function getUnitContent(branch: string, unit: string): Promise<UnitContent> {
  const inventory = await loadUnitFileInventory(branch, unit);

  const imageKeys: string[] = [];
  const imageShas: Record<string, string | undefined> = {};
  const contentFiles: UnitContentFile[] = [];

  inventory.forEach((file) => {
    if (isImageFile(file.path)) {
      imageKeys.push(file.path);
      imageShas[file.path] = file.sha;
    } else if (isContentFile(file.path)) {
      contentFiles.push(file);
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
