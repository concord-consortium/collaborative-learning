import { RefObject, useEffect } from "react";

const stopEventPropagation = (e: Event) => e.stopPropagation();

export function useStopEventPropagation<T extends HTMLElement, K extends keyof HTMLElementEventMap>(
                  domRef: RefObject<T>, event: K): void {
  useEffect(() => {
    domRef.current?.addEventListener(event, stopEventPropagation);
    const current = domRef.current;
    return () => {
      current?.removeEventListener(event, stopEventPropagation);
    };
  }, [domRef, event]);
}

// TODO: is this used anymore?
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
