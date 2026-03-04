/**
 * Splice text into a base string at the given offset, adding spaces as needed.
 * When endOffset is provided and differs from offset, the selected range is replaced.
 */
export function spliceWithSpacing(base: string, offset: number, text: string, endOffset?: number) {
  const before = base.slice(0, offset);
  const after = base.slice(endOffset ?? offset);

  const needSpaceBefore = before.length > 0
    && !before.endsWith(" ") && !before.endsWith("\n");
  const prefix = needSpaceBefore ? " " : "";

  const needSpaceAfter = after.length > 0
    && !after.startsWith(" ") && !after.startsWith("\n");
  const suffix = needSpaceAfter ? " " : "";

  return {
    newText: before + prefix + text + suffix + after,
    newCursorPos: offset + prefix.length + text.length + suffix.length,
  };
}

