// Where the focus trap enters the tile's contents, and where focus goes when the control it was on
// disappears: Prev, Next, the Full Timeline's scrollbar thumb and the Event Key's checkboxes, less
// any that are disabled.
// A placed marker's stem and delete button are tabbable too, but deliberately not listed: this is
// where focus lands when the marker itself is deleted, so it has to name controls that outlive it.
// Trap entry therefore goes to the first of these rather than to the marker, even when the marker
// comes first in the tile.
const kContentControls =
  ".event-row .timeline-button:not(:disabled), .dynamic-scrollbar-thumb:not([aria-disabled]), " +
  ".timeline-key input[type=\"checkbox\"]:not(:disabled)";

export function getContentControls(container: HTMLElement | null) {
  return container ? Array.from(container.querySelectorAll<HTMLElement>(kContentControls)) : [];
}

/** Keeps focus inside the tile when the control it was on is about to be removed. */
export function focusFirstContentControl(from: HTMLElement | null) {
  getContentControls(from?.closest<HTMLElement>(".timeline-container") ?? null)[0]?.focus();
}
