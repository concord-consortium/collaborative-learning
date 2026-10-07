import { useCallback, useEffect, useRef } from "react";

// Long enough for screen readers that poll the DOM (~100-150ms) to observe the empty state.
export const kAnnounceDelayMs = 150;

/**
 * Drives an `aria-live` region. Each announcement clears the region and sets the text after a
 * short delay, so an identical message repeated back to back is still read aloud. (`useAnnounce`
 * in src/utilities renders the message from state instead, so a repeat before it clears isn't read.)
 * Attach `announcerRef` to the live region element.
 */
export function useLiveAnnouncer() {
  const announcerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<number | null>(null);

  const announce = useCallback((text: string) => {
    if (!announcerRef.current) return;
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    announcerRef.current.textContent = "";
    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null;
      if (announcerRef.current) announcerRef.current.textContent = text;
    }, kAnnounceDelayMs);
  }, []);

  useEffect(() => () => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
  }, []);

  return { announcerRef, announce };
}
