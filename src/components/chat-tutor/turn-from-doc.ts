import { isTutorHighlight } from "../../../shared/chat-tutor-highlight";
import { ChatTurn, TutorHighlight } from "./transport";

// The server validates before writing, so this is defense in depth rather than the primary gate. It
// reads a document, though, which may have been written by an older server than the one running now.
function readHighlights(value: unknown): TutorHighlight[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const highlights = value.filter(isTutorHighlight)
    .map(h => ({ tileId: h.tileId, objectId: h.objectId, label: h.label }));
  return highlights.length > 0 ? highlights : undefined;
}

/**
 * Build the UI's turn from one message document, or undefined when the document should render
 * nothing. A `userText: null` assistant reply is silent by design: it clears the client's awaiting
 * indicator without adding a bubble, so any highlights it carried have no words to belong to.
 */
export function turnFromDoc(id: string, data: any, hasPendingWrites: boolean): ChatTurn | undefined {
  // An unresolved notice is shown by the drawer's recovery panel, so the transcript waits for it.
  if (data?.kind === "delivery" && typeof data.text === "string") {
    if (!data.resolved) return undefined;
    const suffix = data.resolution === "recovered" ? " The reply was recovered." :
      data.resolution === "continued" ? " You chose to continue." : "";
    return { id, sender: "system", text: data.text + suffix };
  }
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
