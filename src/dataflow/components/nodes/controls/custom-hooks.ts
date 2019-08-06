import { RefObject, useEffect } from "react";

const stopEventPropagation = (e: PointerEvent) => e.stopPropagation();

export function useStopEventPropagation<T extends HTMLElement, K extends keyof HTMLElementEventMap>(
                  domRef: RefObject<T>, event: K): void {
  useEffect(() => {
    domRef.current && domRef.current.addEventListener(event, stopEventPropagation);
    return () => {
      domRef.current && domRef.current.removeEventListener(event, stopEventPropagation);
    };
  }, []);
}
