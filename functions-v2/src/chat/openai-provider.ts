// The OpenAI tutor backend, behind the TutorProvider seam.
//
// This is the code that used to be the body of drain.ts's processUnit; it is unchanged in
// behavior, only relocated so the drain engine no longer names a vendor. Conversation state
// lives on OpenAI and its id is carried on the parent doc.
import {DocumentData} from "firebase-admin/firestore";

import {assembleTurnContext} from "./context-assembly";
import {createConversation, createOpenAIClient, createTutorResponse, installDeveloperPrompt} from "./openai";
import {TurnResult, TutorProvider} from "./provider";

export function createOpenAIProvider(args: {
  openai: ReturnType<typeof createOpenAIClient>;
  model: string;
  genericText: string;
}): TutorProvider {
  const {openai, model, genericText} = args;

  return {
    async processTurn(parent: DocumentData, message: DocumentData): Promise<TurnResult> {
      let conversationId: string | undefined = parent.conversationId;
      if (!conversationId) {
        // do NOT report conversationId yet — only after the install + first response succeed.
        conversationId = await createConversation(openai);
      }

      // "install once" is gated on problemInstalled (not on conversationId existing), so a crash
      // mid-setup re-writes the developer items next turn instead of running context-blind. An
      // empty LEFT leaves the flag unset (see context-assembly), keeping the recovery path open.
      const turn = assembleTurnContext({
        genericText,
        problemInstalled: !!parent.problemInstalled,
        parentSeq: parent.seq,
        message,
      });
      for (const item of turn.installItems) {
        await installDeveloperPrompt(openai, conversationId, item);
      }

      const {userText} = await createTutorResponse(openai, {model, conversationId, input: turn.input});

      // only NOW (developer items written + response succeeded) is conversationId/
      // problemInstalled/seq earned; the drain persists them batched with the cursor so they
      // commit atomically.
      const parentUpdate: Record<string, unknown> = {};
      if (!parent.conversationId) {
        parentUpdate.conversationId = conversationId;
      }
      if (turn.markProblemInstalled) {
        parentUpdate.problemInstalled = true;
      }
      if (turn.seq !== undefined) {
        parentUpdate.seq = turn.seq;
      }

      return {assistantText: userText, parentUpdate};
    },
  };
}
