// The chat tutor's backend vocabulary. It lives in shared/ because the places that reference it
// must not disagree: today the client (which resolves and stamps the provider) and the unit config
// schema, and — once a second backend exists — the Firestore trigger, which will pick a
// TutorProvider from this same list. The trigger does not consult it yet: it builds an OpenAI
// provider unconditionally, so a stamped provider selects nothing on the server today.
//
// A fourth place can't import it: the enum pin in the chatTutor rules blocks. Adding a provider
// here means editing BOTH rules blocks — authed and demo — or every message write under the new
// provider fails with permission-denied, and demo/qa is where a new provider gets exercised first.
export const kTutorProviders = ["openai", "foreverlearning"] as const;

export type TutorProviderId = typeof kTutorProviders[number];

// The provider a conversation uses when nothing selects one. It is deliberately never stamped
// on a message doc or mixed into a conversation id — see nonDefaultTutorProvider.
export const kDefaultTutorProvider: TutorProviderId = "openai";
