// Helpers for finding and rewriting references to a unit's media-library images inside authored
// content. Images are referenced in tile content (url/filename fields) as the normalized token
// `{unit}/images/{file}` (see localAssetsImagesHandler in src/models/image-map.ts). These are pure
// string functions so they can be unit-tested without Firebase/GitHub.

// Two deliberately separate concerns: the naming POLICY for a clean destination name, and the
// character set that can appear in an EXISTING reference already sitting in content.
//
// safeNameChars — the naming policy for a clean library filename / unit code, enforced on every new
// or renamed (destination) name. Strict on purpose: no spaces, no "&", no path separators.
//
// refToken — one character of a reference token as it appears in content. Authored content is JSON,
// so a "{unit}/images/{file}" reference is always the value of a string field and is terminated by
// the string delimiter. It matches the CLUE runtime (localAssetsImagesHandler.match in
// src/models/image-map.ts), which resolves any such url that contains no space/colon and ends in an
// extension: the only characters that can't be part of the filename are the JSON string delimiter,
// whitespace, ":" and "/" (the runtime rejects spaces/colons, and a library filename is a single
// path segment), and "\\" (a JSON escape). Everything else the runtime accepts — legacy punctuation
// like ( ) % + ' , & and non-ASCII — is part of the name, so the scanner counts/rewrites it
// correctly. Keeping this separate from safeNameChars means detecting a messy name never loosens
// the policy for creating one.
const safeNameChars = "A-Za-z0-9._-";
const refToken = "[^\\x22\\s:/\\\\]"; // \x22 is the JSON string delimiter (")

const safeNameRegExp = new RegExp(`^[${safeNameChars}]+$`);

// A library image filename must end in a real extension (dot + 3+ letters) so it resolves through
// the runtime matcher (localAssetsImagesHandler.match, /\.[a-z]{3,}$/i). Without this an author
// could rename an image to an extension-less name that passes the charset check but then fails to
// render everywhere it's used.
const imageExtensionRegExp = /\.[a-z]{3,}$/i;

// Library image filenames are restricted to a safe character set (no path separators) and must carry
// a valid image extension, so they can be interpolated into GitHub paths / Firebase keys without
// traversal risk and always resolve at runtime. Shared by the upload/delete/rename routes so the
// allowlist (and its rejection) stays consistent.
export function isValidImageFileName(name: string): boolean {
  return safeNameRegExp.test(name) && imageExtensionRegExp.test(name);
}

// Unit codes are single path segments under curriculum/{unit}/; restrict them to the same safe set
// so a crafted `unit` (e.g. containing "/" or "..") can't escape the intended unit directory when
// interpolated into GitHub paths.
export function isValidUnitCode(unit: string): boolean {
  return safeNameRegExp.test(unit);
}

// A looser check for an image filename we only need to LOCATE an existing file by (e.g. the rename
// SOURCE). Unlike isValidImageFileName, it tolerates messy legacy names (spaces, "&", etc.) so
// authors can rename those to clean names — rename being the very tool for that cleanup. It only
// blocks what could escape the images/ directory when interpolated into a GitHub path or Firebase
// key: path separators, "."/".." segments, and control characters. The new (destination) name is
// still held to the strict allowlist, so renames always move toward clean names.
export function isPathSafeImageFileName(name: string): boolean {
  if (name === "" || name === "." || name === "..") return false;
  for (let i = 0; i < name.length; i++) {
    const code = name.charCodeAt(i);
    // Reject control chars (< 0x20), forward slash (47), and backslash (92); spaces, "&", etc. are OK.
    if (code < 0x20 || code === 47 || code === 92) return false;
  }
  return true;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Matches `{unit}/images/{file}`, requiring a non-token boundary before the unit so that a unit
// code which is merely a suffix of a longer token (e.g. "xsas" vs "sas") is not matched.
function imageRefRegExp(unit: string, flags = "g"): RegExp {
  return new RegExp(`(?<!${refToken})${escapeRegExp(unit)}/images/(${refToken}+)`, flags);
}

// Returns the de-duplicated list of library image keys (`images/{file}`) referenced by the given
// content text for `unit`. References to other units' images are ignored.
export function extractImageKeys(unit: string, contentText: string): string[] {
  const keys = new Set<string>();
  const re = imageRefRegExp(unit);
  let match: RegExpExecArray | null;
  while ((match = re.exec(contentText)) !== null) {
    keys.add(`images/${match[1]}`);
  }
  return Array.from(keys);
}

// Inverts per-file extracted image keys into a map of library image key -> referencing file paths.
// Every key in `imageKeys` is present in the result (unused images map to an empty array); keys
// found in content that are not in `imageKeys` are ignored.
export function buildUsageMap(
  imageKeys: string[],
  perFile: Array<{path: string; keys: string[]}>
): Record<string, string[]> {
  const library = new Set(imageKeys);
  const usages: Record<string, string[]> = {};
  imageKeys.forEach((key) => {
    usages[key] = [];
  });
  perFile.forEach(({path, keys}) => {
    keys.forEach((key) => {
      if (library.has(key)) {
        usages[key].push(path);
      }
    });
  });
  return usages;
}

// Rewrites references to `{unit}/images/{fromFile}` -> `{unit}/images/{toFile}` in content text.
// Returns the new text and whether anything changed. A trailing boundary ensures `old.png` does
// not match inside `old-version.png`.
export function rewriteImageReference(
  unit: string,
  contentText: string,
  fromFile: string,
  toFile: string
): {text: string; changed: boolean} {
  const re = new RegExp(
    `(?<!${refToken})${escapeRegExp(unit)}/images/${escapeRegExp(fromFile)}(?!${refToken})`,
    "g"
  );
  let changed = false;
  const text = contentText.replace(re, () => {
    changed = true;
    return `${unit}/images/${toFile}`;
  });
  return {text, changed};
}
