// The chat tutor's backend vocabulary. It lives in shared/ because the places that reference it
// must not disagree: the client (which resolves and stamps the provider), the unit config schema,
// and the Firestore trigger, which picks a TutorProvider from this same list. The trigger's
// router keys its backend map on TutorProviderId, so a backend registered under a name that is
// not in this list — or a name in this list with no backend — is a compile error there rather
// than a throw on a student's turn.
//
// A fourth place can't import it: the enum pin in the chatTutor rules blocks. Adding a provider
// here means editing BOTH rules blocks — authed and demo — or every message write under the new
// provider fails with permission-denied, and demo/qa is where a new provider gets exercised first.
// src/components/chat-tutor/tutor-provider-rules.test.ts fails if either block drifts from this
// list; the accept cases in firebase-test/src/chat-tutor-rules.test.ts are what catch an entry
// added here and missed in both.
export const kTutorProviders = ["openai", "foreverlearning"] as const;

export type TutorProviderId = typeof kTutorProviders[number];

// The provider a conversation uses when nothing selects one. It is deliberately never stamped
// on a message doc or mixed into a conversation id — see nonDefaultTutorProvider.
export const kDefaultTutorProvider: TutorProviderId = "openai";
