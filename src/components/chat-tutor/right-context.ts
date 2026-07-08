import { documentSummarizer } from "../../../shared/ai-summarizer/ai-summarizer";

export interface RightSummary {
  markdown: string;
  hash: string;
}

// djb2 — a cheap non-cryptographic hash, sufficient to detect summary changes.
export function hashString(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    // eslint-disable-next-line no-bitwise
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  // eslint-disable-next-line no-bitwise
  return (hash >>> 0).toString(36);
}

// Summarizes the workspace document as compact markdown. The caller must ensure
// content is defined — documentSummarizer(undefined) throws.
export function summarizeRight(content: unknown): RightSummary {
  const markdown = documentSummarizer(content, {});
  return { markdown, hash: hashString(markdown) };
}

export interface DecideContextArgs {
  // The parent conversation doc's problemInstalled flag; a not-yet-created parent
  // reads as false, so the first send attaches LEFT. Flag-driven (not "is this the
  // first message?") so a send whose server-side install failed or never ran is
  // re-attached on a later turn; a double-attach under race is harmless because
  // the server checks the flag per turn before installing.
  leftAlreadyInstalled: boolean;
  currentRightHash: string;
  lastSentRightHash: string | undefined;
}

export interface ContextDecision {
  attachLeft: boolean;
  attachRight: boolean;
}

// Pure decision of which context payloads to attach to a user message.
export function decideContext(args: DecideContextArgs): ContextDecision {
  return {
    attachLeft: !args.leftAlreadyInstalled,
    // First send: lastSentRightHash is undefined → attaches.
    attachRight: args.currentRightHash !== args.lastSentRightHash
  };
}
