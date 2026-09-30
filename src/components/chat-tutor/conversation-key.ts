import { TutorProviderId } from "../../../shared/chat-tutor-providers";
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
//
// unitKey (a hash of the formatted unit-summary slice actually installed, see chat-sidebar.tsx)
// is mixed in for the same reason as promptsKey: the installed context is immutable for a
// conversation's lifetime, so anything that changes what gets installed -- an author editing or
// regenerating the summary, a curriculum edit that makes the slice disappear or reappear -- must
// resolve to a different doc. A unit with no summary (or one that never resolves to a usable
// slice) contributes nothing, so existing conversations in such units keep their id.
//
// The suffixes stack rather than one masking another. Each names something the conversation was
// built with and cannot be re-made with, so each has to fork on its own: whichever backend ends
// up answering, a prompt edit must not land on a conversation whose prompt is already installed
// and immutable, and the same goes for the unit context.
export function conversationDocId(
  uid: string, documentKey: string, network: string | undefined, problemPath: string,
  promptsKey?: string, provider?: TutorProviderId, unitKey?: string
): string {
  const base = `${networkDocumentKey(uid, documentKey, network)}_${escapeKey(problemPath)}`;
  const withProvider = provider ? `${base}_v${provider}` : base;
  const withPrompts = promptsKey ? `${withProvider}_p${promptsKey}` : withProvider;
  return unitKey ? `${withPrompts}_u${unitKey}` : withPrompts;
}
