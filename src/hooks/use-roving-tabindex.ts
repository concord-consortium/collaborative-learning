import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

/**
 * Manages roving tabindex for toolbar keyboard navigation.
 * - Only one button has tabIndex=0 at a time (the roving target)
 * - All other buttons have tabIndex=-1
 * - Arrow keys on the toolbar's primary axis move focus between buttons; the
 *   off-axis arrows are intentionally ignored so they don't conflict with the
 *   declared `aria-orientation` (vertical toolbars only respond to Up/Down,
 *   horizontal to Left/Right).
 * - Home/End move to first/last button (regardless of orientation).
 * - Does not wrap around
 * - The cycle includes every <button> descendant without filtering on disabled
 *   state, so SR users can still discover and announce a "disabled-looking"
 *   button. For that to actually deliver focus, those buttons must use
 *   `aria-disabled` rather than the HTML `disabled` attribute.
 *
 * The hook queries buttons from the DOM at navigation time so it stays correct
 * when buttons dynamically change or when the toolbar configuration varies.
 */
export function useRovingTabindex(
  containerRef: React.RefObject<HTMLElement | null>,
  orientation: "horizontal" | "vertical"
) {
  const currentIndexRef = useRef(0);

  const getButtons = useCallback((): HTMLElement[] => {
    if (!containerRef.current) return [];
    return Array.from(containerRef.current.querySelectorAll("button"));
  }, [containerRef]);

  // Set tabindex attributes after every render to handle dynamic button changes
  // (e.g., buttons added/removed, or button DOM elements replaced by React).
  // Runs on every render (no dependency array) — this is intentional and cheap
  // since it only sets attributes on a small number of buttons.
  useLayoutEffect(() => {
    const buttons = getButtons();
    if (buttons.length === 0) return;

    // Clamp index in case buttons were added or removed.
    currentIndexRef.current = Math.min(currentIndexRef.current, buttons.length - 1);

    buttons.forEach((button, i) => {
      button.setAttribute("tabindex", i === currentIndexRef.current ? "0" : "-1");
    });
  });

  // When a button receives focus via mouse click, update the roving target.
  // Queries fresh buttons to avoid stale closure if DOM changed since effect ran.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      const freshButtons = getButtons();
      const index = freshButtons.indexOf(target);
      if (index !== -1 && index !== currentIndexRef.current) {
        freshButtons[currentIndexRef.current]?.setAttribute("tabindex", "-1");
        target.setAttribute("tabindex", "0");
        currentIndexRef.current = index;
      }
    };

    container.addEventListener("focusin", handleFocusIn);
    return () => container.removeEventListener("focusin", handleFocusIn);
  }, [containerRef, getButtons]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const buttons = getButtons();
    if (buttons.length === 0) return;

    const forwardKey = orientation === "vertical" ? "ArrowDown" : "ArrowRight";
    const backwardKey = orientation === "vertical" ? "ArrowUp" : "ArrowLeft";
    const currentIndex = currentIndexRef.current;
    let newIndex: number;

    switch (e.key) {
      case forwardKey:
        newIndex = Math.min(currentIndex + 1, buttons.length - 1);
        break;
      case backwardKey:
        newIndex = Math.max(currentIndex - 1, 0);
        break;
      case "Home":
        newIndex = 0;
        break;
      case "End":
        newIndex = buttons.length - 1;
        break;
      default:
        return; // Don't preventDefault for other keys (Enter, Space, Tab, off-axis arrows, etc.)
    }

    e.preventDefault();
    // Also stop propagation so the event doesn't bubble to ancestors that handle
    // the same keys for unrelated reasons. Specifically, tile-component.tsx has an
    // ArrowUp "soft-exit" handler that pops focus back to the tile container; without
    // stopPropagation here, ArrowUp on a roving toolbar inside the tile would exit
    // the toolbar instead of moving the active item. Safe for floating toolbars
    // (rendered in a portal) because portal events don't bubble to .tool-tile.
    e.stopPropagation();

    if (newIndex !== currentIndex) {
      buttons[currentIndex].setAttribute("tabindex", "-1");
      buttons[newIndex].setAttribute("tabindex", "0");
      buttons[newIndex].focus();
      currentIndexRef.current = newIndex;
    }
  }, [getButtons, orientation]);

  return { handleKeyDown };
}
