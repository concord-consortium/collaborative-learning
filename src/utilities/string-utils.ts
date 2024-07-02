export const escapeBackslashes = (text: string) => text.replaceAll(`\\`, `\\\\`);
export const escapeDoubleQuotes = (text: string) => text.replaceAll(`"`, `\\"`);
export const removeNewlines = (text: string) => text.replace(/\r?\n|\r/g, "");
export const removeTabs = (text: string) => text.replace(/\t/g, "");

export const countWords = (text: string) => {
  const matches = text.match(/\b\w+\b/g); // transitions from non-word to word character.
  return matches ? matches.length : 0;
};
