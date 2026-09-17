import { when } from "mobx";
import { DocumentModelType, SaveState } from "./document";

/** How long to wait for an in-flight save before giving up and proceeding anyway. */
export const kWaitForSaveSettledCapMs = 3000;

function isSettled(document: DocumentModelType) {
  return document.saveState !== SaveState.Saving && document.saveState !== SaveState.Retrying;
}

/**
 * Waits until `document` is no longer in the middle of saving, so a request that reads the
 * document (an Ideas click writing the evaluation timestamp) is more likely to see what the
 * student just saved rather than racing an in-progress save.
 *
 * Resolves immediately when `saveState` is `Idle` or `Saved`. Waiting for `Saved` specifically
 * would hang: `SaveIndicator` resets `Saved` back to `Idle` a few seconds after every save, so an
 * ordinary click on an untouched or recently-saved document would never see it. While `Saving` or
 * `Retrying`, waits for the state to leave those values, capped at `kWaitForSaveSettledCapMs`; past
 * the cap it resolves anyway, since a mismatch this leaves behind is still caught by the server's
 * completion status, which is the primary mechanism, not this wait.
 */
export function waitForSaveSettled(document: DocumentModelType): Promise<void> {
  if (isSettled(document)) return Promise.resolve();

  return new Promise<void>(resolve => {
    let settled = false;
    // Defaults to a no-op so `finish` always has something safe to call. `when`'s effect can run
    // synchronously if its predicate is already true — impossible here today, since the guard
    // above already confirmed it is false, but this keeps a future reorder from hitting a
    // temporal-dead-zone error instead of silently relying on that invariant.
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
