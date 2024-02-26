/**
 * Construct a title from a base part and a numeric suffix.
 * @param titleBase
 * @param titleNumber
 * @returns numbered title
 */
export function defaultTitle(titleBase: string, titleNumber: number) {
  return `${titleBase} ${titleNumber}`;
}

/**
 * Return the base part of a title, with any trailing number stripped off.
 * @param title any string
 * @returns title base, which will be an initial substring of the title
 *   or the whole title if there was no numeric suffix.
 */
export function extractTitleBase(title: string) {
  const match = title.match(/^(.*?)( *\d+)?$/);
  return match?.[1] || "";
}

/**
 * Check if a title is constructed in the standard fashion as a base, optionally followed by a number.
 * @param title string to check
 * @param titleBase the base title part to check for
 * @returns a RegExp match object or null; the first group of the match is the number suffix (if any).
 */
export function titleMatchesDefault(title?: string, titleBase?: string) {
  return title?.match(new RegExp(`^${titleBase} *(\\d*)$`));
}

