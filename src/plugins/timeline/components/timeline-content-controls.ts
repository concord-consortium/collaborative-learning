// Where the focus trap enters the tile's contents, and where focus goes when the control it was on
// disappears: Prev, Next and the Full Timeline's scrollbar thumb, less any that are disabled. A
// placed time marker is tabbable too, but it is never the first or last of these, so it isn't here.
const kContentControls =
  ".event-row .timeline-button:not(:disabled), .dynamic-scrollbar-thumb:not([aria-disabled])";

export function getContentControls(container: HTMLElement | null) {
  return container ? Array.from(container.querySelectorAll<HTMLElement>(kContentControls)) : [];
}

/** Keeps focus inside the tile when the control it was on is about to be removed. */
export function focusFirstContentControl(from: HTMLElement | null) {
  getContentControls(from?.closest<HTMLElement>(".timeline-container") ?? null)[0]?.focus();
}
