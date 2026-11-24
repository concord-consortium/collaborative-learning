// The HTTP client for ForeverLearning's chat endpoint.
//
// One POST, one streamed reply. The transport is SSE over plain HTTPS — not WebSockets — so there
// is no connection to hold open between turns and nothing to reconnect: a turn is a request.
//
// Conversation state lives on FL, keyed by the session id it returns and by X-User-Id. The user id
// is CLUE's own, not a pseudonym, which is what lets FL's cross-session memory span everything a
// student does rather than restarting at each problem. It is an opaque platform id and it travels
// as a header, so the packet's own privacy claims are unaffected by it.
import {CollectedStream, collectEvent, emptyStream, SseParser} from "../../../shared/fl-packet/sse";
import {ContextPacket} from "../../../shared/fl-packet/packet";
import {FlDeliveryError, flResponseFailure} from "./fl-delivery-error";

export interface FlClientConfig {
  baseUrl: string;
  apiKey: string;
  solutionId: string;
  /** Injected for tests; defaults to the runtime's own fetch. */
  fetchImpl?: typeof fetch;
}

export interface FlChatArgs {
  /** CLUE's user id, passed straight through as FL's X-User-Id. */
  userId: string;
  prompt: string;
  context: ContextPacket;
  /** Present only when continuing a session FL has already opened. */
  sessionId?: string;
  /** Exact body durably reserved by the provider before dispatch. Never includes credentials. */
  serializedBody?: string;
}

export function serializeFlChatBody(args: FlChatArgs): string {
  const body: Record<string, unknown> = {prompt: args.prompt, context: args.context};
  // Absent rather than null: the field is what tells FL to continue an existing session, and
  // sending an empty one is a different statement from not sending it.
  if (args.sessionId) {
    body.session_id = args.sessionId;
  }
  return JSON.stringify(body);
}

export async function flChat(
  config: FlClientConfig, args: FlChatArgs
): Promise<CollectedStream> {
  const fetchImpl = config.fetchImpl ?? fetch;
  const currentBody = serializeFlChatBody(args);
  if (args.serializedBody !== undefined && args.serializedBody !== currentBody) {
    throw new Error("ForeverLearning reserved request differs from its arguments; refusing dispatch");
  }
  const requestId = args.context.envelope.trace.request_id;

  let response: Response;
  try {
    response = await fetchImpl(`${config.baseUrl}/v1/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
        "Authorization": `Bearer ${config.apiKey}`,
        "X-Solution-Id": config.solutionId,
        "X-User-Id": args.userId,
        ...(requestId ? {"Idempotency-Key": requestId} : {}),
      },
      body: args.serializedBody ?? currentBody,
    });
  } catch {
    throw new FlDeliveryError("unknown", "FL_TRANSPORT_UNCONFIRMED");
  }

  if (!response.ok) {
    let code: string | undefined;
    try {
      const raw = await response.text();
      if (raw.length <= 65536) {
        const events = new SseParser().push(raw + "\n\n");
        const event = events.find((e) => e.type === "error");
        if (typeof event?.code === "string") code = event.code;
        if (!code) {
          const json = JSON.parse(raw);
          code = typeof json.code === "string" ? json.code :
            typeof json.error?.code === "string" ? json.error.code : undefined;
        }
      }
    } catch {/* Missing/unreadable error detail never proves a terminal failure. */}
    throw flResponseFailure(response.status, code);
  }
  if (!response.body) {
    throw new FlDeliveryError("unknown", "ForeverLearning chat response carried no body");
  }

  const parser = new SseParser();
  const stream = emptyStream();
  const decoder = new TextDecoder();
  // Node's fetch body is an async iterable of byte chunks whose boundaries have nothing to do with
  // event boundaries; SseParser buffers across them. `stream: true` on decode matters for the same
  // reason one level down — a chunk can split a multi-byte character.
  try {
    for await (const chunk of response.body as AsyncIterable<Uint8Array>) {
      for (const event of parser.push(decoder.decode(chunk, {stream: true}))) {
        collectEvent(stream, event);
      }
    }
  } catch {
    throw new FlDeliveryError("unknown", "FL_STREAM_UNCONFIRMED");
  }
  for (const event of parser.end()) {
    collectEvent(stream, event);
  }
  if (stream.errorCode) throw new FlDeliveryError("unknown", stream.errorCode);
  return stream;
}
