// CLUE context assembly — replaces the source project's server-side page-fetch/convert path.
// The client writes the context payloads onto each `user` message doc (leftContext = the whole
// problem as JSON, sent while the parent's problemInstalled flag is unset; rightContext = a
// workspace markdown summary, sent when it changed); this module composes the OpenAI
// conversation items and per-turn input from them. Pure (no Firestore/OpenAI), so it is
// unit-testable directly.
import {TutorInputMessage} from "./openai";

export interface TurnContext {
  // developer-role conversation items to install, in order, before this turn's response
  installItems: string[];
  // set the parent's problemInstalled flag once the turn succeeds
  markProblemInstalled: boolean;
  // composed input for createTutorResponse (developer/RIGHT before the user message)
  input: TutorInputMessage[];
  // incremented per-conversation seq to persist when a RIGHT refresh rode this turn
  seq?: number;
}

export interface TurnMessage {
  text?: unknown;
  leftContext?: unknown;
  rightContext?: unknown;
}

// An empty LEFT ({"sections":[]}, missing, or unparseable) must not be installed: LEFT is
// installed once and flagged, so an empty install would permanently ground the tutor with no
// problem context. Leaving the flag unset keeps the recovery path open — the client re-attaches
// LEFT while the flag is unset.
export function isEmptyLeft(leftContext: unknown): boolean {
  if (typeof leftContext !== "string" || leftContext.length === 0) return true;
  try {
    const parsed = JSON.parse(leftContext);
    return !Array.isArray(parsed?.sections) || parsed.sections.length === 0;
  } catch {
    return true;
  }
}

// Latest-context-wins envelope: RIGHT summaries accumulate in the OpenAI conversation (a new
// one does not remove earlier ones), so each is wrapped to make the newest authoritative; the
// generic prompt tells the model to trust the highest seq.
export function buildRightEnvelope(markdown: string, seq: number, ts: string): string {
  return `CURRENT WORKSPACE — supersedes all earlier workspace summaries (seq=${seq}, ts=${ts})\n${markdown}`;
}

export function assembleTurnContext(args: {
  genericText: string;
  problemInstalled: boolean;
  parentSeq: number | undefined;
  message: TurnMessage;
  nowIso?: string;
}): TurnContext {
  const {genericText, problemInstalled, parentSeq, message} = args;
  const nowIso = args.nowIso ?? new Date().toISOString();

  // First-turn install sequence (re-run in full on a recovery turn — a duplicate generic item
  // is the same accepted behavior as the ported crash-mid-setup recovery): generic prompt item,
  // then the LEFT problem item, then the flag. Skipped entirely once the flag is set.
  const installItems: string[] = [];
  let markProblemInstalled = false;
  if (!problemInstalled) {
    installItems.push(genericText);
    if (!isEmptyLeft(message.leftContext)) {
      installItems.push(`THE PROBLEM (the student's assignment, as JSON):\n${message.leftContext as string}`);
      markProblemInstalled = true;
    }
  }

  const input: TutorInputMessage[] = [];
  let seq: number | undefined;
  if (typeof message.rightContext === "string" && message.rightContext.length > 0) {
    seq = (parentSeq ?? 0) + 1;
    input.push({role: "developer", content: buildRightEnvelope(message.rightContext, seq, nowIso)});
  }
  input.push({role: "user", content: String(message.text ?? "")});

  return {installItems, markProblemInstalled, input, seq};
}
