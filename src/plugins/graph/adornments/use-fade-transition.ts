import { useEffect, useRef, useState } from "react";

export type FadeState = "visible" | "fadingIn" | "hidden" | "fadingOut";

// Drives a four-state fade transition off a boolean `isVisible` flag. The
// returned state survives unrelated re-renders for the full `durationMs`
// window, unlike a ref-based approach where any re-render between the first
// paint and the animation completing would drop the fading class.
export function useFadeTransition(isVisible: boolean, durationMs: number): FadeState {
  const [state, setState] = useState<FadeState>(isVisible ? "fadingIn" : "hidden");
  const isFirstRunRef = useRef(true);

  useEffect(() => {
    const settledState: FadeState = isVisible ? "visible" : "hidden";
    if (isFirstRunRef.current) {
      isFirstRunRef.current = false;
      if (!isVisible) return;
    } else {
      setState(isVisible ? "fadingIn" : "fadingOut");
    }
    const timer = setTimeout(() => setState(settledState), durationMs);
    return () => clearTimeout(timer);
  }, [isVisible, durationMs]);

  return state;
}
