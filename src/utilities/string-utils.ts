export const escapeBackslashes = (text: string) => text.replaceAll(`\\`, `\\\\`);
export const escapeDoubleQuotes = (text: string) => text.replaceAll(`"`, `\\"`);
export const removeNewlines = (text: string) => text.replaceAll(`\\n`, ``).replaceAll(`\\r`, ``);
