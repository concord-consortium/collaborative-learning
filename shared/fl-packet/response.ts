// Reading a clue.response_packet.v2 and turning what it asks for into something CLUE can render.
//
// The packet arrives on the SSE `display` part. Its prose is duplicated on the `conversation`
// part, but the directives are here and nowhere else, so this is the copy that matters.
//
// The gap this module exists to close: a highlight directive carries no label. op_highlight is
// additionalProperties:false with no field for one — the diagnostic names a node by id and says
// nothing about what to call it. CLUE renders a highlight as a button, isTutorHighlight rejects an
// empty label, and a button with no words on it is worse than no button.
//
// So the label comes from our side, out of the context packet we sent: the node's
// orderedDisplayName, which is the name the student sees on it. That has a second effect worth
// more than the first. Resolving against what we sent means an id we cannot match is dropped
// rather than rendered — a tile that has since gone, or a node the diagnostic invented, produces
// no button instead of a dead one. Ids fail closed here by construction.

import { isTutorHighlight, TutorHighlight } from "../chat-tutor-highlight";
import { ContextPacket } from "./packet";
import { CollectedStream } from "./sse";

export interface ResponseStudent {
  surface: "student";
  message: string;
  one_next_action?: string;
  support_level?: string;
}

export interface ResponseTarget {
  kind: string;
  tile_id?: string;
  id?: string;
  from?: string;
  to?: string;
}

export interface ResponseDirective {
  directive_id: string;
  tier: string;
  op: string;
  basis_revision?: string;
  target?: ResponseTarget;
}

export interface ResponseComponent {
  component_ref?: { tile_id: string; type: string };
  display_text?: string;
  directives?: ResponseDirective[];
  evidence_refs?: string[];
}

export interface ResponsePacket {
  schema_version: string;
  diagnostic_status?: string;
  student: ResponseStudent;
  teacher?: Record<string, unknown>;
  skill_assessments?: unknown[];
  components?: ResponseComponent[];
  evidence_used?: unknown[];
  answer_protection?: Record<string, unknown>;
  do_not_disclose?: string[];
}

/**
 * Parses the display part into a response packet, or undefined if it is not one.
 *
 * Undefined rather than a throw, and undefined rather than a partial packet: the display stream
 * can be cut off mid-JSON, and a half-packet must not read as a reply. A packet with nothing to
 * say to the student is refused for the same reason — treating it as a turn would write an empty
 * message the client renders as a finished answer.
 */
export function parseResponsePacket(json: string): ResponsePacket | undefined {
  if (!json.trim()) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return undefined;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
  const packet = parsed as Partial<ResponsePacket>;
  if (typeof packet.schema_version !== "string") return undefined;
  const message = packet.student?.message;
  if (typeof message !== "string" || !message.length) return undefined;
  return packet as ResponsePacket;
}

/**
 * The text to show the student.
 *
 * The prose part, not the packet's student.message. They are not two encodings of one reply:
 * across the captured streams they agree most of the time, and where they differ the prose is the
 * fuller form, folding in one_next_action — the single observable next step the packet is built
 * around — and in one case rewriting the tail of student.message rather than appending to it.
 * Preferring student.message would drop the next action without a trace.
 *
 * student.message is the fallback for a stream whose prose part never arrived, where a partial
 * answer beats an empty one.
 */
export function replyText(
  stream: CollectedStream, packet: ResponsePacket | undefined
): string | undefined {
  if (stream.conversation.trim()) return stream.conversation;
  return packet?.student.message || undefined;
}

// The ops we declared in client_capabilities.directive_tiers, and only those. `observe` covers
// both: highlight and focus each mean "look at this", and CLUE has one way to say that. Anything
// that would change the student's document is outside what we declared and is not ours to act on
// even if it arrives.
const kRenderableOps = new Set(["highlight", "focus"]);

/** Index of tile id -> node id -> the name we sent for that node. */
function nodeNamesOf(sent: ContextPacket): Map<string, Map<string, string>> {
  const byTile = new Map<string, Map<string, string>>();
  for (const tile of sent.workspace_state?.tiles ?? []) {
    const nodes = (tile.content as { nodes?: unknown }).nodes;
    if (!Array.isArray(nodes)) continue;
    const names = new Map<string, string>();
    for (const node of nodes) {
      const { id, orderedDisplayName } = (node ?? {}) as
        { id?: unknown; orderedDisplayName?: unknown };
      if (typeof id === "string" && id &&
          typeof orderedDisplayName === "string" && orderedDisplayName) {
        names.set(id, orderedDisplayName);
      }
    }
    byTile.set(tile.tile_id, names);
  }
  return byTile;
}

/**
 * The highlights a reply asks for, resolved against the packet we sent.
 *
 * Only node targets survive. A wire is the relationship between two objects rather than an object
 * with an id, and a whole-tile target has no object to point at — CLUE's highlights address
 * discrete things, and neither is one.
 */
export function responseHighlights(
  packet: ResponsePacket, sent: ContextPacket
): TutorHighlight[] {
  const names = nodeNamesOf(sent);
  const highlights: TutorHighlight[] = [];
  const seen = new Set<string>();
  for (const component of packet.components ?? []) {
    for (const directive of component.directives ?? []) {
      if (!kRenderableOps.has(directive.op)) continue;
      const target = directive.target;
      if (target?.kind !== "node") continue;
      const { tile_id: tileId, id: objectId } = target;
      if (!tileId || !objectId) continue;
      const label = names.get(tileId)?.get(objectId);
      // No label means we never sent that node, so there is nothing to point at.
      if (!label) continue;
      const key = `${tileId}/${objectId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const highlight = { tileId, objectId, label };
      // Both sides of the wire apply this check; applying it here too means a highlight we build
      // wrong is dropped at the point it was built rather than silently ignored by the client.
      if (isTutorHighlight(highlight)) highlights.push(highlight);
    }
  }
  return highlights;
}
