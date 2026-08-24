import { ChatTurn, TutorHighlight } from "./transport";

// The server validates highlights before writing them, so this is defence in depth rather than the
// primary gate — but a button that cannot resolve is worse than no button, so a half-formed entry
// is dropped here too. The test is the same one the server applies (isTutorHighlight in
// functions-v2/src/chat/openai.ts), non-empty included: an empty id resolves to nothing and an
// empty label renders a button with no words on it.
const isNonEmptyString = (value: unknown): value is string => typeof value === "string" && !!value;

function readHighlights(value: unknown): TutorHighlight[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const highlights = value.filter((h: any) =>
    isNonEmptyString(h?.tileId) && isNonEmptyString(h?.objectId) && isNonEmptyString(h?.label)
  ).map((h: any) => ({ tileId: h.tileId, objectId: h.objectId, label: h.label }));
  return highlights.length > 0 ? highlights : undefined;
}

/**
 * Build the UI's turn from one message document, or undefined when the document should render
 * nothing. A `userText: null` assistant reply is silent by design: it clears the client's awaiting
 * indicator without adding a bubble, so any highlights it carried have no words to belong to.
 */
export function turnFromDoc(id: string, data: any, hasPendingWrites: boolean): ChatTurn | undefined {
  if (data?.kind === "user") {
    return { id, sender: "user", text: data.text ?? "", pending: hasPendingWrites };
  }
  if (data?.kind === "assistant") {
    if (data.userText == null) return undefined;
    const highlights = readHighlights(data.highlights);
    const turn: ChatTurn = { id, sender: "assistant", text: data.userText };
    if (highlights) turn.highlights = highlights;
    return turn;
  }
  return undefined;
}
