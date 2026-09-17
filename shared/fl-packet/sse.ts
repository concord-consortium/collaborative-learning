// Reading ForeverLearning's streamed reply.
//
// The transport is Server-Sent Events over plain HTTPS — not WebSockets, despite what a reader
// primed on chat APIs might assume. Every event is one `data:` line holding one JSON object, and
// the object's `type` says what it is.
//
// Two content streams are interleaved on one connection, told apart by `part`:
//
//   conversation — the prose reply, token by token
//   display      — a clue.response_packet.v2, streamed as JSON text the same way
//
// They are NOT two encodings of one reply, and assuming so costs the student the most important
// part of it. Across eleven captured streams the two agree nine times; in the other two the prose
// is the fuller form, folding in the packet's one_next_action and a closing question — and in one
// of those it rewrites the tail of student.message rather than appending to it.
//
// So each part is authoritative for something different. The prose is the reply to show the
// student: it is what the diagnostic composed for them to read, and one_next_action is the
// productive-struggle invariant the whole packet is built around. The packet is authoritative for
// the directives, which appear nowhere else. Taking student.message as the reply would silently
// drop the next action; taking the prose as the whole answer would silently drop the highlights.

export interface SseEvent {
  type: string;
  [key: string]: unknown;
}

function parseBlock(block: string): SseEvent | undefined {
  // A block may carry `event:`, `id:`, `retry:` and comment lines beginning `:`. FL sends none of
  // them today; ignoring rather than choking on them is what makes this a reader of the protocol
  // rather than of one server's current habits.
  const data = block.split("\n")
    .filter(line => line.startsWith("data:"))
    .map(line => line.slice(5).trimStart())
    .join("\n");
  if (!data) return undefined;
  try {
    const parsed = JSON.parse(data);
    return parsed && typeof parsed === "object" && typeof parsed.type === "string"
      ? parsed as SseEvent : undefined;
  } catch {
    // One malformed event is not worth abandoning the stream over. If it was carrying something
    // that mattered, the display JSON will fail to parse and say so there.
    return undefined;
  }
}

/**
 * A chunk-boundary-tolerant SSE reader.
 *
 * A network read does not arrive in event-sized pieces, so an event split across two reads has to
 * be reassembled rather than dropped — with the response packet streaming as ~2,500 fragments of a
 * single JSON document, one dropped fragment is a packet that will not parse.
 */
export class SseParser {
  private buffer = "";

  /** Feeds one chunk and returns whatever complete events it completed. */
  push(chunk: string): SseEvent[] {
    // Raw first, normalize after. Normalizing each chunk on the way in cannot see a CR and its LF
    // when they land in different reads: the pair stays unmatched at the seam, the blank line
    // between two events disappears, and both are merged into one unparseable block — losing two
    // events from a stream that was perfectly well formed.
    //
    // A trailing CR is then held back unnormalized, because its LF may still be in the next chunk.
    // Without that, the same split is simply moved one character later.
    this.buffer += chunk;
    const heldCr = this.buffer.endsWith("\r");
    const scan = heldCr ? this.buffer.slice(0, -1) : this.buffer;
    const blocks = scan.replace(/\r\n/g, "\n").split("\n\n");
    // The last block is either empty (the buffer ended on a separator) or a partial event. Either
    // way it stays buffered until more arrives, with the held-back CR restored on the end.
    this.buffer = (blocks.pop() ?? "") + (heldCr ? "\r" : "");
    const events: SseEvent[] = [];
    for (const block of blocks) {
      const event = parseBlock(block);
      if (event) events.push(event);
    }
    return events;
  }

  /**
   * Flushes a trailing event that arrived without its separator.
   *
   * A well-formed stream ends on a blank line, so this is normally empty. It exists because the
   * alternative is silently discarding the last event of a stream that ended a byte early, and
   * that event is `done`.
   */
  end(): SseEvent[] {
    const block = this.buffer;
    this.buffer = "";
    const event = block.trim() ? parseBlock(block) : undefined;
    return event ? [event] : [];
  }
}

export interface CollectedStream {
  /** The prose reply, reassembled. */
  conversation: string;
  /** The response packet's JSON text, reassembled but not parsed. */
  display: string;
  sessionId?: string;
  displayName?: string;
  stopReason?: string;
  /**
   * What FL says about retrieving its own configured content, passed through unjudged.
   *
   * "ok" does not mean our context was ingested — it means nothing failed, and it comes back that
   * way with no retrieval configured at all. The captures show "no_content" for concordclue,
   * which is the honest reading: there is no ingested corpus behind that solution.
   */
  retrievalStatus?: string;
  /** True once `done` has been seen. A stream that ends without it was cut short. */
  complete: boolean;
  /** True once `display_complete` has been seen. */
  displayComplete: boolean;
}

export function emptyStream(): CollectedStream {
  return { conversation: "", display: "", complete: false, displayComplete: false };
}

/** Folds one event into the accumulating stream state. Unknown types are ignored by design. */
export function collectEvent(into: CollectedStream, event: SseEvent): CollectedStream {
  switch (event.type) {
    case "content": {
      const text = typeof event.text === "string" ? event.text : "";
      if (event.part === "conversation") into.conversation += text;
      else if (event.part === "display") into.display += text;
      break;
    }
    case "metadata":
      if (typeof event.sessionId === "string") into.sessionId = event.sessionId;
      if (typeof event.displayName === "string") into.displayName = event.displayName;
      break;
    case "retrieval_status":
      if (typeof event.status === "string") into.retrievalStatus = event.status;
      break;
    case "display_complete":
      into.displayComplete = true;
      break;
    case "done":
      into.complete = true;
      if (typeof event.sessionId === "string") into.sessionId = event.sessionId;
      if (typeof event.stopReason === "string") into.stopReason = event.stopReason;
      break;
    default:
      break;
  }
  return into;
}

/** Convenience for a stream already in hand: parse and collect the whole text at once. */
export function collectSseText(text: string): CollectedStream {
  const parser = new SseParser();
  const state = emptyStream();
  for (const event of [...parser.push(text), ...parser.end()]) collectEvent(state, event);
  return state;
}
