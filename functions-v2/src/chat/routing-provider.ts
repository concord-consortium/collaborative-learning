// Chooses which tutor backend answers a conversation.
//
// Itself a TutorProvider, so the drain is unchanged: it still calls one processTurn and commits
// one parentUpdate. That matters for the rule below, because the choice then persists through the
// same batch as the cursor and lands atomically or not at all.
//
// THE RULE: the backend is chosen from the first message of a conversation and held thereafter.
// The parent's recorded choice wins over anything a later message says. Conversation state is
// per-backend and meaningless across backends — an OpenAI conversation id, an FL session id — so a
// mid-conversation flip would strand half a conversation on each, and neither could answer
// coherently. The client stamps `provider` on every message precisely so the trigger can read it
// off whichever one it happens to be draining; it is the first one that decides.
//
// Backends are built lazily. Each needs its own credential and a Cloud Function only holds the
// secrets it declares, so constructing both up front would make an OpenAI turn fail for want of
// a ForeverLearning key.
import {DocumentData} from "firebase-admin/firestore";

import {kTutorProviders, TutorProviderId} from "../../../shared/chat-tutor-providers";
import {TurnResult, TutorProvider} from "./provider";

function isTutorProviderId(value: string): value is TutorProviderId {
  return (kTutorProviders as readonly string[]).includes(value);
}

export interface RoutingProviderArgs {
  /**
   * Backend id -> a factory for it. Only the selected factory runs.
   *
   * Keyed by TutorProviderId rather than string on purpose. That vocabulary is pinned in three
   * other places — the client that stamps the field, the unit config schema, and an enum in both
   * chatTutor rules blocks — and a router that accepted any string could register a name no
   * client is permitted to send. As a Record over the union, a missing backend and an invented
   * one are both compile errors instead of a throw on a student's turn.
   */
  providers: Record<TutorProviderId, () => TutorProvider>;
  /** Used when a conversation names no backend, as every conversation predating the field does. */
  defaultProvider: TutorProviderId;
}

export function createRoutingProvider(args: RoutingProviderArgs): TutorProvider {
  const {providers, defaultProvider} = args;

  return {
    async processTurn(parent: DocumentData, message: DocumentData): Promise<TurnResult> {
      const held = typeof parent.provider === "string" ? parent.provider : undefined;
      const requested = typeof message.provider === "string" ? message.provider : undefined;
      const name = held ?? requested ?? defaultProvider;

      // The Record above makes a missing backend a compile error, but the name arriving here came
      // off a document, so it still has to be checked against the vocabulary at runtime: a
      // retired backend recorded on an old conversation reaches this with a perfectly valid
      // string that no longer maps to anything.
      //
      // Falling back to the default would answer as the wrong backend and look like it worked.
      // Throwing becomes status:"error" with the cursor unadvanced, which is visible and
      // recoverable.
      if (!isTutorProviderId(name)) {
        throw new Error(`unknown tutor provider "${name}"`);
      }

      const result = await providers[name]().processTurn(parent, message);

      // Recorded even when it is the default, so an unset field never has to mean two things:
      // after the first turn of any conversation, the parent says which backend owns it.
      if (held) {
        return result;
      }
      return {...result, parentUpdate: {...result.parentUpdate, provider: name}};
    },
  };
}
