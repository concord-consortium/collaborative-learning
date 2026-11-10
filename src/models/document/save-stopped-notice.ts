import { NotExactReason } from "../history/session-exactness";

/**
 * What a group document shows over its content once the session stops being exact. A group
 * document makes no intermediate saves, so from then on this client saves no content.
 */
export interface ISaveStoppedNotice {
  // Whether the user can close the notice and keep working. One that can't also makes the
  // document read-only, since further edits could be lost or make the document fail to load.
  dismissible: boolean;
  // Whether reloading the page is likely to start saving again. A new session starts exact.
  offerReload: boolean;
  message: string;
}

const kTellTeacher = "Please tell your teacher.";

/**
 * The notice for a reason a group document's session stopped being exact, or undefined for a
 * reason that doesn't happen on a group document. `repeated` is whether a change with no history
 * entry already stopped this document's saving in this tab a short time ago, so reloading didn't
 * help.
 */
export function getSaveStoppedNotice(reason: NotExactReason, repeated = false): ISaveStoppedNotice | undefined {
  switch (reason) {
    // The entry's changes reached history, so the document looks right everywhere.
    case "timed-out-entry":
      return {
        dismissible: true, offerReload: true,
        message: "This document has stopped saving. Your work so far is kept. Reload the page to start saving again."
      };
    // The change is only on this screen, and later edits that build on it may not load.
    case "unrecorded-change":
      return repeated
        ? { dismissible: false, offerReload: false,
            message: `This document can't be saved right now. ${kTellTeacher}` }
        : { dismissible: false, offerReload: true,
            message: "This document has stopped saving. Reload the page to keep working. " +
              "Your most recent change may be lost." };
    // Every load fails on the same entry, so reloading doesn't help.
    case "initial-apply-failed":
      return {
        dismissible: false, offerReload: false,
        message: `This document couldn't be opened completely, and changes made now wouldn't be kept. ${kTellTeacher}`
      };
    // The failure may have come from this tab's own changes, which a reload clears.
    case "remote-apply-failed":
      return {
        dismissible: false, offerReload: true,
        message: "This document is out of step with your group's changes. Reload the page to keep working."
      };
    // Every load has the same saved content, so reloading doesn't help, but the work is recorded.
    case "saved-id-missing":
      return {
        dismissible: true, offerReload: false,
        message: `This document is having trouble saving. Your work is still being kept. ${kTellTeacher}`
      };
    default:
      return undefined;
  }
}

// How long after one unrecorded change another counts as a repeat that a reload didn't fix.
export const kUnrecordedChangeRepeatMs = 10 * 60 * 1000;

const storageKey = (documentKey: string) => `clue-unrecorded-change:${documentKey}`;

// The answer for each document in this page load, so asking again during a render gives the same one.
const repeatsThisPageLoad = new Map<string, boolean>();

/**
 * Records that a change with no history entry stopped this document's saving in this tab, and
 * returns whether one did within kUnrecordedChangeRepeatMs before, in an earlier page load. Asking
 * again in the same page load returns the first answer.
 */
export function isRepeatedUnrecordedChange(documentKey: string, now = Date.now()): boolean {
  const known = repeatsThisPageLoad.get(documentKey);
  if (known !== undefined) return known;
  let repeated = false;
  try {
    const previous = Number(window.sessionStorage.getItem(storageKey(documentKey)));
    repeated = previous > 0 && now - previous < kUnrecordedChangeRepeatMs;
    window.sessionStorage.setItem(storageKey(documentKey), String(now));
  } catch {
    // Without session storage every page load counts as the first.
  }
  repeatsThisPageLoad.set(documentKey, repeated);
  return repeated;
}

// Forgets this page load's answers, as a new page load would.
export function resetUnrecordedChangeRepeatsForTesting() {
  repeatsThisPageLoad.clear();
}
