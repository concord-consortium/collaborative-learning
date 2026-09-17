import { when } from "mobx";
import { DocumentModelType, SaveState } from "./document";

/** How long to wait for an in-flight save before giving up and proceeding anyway. */
export const kWaitForSaveSettledCapMs = 3000;

function isSettled(document: DocumentModelType) {
  return document.saveState !== SaveState.Saving && document.saveState !== SaveState.Retrying;
}

/**
 * Waits until `document` is no longer mid-save, so a request that reads it (an Ideas click writing
 * the evaluation timestamp) is more likely to see what the student just saved.
 *
 * Resolves immediately on `Idle` or `Saved`. Does not wait for `Saved` specifically: `SaveIndicator`
 * resets it to `Idle` a few seconds after every save, so an untouched or recently-saved document
 * would hang forever. While `Saving`/`Retrying`, waits up to `kWaitForSaveSettledCapMs`, then gives
 * up — the server's completion status is the real fallback, not this wait.
 */
export function waitForSaveSettled(document: DocumentModelType): Promise<void> {
  if (isSettled(document)) return Promise.resolve();

  return new Promise<void>(resolve => {
    let settled = false;
    // No-op default so `finish` always has something to call. `when` can invoke its effect
    // synchronously if the predicate is already true, which would otherwise call disposeWhen
    // before `when()` below has assigned it.
    let disposeWhen = () => {};

    function finish() {
      if (settled) return;
      settled = true;
      disposeWhen();
      clearTimeout(timer);
      resolve();
    }

    const timer = setTimeout(finish, kWaitForSaveSettledCapMs);
    disposeWhen = when(() => isSettled(document), finish);
  });
}
