// djb2 — a cheap non-cryptographic hash, sufficient to detect that a payload changed.
//
// In shared/ because both ends of the chat-tutor wire use it: the client gates a resend on it,
// and the server derives the workspace revision from the payload it received. A second copy
// would let one side change and the other not notice.
export function hashString(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    // eslint-disable-next-line no-bitwise
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  // eslint-disable-next-line no-bitwise
  return (hash >>> 0).toString(36);
}
