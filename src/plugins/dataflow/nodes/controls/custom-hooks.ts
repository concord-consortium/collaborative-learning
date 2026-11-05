import { RefObject, useEffect } from "react";

const stopEventPropagation = (e: Event) => e.stopPropagation();

/**
 * Keeps a press inside a node control from reaching rete, which would otherwise start dragging
 * the node out from under it.
 *
 * Takes the element rather than a ref to it. A ref object is the same object on every render, so
 * an effect that depends on one runs only on mount -- when an element rendered conditionally, or
 * mounted hidden, does not exist yet, and so is never guarded. Callers hold the element in state
 * and pass the setter as `ref`.
 */
export function useStopEventPropagation<K extends keyof HTMLElementEventMap>(
                  element: HTMLElement | null, event: K): void {
  useEffect(() => {
    if (!element) return;
    element.addEventListener(event, stopEventPropagation);
    return () => element.removeEventListener(event, stopEventPropagation);
  }, [element, event]);
}

export function useCloseDropdownOnOutsideEvent<T extends HTMLElement>(
                  domRef: RefObject<T>, isOpen: () => boolean, close: () => void) {
  useEffect(() => {
    function eventHandler(e: MouseEvent | PointerEvent) {
      // close on click outside the specified DOM node
      if (domRef.current && e.target && !domRef.current.contains(e.target as Node) && isOpen()) {
        close();
      }
    }
    function keyEventHandler(e: KeyboardEvent) {
      // close on escape key
      if ((e.keyCode === 27) && isOpen()) {
        close();
      }
    }

    window.addEventListener("mousedown", eventHandler, true);
    window.addEventListener("pointerdown", eventHandler, true);
    window.addEventListener("keydown", keyEventHandler, true);
    return () => {
      window.removeEventListener("mousedown", eventHandler);
      window.removeEventListener("pointerdown", eventHandler);
      window.removeEventListener("keydown", keyEventHandler);
    };
  }, [close, domRef, isOpen]);
}
