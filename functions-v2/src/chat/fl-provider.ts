// The ForeverLearning tutor backend, behind the TutorProvider seam.
//
// Conversation state lives on FL, keyed by a session id it returns, and the drain persists that id
// only once this returns — so a turn that fails part-way leaves nothing recorded, exactly as the
// OpenAI path earns its conversation id.
//
// Where the student's document comes from is deliberately injected. The server cannot currently
// reach it: message.rightContext is a markdown summary rather than content, and the RTDB path
// needs a documentKey the message does not carry. Whatever closes that gap — a new whitelisted
// message field, or a projection the client builds — lands in readDocument and nowhere else.
import {DocumentData} from "firebase-admin/firestore";

import {DocumentContentSnapshotType} from "../../../shared/ai-summarizer/ai-summarizer-types";
import {buildEnvelope, ProtectionPolicy} from "../../../shared/fl-packet/envelope";
import {buildContextPacket, ContextPacket} from "../../../shared/fl-packet/packet";
import {parseResponsePacket, replyText, responseHighlights} from "../../../shared/fl-packet/response";
import {flChat, FlClientConfig} from "./fl-client";
import {TurnResult, TutorProvider} from "./provider";

/** A document to describe, and the two things the packet must say about it. */
export interface FlDocument {
  content: DocumentContentSnapshotType;
  documentId: string;
  revision: string;
  /**
   * The serialized form, kept on the parent so a later turn can reuse it.
   *
   * The client resends the document only when it changed, but every FL turn needs one: its
   * context is a per-request field, not conversation state that accumulates the way OpenAI's
   * conversation items do. A message doc and a parent doc share the same 1MB ceiling, so a
   * document that fits on the message that carried it fits here too.
   */
  raw?: string;
}

export interface FlProviderArgs {
  config: FlClientConfig;
  catalogCommit: string;
  protection: ProtectionPolicy;
  readDocument(parent: DocumentData, message: DocumentData): Promise<FlDocument | undefined>;
  /** Injected in tests; the real one is a uuid per conversation. */
  newTraceId?: () => string;
  /** Injected in tests. */
  chat?: typeof flChat;
}

export function createFlProvider(args: FlProviderArgs): TutorProvider {
  const {config, catalogCommit, protection, readDocument} = args;
  const chat = args.chat ?? flChat;
  const newTraceId = args.newTraceId ?? (() => crypto.randomUUID());

  return {
    async processTurn(parent: DocumentData, message: DocumentData): Promise<TurnResult> {
      // trace_id identifies the conversation, request_id the turn within it, so a reader can put
      // one turn's packet beside the reply it produced.
      const traceId: string = parent.flTraceId ?? newTraceId();
      const turn: number = (parent.flTurn ?? 0) + 1;
      const envelope = {
        traceId, requestId: `${traceId}-t${turn}`, turn, protection, catalogCommit,
      };

      const document = await readDocument(parent, message);
      let context: ContextPacket;
      if (document) {
        context = buildContextPacket({
          content: document.content,
          documentId: document.documentId,
          revision: document.revision,
          envelope,
        }).packet;
      } else {
        // The envelope is the only section a packet cannot omit. A turn with no document to
        // describe is still a turn, and an envelope-only packet says "no workspace" rather than
        // inventing an empty one.
        context = {schema_version: "clue.context_packet.v2", envelope: buildEnvelope(envelope)};
      }

      const stream = await chat(config, {
        userId: String(message.uid ?? ""),
        prompt: String(message.text ?? ""),
        context,
        sessionId: parent.flSessionId,
      });

      // The prose part and the packet are separate parts of one stream and either can arrive
      // without the other. Losing the directives is not a reason to lose the reply.
      const response = parseResponsePacket(stream.display);
      const assistantText = replyText(stream, response);
      if (!assistantText) {
        // A turn that produced nothing is a failed turn. The drain's catch turns this into
        // status:"error", which clears the client's indicator honestly rather than writing an
        // empty assistant message the client renders as a finished answer.
        throw new Error("ForeverLearning returned no reply for this turn");
      }
      const highlights = response ? responseHighlights(response, context) : [];

      // Only now is any of this earned. status/lockedAt/error belong to the drain and a provider
      // that writes them corrupts the lock, so nothing here goes near them.
      const parentUpdate: Record<string, unknown> = {flTurn: turn};
      if (!parent.flTraceId) {
        parentUpdate.flTraceId = traceId;
      }
      if (stream.sessionId && stream.sessionId !== parent.flSessionId) {
        parentUpdate.flSessionId = stream.sessionId;
      }
      // Only when it moved. Rewriting an unchanged document would put the whole workspace back on
      // the parent every turn for a value that did not change.
      if (document?.raw && document.raw !== parent.flContent) {
        parentUpdate.flContent = document.raw;
      }

      return {
        assistantText,
        // Optional, not an empty array: a backend with nothing to point at says nothing, and the
        // client reads an omitted field the same as an empty one.
        ...(highlights.length ? {highlights} : {}),
        parentUpdate,
      };
    },
  };
}
