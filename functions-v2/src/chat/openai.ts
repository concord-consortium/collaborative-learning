// Thin OpenAI wrapper (Responses + Conversations API).
//
// Conversation state lives on OpenAI: a conversation object holds every turn, its id is stored on the
// per-conversation parent doc, and only the NEW message is sent as `input` each turn (no replay). The
// tutor context is installed as persistent developer-role conversation ITEMS (NOT via `instructions`,
// which is per-request and not carried across turns). Assistant replies are structured: text.format
// json_schema/strict with a nullable `userText`.
import OpenAI from "openai";

export interface TutorReply {
  userText: string | null;
}

// A single input message for a turn. role:"user" for a typed student message; role:"developer" for
// context refreshes (same role family as the persistent prompt items).
export interface TutorInputMessage {
  role: "user" | "developer";
  content: string;
}

// Structured-output contract: strict json_schema, userText nullable. Strict mode guarantees the SHAPE;
// whether the model chooses userText:null is driven by the generic prompt.
export const TUTOR_REPLY_FORMAT = {
  type: "json_schema" as const,
  name: "tutor_reply",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["userText"],
    properties: {
      userText: {type: ["string", "null"]},
    },
  },
};

export function createOpenAIClient(apiKey: string): OpenAI {
  return new OpenAI({apiKey});
}

// Create a fresh conversation object and return its id (conv_…). The caller persists it on the parent
// doc only AFTER the first response succeeds.
export async function createConversation(openai: OpenAI): Promise<string> {
  const conv = await openai.conversations.create();
  return conv.id;
}

// Install a prompt once as a persistent developer-role conversation item. It auto-carries-forward to
// every later turn, so subsequent turns send only the new message(s).
export async function installDeveloperPrompt(
  openai: OpenAI, conversationId: string, prompt: string
): Promise<void> {
  await openai.conversations.items.create(conversationId, {
    items: [{type: "message", role: "developer", content: prompt}],
  });
}

// Send the new message(s) for a turn and read the structured reply. The accessor is
// res.output_text (confirmed for text.format json_schema/strict on openai v6.45).
export async function createTutorResponse(
  openai: OpenAI,
  params: { model: string; conversationId: string; input: TutorInputMessage[] }
): Promise<TutorReply> {
  const res = await openai.responses.create({
    model: params.model,
    conversation: params.conversationId,
    store: true,
    input: params.input,
    text: {format: TUTOR_REPLY_FORMAT},
  });
  return parseTutorReply(res.output_text);
}

// Parse the model's structured output text into a TutorReply, defensively coercing a missing/non-string
// userText to null (renders as nothing).
export function parseTutorReply(outputText: string): TutorReply {
  const parsed = JSON.parse(outputText);
  return {userText: typeof parsed?.userText === "string" ? parsed.userText : null};
}
