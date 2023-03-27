export const escapeBackslashes = (text: string) => text.replaceAll(`\\`, `\\\\`);
export const escapeDoubleQuotes = (text: string) => text.replaceAll(`"`, `\\"`);
// export const removeNewlines = (text: string) => text.replaceAll(`\\n`, ``).replaceAll(`\\r`, ``);
export const removeNewLines = (text: string) => text.replace(/\r?\n|\r/g, "");
