import { escapeKey, networkDocumentKey } from "../../../shared/shared";

// problemPath is slash-delimited (unitCode/inv/prob) and "/" is a Firestore path
// separator; networkDocumentKey escapes only the doc key/network, not an appended
// path, so problemPath must be escaped here.
export function conversationDocId(
  uid: string, documentKey: string, network: string | undefined, problemPath: string
): string {
  return `${networkDocumentKey(uid, documentKey, network)}_${escapeKey(problemPath)}`;
}
