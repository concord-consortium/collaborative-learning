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
//
// provider is mixed in the same way, and for the same reason at a larger scale: the
// parent doc accumulates vendor-specific state, so a conversation's provider is
// immutable for its lifetime and switching must land on a different doc. The default
// (OpenAI) provider contributes nothing to the id — that carve-out is what keeps every
// conversation created before provider selection existed resolving to the same doc.
// A non-default provider drops promptsKey instead of stacking with it: prompt overrides
// are OpenAI-only, so a prompt edit shouldn't fork a conversation that can't use them.
export function conversationDocId(
  uid: string, documentKey: string, network: string | undefined, problemPath: string,
  promptsKey?: string, provider?: string
): string {
  const base = `${networkDocumentKey(uid, documentKey, network)}_${escapeKey(problemPath)}`;
  if (provider) return `${base}_v${provider}`;
  return promptsKey ? `${base}_p${promptsKey}` : base;
}
