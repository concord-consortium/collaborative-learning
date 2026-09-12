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

import {TurnResult, TutorProvider} from "./provider";

export interface RoutingProviderArgs {
  /** Backend name -> a factory for it. Only the selected factory runs. */
  providers: Record<string, () => TutorProvider>;
  /** Used when a conversation names no backend, as every conversation predating the field does. */
  defaultProvider: string;
}

export function createRoutingProvider(args: RoutingProviderArgs): TutorProvider {
  const {providers, defaultProvider} = args;

  return {
    async processTurn(parent: DocumentData, message: DocumentData): Promise<TurnResult> {
      const held = typeof parent.provider === "string" ? parent.provider : undefined;
      const requested = typeof message.provider === "string" ? message.provider : undefined;
      const name = held ?? requested ?? defaultProvider;

      const build = providers[name];
      if (!build) {
        // A name we have no backend for is a routing bug, a retired backend still recorded on an
        // old conversation, or a client sending something we never shipped. Falling back to the
        // default would answer as the wrong backend and look like it worked; throwing becomes
        // status:"error", which is visible and leaves the cursor unadvanced.
        throw new Error(`unknown tutor provider "${name}"`);
      }

      const result = await build().processTurn(parent, message);

      // Recorded even when it is the default, so an unset field never has to mean two things:
      // after the first turn of any conversation, the parent says which backend owns it.
      if (held) {
        return result;
      }
      return {...result, parentUpdate: {...result.parentUpdate, provider: name}};
    },
  };
}
