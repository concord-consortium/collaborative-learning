import { action, makeObservable, observable } from "mobx";

// Sentinel for "before any history entry"; moveToHistoryEntryAfterLoad treats it the same way.
export const kHistoryStart = "first";

export type NotExactReason = "unrecorded-change" | "timed-out-entry" | "catch-up-apply-failed"
  | "catch-up-hole" | "catch-up-gap-too-large" | "saved-id-missing" | "initial-apply-failed"
  | "history-unavailable";

/**
 * Tracks whether a document's lastHistoryEntryId is exact for this editing session: the content
 * is described by the history from `exactSince` on, and nothing has since broken that guarantee.
 */
export class SessionExactness {
  // Undefined until the load decides where the guarantee starts.
  exactSince: string | undefined = undefined;
  notExactReason: NotExactReason | undefined = undefined;

  constructor() {
    makeObservable(this, {
      exactSince: observable,
      notExactReason: observable,
      startAt: action,
      markNotExact: action
    });
  }

  get isExact() {
    return this.exactSince !== undefined && !this.notExactReason;
  }

  // Ignored once the session is marked not exact or has already started.
  startAt(exactSince: string) {
    if (this.notExactReason || this.exactSince !== undefined) return;
    this.exactSince = exactSince;
  }

  // Keeps the first reason.
  markNotExact(reason: NotExactReason) {
    if (this.notExactReason) return;
    this.notExactReason = reason;
  }
}
