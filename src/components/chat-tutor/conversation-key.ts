import { escapeKey, networkDocumentKey } from "../../../shared/shared";

// problemPath is slash-delimited (unitCode/inv/prob) and "/" is a Firestore path
// separator; networkDocumentKey escapes only the doc key/network, not an appended
// path, so problemPath must be escaped here.
//
// promptsKey (tutorPromptsKey of the unit's authored prompt overrides) is mixed in
// when present so a prompt edit maps to a fresh conversation — the generic prompt
// installs once per OpenAI conversation and its items are immutable, so an existing
// conversation can never pick up a changed prompt. With no authored prompts the id
// is unchanged from the pre-override format, preserving existing conversations.
export function conversationDocId(
  uid: string, documentKey: string, network: string | undefined, problemPath: string,
  promptsKey?: string
): string {
  const base = `${networkDocumentKey(uid, documentKey, network)}_${escapeKey(problemPath)}`;
  return promptsKey ? `${base}_p${promptsKey}` : base;
}
