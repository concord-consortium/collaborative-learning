/**
 * Sanitizes a filename for upload by replacing invalid characters with hyphens.
 * Valid characters: a-z, A-Z, 0-9, dot, hyphen, underscore.
 * Collapses consecutive hyphens, trims leading/trailing hyphens from the basename.
 * Falls back to "image" + original extension if the sanitized basename is empty.
 */
export function sanitizeFileName(fileName: string): string {
  // Split on last dot to separate basename and extension
  const lastDotIndex = fileName.lastIndexOf(".");
  let basename = lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName;
  const extension = lastDotIndex > 0 ? fileName.substring(lastDotIndex) : "";

  // Replace invalid characters with hyphens
  basename = basename.replace(/[^a-zA-Z0-9._-]/g, "-");

  // Collapse consecutive hyphens
  basename = basename.replace(/-{2,}/g, "-");

  // Trim leading/trailing hyphens
  basename = basename.replace(/^-+|-+$/g, "");

  // Fallback if basename is empty or only dots
  if (!basename || /^\.+$/.test(basename)) {
    basename = "image";
  }

  // Sanitize extension (remove invalid chars), then drop if it reduced to just "."
  let sanitizedExtension = extension.replace(/[^a-zA-Z0-9.]/g, "");
  if (sanitizedExtension === ".") {
    sanitizedExtension = "";
  }

  const result = basename + sanitizedExtension;

  // Strip trailing dots from final result (problematic on Windows and in URLs)
  return result.replace(/\.+$/, "") || "image";
}
