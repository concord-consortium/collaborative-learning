import { useCallback, useLayoutEffect, useRef } from "react";

/**
 * Manages roving tabindex for toolbar keyboard navigation.
 * - Only one button has tabIndex=0 at a time (the roving target)
 * - All other buttons have tabIndex=-1
 * - All four arrow keys move focus between buttons
 * - Home/End move to first/last button
 * - Does not wrap around
 * - Disabled buttons are focusable (not skipped)
 *
 * The hook queries buttons from the DOM at navigation time so it stays correct
 * when buttons dynamically change or when the toolbar configuration varies.
 */
export function useRovingTabindex(containerRef: React.RefObject<HTMLElement | null>) {
  const currentIndexRef = useRef(0);

  const getButtons = useCallback((): HTMLElement[] => {
    if (!containerRef.current) return [];
    return Array.from(containerRef.current.querySelectorAll("button"));
  }, [containerRef]);

  // Set tabindex attributes after each render to handle dynamic button changes
  // (e.g., buttons becoming enabled/disabled). Also tracks focus changes from mouse
  // clicks to keep the roving target in sync.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const buttons = getButtons();
    if (buttons.length === 0) return;

    // Clamp index in case buttons were added or removed.
    currentIndexRef.current = Math.min(currentIndexRef.current, buttons.length - 1);

    buttons.forEach((button, i) => {
      button.setAttribute("tabindex", i === currentIndexRef.current ? "0" : "-1");
    });

    // When a button receives focus via mouse click, update the roving target.
    // Queries fresh buttons to avoid stale closure if DOM changed since effect ran.
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
  });

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const buttons = getButtons();
    if (buttons.length === 0) return;

    const currentIndex = currentIndexRef.current;
    let newIndex: number;

    switch (e.key) {
      case "ArrowDown":
      case "ArrowRight":
        newIndex = Math.min(currentIndex + 1, buttons.length - 1);
        break;
      case "ArrowUp":
      case "ArrowLeft":
        newIndex = Math.max(currentIndex - 1, 0);
        break;
      case "Home":
        newIndex = 0;
        break;
      case "End":
        newIndex = buttons.length - 1;
        break;
      default:
        return; // Don't preventDefault for other keys (Enter, Space, Tab, etc.)
    }

    e.preventDefault();

    if (newIndex !== currentIndex) {
      buttons[currentIndex].setAttribute("tabindex", "-1");
      buttons[newIndex].setAttribute("tabindex", "0");
      buttons[newIndex].focus();
      currentIndexRef.current = newIndex;
    }
  }, [getButtons]);

  return { handleKeyDown };
}
