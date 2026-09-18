import { getSnapshot, IAnyStateTreeNode } from "mobx-state-tree";
import { documentSummarizer } from "../../../shared/ai-summarizer/ai-summarizer";
import { hashString } from "../../../shared/hash-string";

export interface RightSummary {
  markdown: string;
  hash: string;
}


// Summarizes the workspace document as compact markdown. The caller must ensure
// content is defined — documentSummarizer(undefined) throws.
export function summarizeRight(content: unknown): RightSummary {
  const markdown = documentSummarizer(content, {});
  return { markdown, hash: hashString(markdown) };
}

export interface RightContent {
  json: string;
  hash: string;
}

// The document itself, for a backend that projects it server-side rather than reading a summary.
//
// A snapshot rather than the live node: it is what normalize() reads on the other side, and it is
// the only form that survives the trip. There is no dirty-tracking around this the way there is
// around summarizeRight — serializing is cheap, and the cache exists for the summarizer's cost.
export function serializeRight(content: unknown): RightContent {
  const json = JSON.stringify(getSnapshot(content as IAnyStateTreeNode));
  return { json, hash: hashString(json) };
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
