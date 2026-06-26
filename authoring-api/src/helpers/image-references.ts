// Helpers for finding and rewriting references to a unit's media-library images inside authored
// content. Images are referenced in tile content (url/filename fields) as the normalized token
// `{unit}/images/{file}` (see localAssetsImagesHandler in src/models/image-map.ts). These are pure
// string functions so they can be unit-tested without Firebase/GitHub.

const imageFileChars = "A-Za-z0-9._-";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Matches `{unit}/images/{file}`, requiring a non-identifier boundary before the unit so that a
// unit code which is merely a suffix of a longer token (e.g. "xsas" vs "sas") is not matched.
function imageRefRegExp(unit: string, flags = "g"): RegExp {
  return new RegExp(`(?<![${imageFileChars}])${escapeRegExp(unit)}/images/([${imageFileChars}]+)`, flags);
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
    `(?<![${imageFileChars}])${escapeRegExp(unit)}/images/${escapeRegExp(fromFile)}(?![${imageFileChars}])`,
    "g"
  );
  let changed = false;
  const text = contentText.replace(re, () => {
    changed = true;
    return `${unit}/images/${toFile}`;
  });
  return {text, changed};
}
