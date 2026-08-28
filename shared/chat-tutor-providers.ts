// The chat tutor's backend vocabulary, shared because the same list is referenced from three
// places that must not disagree: the client (which resolves and stamps the provider), the unit
// config schema, and the Firestore trigger (which routes a turn to a TutorProvider).
//
// A fourth place can't import it: the enum pin in the chatTutor rules blocks. Adding a provider
// here means editing BOTH rules blocks — authed and demo — or every message write under the new
// provider fails with permission-denied, and demo/qa is where a new provider gets exercised first.
export const kTutorProviders = ["openai", "foreverlearning"] as const;

export type TutorProviderId = typeof kTutorProviders[number];

// The provider a conversation uses when nothing selects one. It is deliberately never stamped
// on a message doc or mixed into a conversation id — see nonDefaultTutorProvider.
export const kDefaultTutorProvider: TutorProviderId = "openai";
