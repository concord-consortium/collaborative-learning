/**
 * Screen reader announcement utility.
 * Uses an aria-live region to announce messages to screen reader users.
 *
 * The live region element must exist in the DOM with id="clue-announcements".
 * See workspace.tsx for the element setup.
 */

let announceTimeout: ReturnType<typeof setTimeout> | null = null;
let announceRafId: number | null = null;

/**
 * Announce a message to screen reader users via aria-live region.
 *
 * @param message - The message to announce
 * @param priority - 'polite' (default, waits for silence) or 'assertive' (interrupts)
 *
 * Uses clear-then-set pattern to ensure SR detects changes even for repeated messages.
 * Cancels pending operations to prevent interleaving during rapid navigation.
 */
export function announce(message: string, priority: 'polite' | 'assertive' = 'polite') {
  const region = document.getElementById('clue-announcements');
  if (!region) return;

  // Cancel any pending operations to prevent interleaving when users arrow quickly
  if (announceTimeout) {
    clearTimeout(announceTimeout);
    announceTimeout = null;
  }
  if (announceRafId) {
    cancelAnimationFrame(announceRafId);
    announceRafId = null;
  }

  // Clear first, then set on next frame — ensures SR detects the change
  // even if the same message is announced twice in a row
  region.textContent = '';
  region.setAttribute('aria-live', priority);

  announceRafId = requestAnimationFrame(() => {
    announceRafId = null;
    region.textContent = message;

    // Clear after a delay to reset for next announcement
    // Use longer delay (3s) to ensure SR has time to read
    announceTimeout = setTimeout(() => {
      region.textContent = '';
      announceTimeout = null;
    }, 3000);
  });
}

/**
 * Clear any pending announcements.
 * Useful when navigating away from a context.
 */
export function clearAnnouncements() {
  if (announceTimeout) {
    clearTimeout(announceTimeout);
    announceTimeout = null;
  }
  if (announceRafId) {
    cancelAnimationFrame(announceRafId);
    announceRafId = null;
  }
  const region = document.getElementById('clue-announcements');
  if (region) {
    region.textContent = '';
  }
}
