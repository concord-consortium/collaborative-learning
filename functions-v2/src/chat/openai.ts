// Thin OpenAI wrapper (Responses + Conversations API).
//
// Conversation state lives on OpenAI: a conversation object holds every turn, its id is stored on the
// per-conversation parent doc, and only the NEW message is sent as `input` each turn (no replay). The
// tutor context is installed as persistent developer-role conversation ITEMS (NOT via `instructions`,
// which is per-request and not carried across turns). Assistant replies are structured: text.format
// json_schema/strict with a nullable `userText`.
import OpenAI from "openai";
import {TutorHighlight, isTutorHighlight} from "../../../shared/chat-tutor-highlight";

export interface TutorReply {
  userText: string | null;
  highlights: TutorHighlight[];
}

// A single input message for a turn. role:"user" for a typed student message; role:"developer" for
// context refreshes (same role family as the persistent prompt items).
export interface TutorInputMessage {
  role: "user" | "developer";
  content: string;
}

// Structured-output contract: strict json_schema, userText nullable. Strict mode requires every
// property to be listed in `required` and forbids additional ones, so "nothing to point at" is an
// empty array rather than an absent field — the same way userText:null expresses a silent reply.
// Array length cannot be constrained in strict mode; restraint comes from the prompt.
export const TUTOR_REPLY_FORMAT = {
  type: "json_schema" as const,
  name: "tutor_reply",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["userText", "highlights"],
    properties: {
      userText: {type: ["string", "null"]},
      highlights: {
        type: "array",
        // The description is load-bearing: every workspace summary carries object ids, including
        // in units whose prompt says nothing about pointing at them. Without this the model sees a
        // required field asking for ids it has, and nothing telling it to leave the list alone.
        description: "Objects to offer the student a button for. Leave empty unless you are " +
          "deliberately pointing at something; never invent an id.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["tileId", "objectId", "label"],
          properties: {
            tileId: {type: "string"},
            objectId: {type: "string"},
            label: {type: "string"},
          },
        },
      },
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

// Parse the model's structured output into a TutorReply, defensively coercing a missing, non-string
// or blank userText to null and dropping any highlight entry that is not fully formed.
//
// "Nothing to say" gets one representation on the wire. The client tests `userText == null` to decide
// a reply is silent, so an empty string would slip past it and render an empty bubble.
//
// A silent reply carries no highlights either. Buttons label words the reply never said, and the
// client drops the whole turn when userText is null, so anything left in the array is data nothing
// can render.
export function parseTutorReply(outputText: string): TutorReply {
  const parsed = JSON.parse(outputText);
  const raw: unknown[] = Array.isArray(parsed?.highlights) ? parsed.highlights : [];
  const rawText = parsed?.userText;
  const userText = typeof rawText === "string" && rawText.trim() ? rawText : null;
  const highlights: TutorHighlight[] = userText === null ? [] : raw
    .filter(isTutorHighlight)
    .map((h) => ({tileId: h.tileId, objectId: h.objectId, label: h.label}));
  return {userText, highlights};
}
