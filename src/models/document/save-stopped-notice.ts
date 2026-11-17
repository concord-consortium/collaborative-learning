import { NotExactReason } from "../history/session-exactness";

/**
 * What a concurrent document shows over its content once the session stops being exact. A
 * concurrent document makes no intermediate saves, so from then on this client saves no content.
 */
export interface ISaveStoppedNotice {
  // Whether the user can close the notice and keep working. One that can't also makes the
  // document read-only, since further edits could be lost or make the document fail to load.
  dismissible: boolean;
  // Whether reloading the page is likely to start saving again. A new session starts exact.
  offerReload: boolean;
  title: string;
  message: string;
}

const kTellTeacher = "Please tell your teacher.";
const kSavingStopped = "Saving stopped";

/**
 * The notice for a reason a concurrent document's session stopped being exact, or undefined for a
 * reason that doesn't happen on a concurrent document. `repeated` is whether a change with no
 * history entry already stopped this document's saving in this tab a short time ago, so reloading
 * didn't help.
 */
export function getSaveStoppedNotice(reason: NotExactReason, repeated = false): ISaveStoppedNotice | undefined {
  switch (reason) {
    // The entry's changes reached history, but a part that arrived late is saved as an entry of its
    // own, which can fail to apply. Later changes still reach history, so loads include them.
    case "timed-out-entry":
      return {
        dismissible: true, offerReload: true, title: "Saving problem",
        message: "One of your changes took too long to save, so it may not have been saved correctly. " +
          "Changes you make from now on should still be saved. We recommend reloading the page to check."
      };
    // The change is only on this screen, and later edits that build on it may not load.
    case "unrecorded-change":
      return repeated
        ? { dismissible: false, offerReload: false, title: kSavingStopped,
            message: `This document has stopped saving again. Reloading is unlikely to help. ${kTellTeacher}` }
        : { dismissible: false, offerReload: true, title: kSavingStopped,
            message: "This document has stopped saving. Reload the page to keep working. " +
              "Your most recent change may be lost." };
    // Every load from the same saved content fails on the same entry, so reloading helps only once
    // another member, who applied the entry when it was made, has saved past it.
    case "initial-apply-failed":
      return {
        dismissible: false, offerReload: false, title: kSavingStopped,
        message: "This document couldn't be opened completely, so edits won't be saved. " +
          `Reloading is unlikely to help. ${kTellTeacher}`
      };
    // The failure may have come from this tab's own changes, which a reload clears.
    case "remote-apply-failed":
      return {
        dismissible: false, offerReload: true, title: kSavingStopped,
        message: "This document is out of step with other people's changes. Reload the page to keep working."
      };
    // Every load has the same saved content, so reloading doesn't help. Changes still reach history,
    // but no session that loads the document saves its content again, so each load replays more
    // history, and an entry in it that fails to apply would lose the work after it.
    case "saved-id-missing":
      return {
        dismissible: true, offerReload: false, title: "Saving problem",
        message: "Your changes are still being saved, but this document has a problem that needs to be fixed. " +
          "Until it is, the document may get slower to open, and your recent work could be lost. " +
          `Reloading won't fix it. ${kTellTeacher}`
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
