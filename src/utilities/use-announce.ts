import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Hook for aria-live announcements with auto-clear.
 * Returns the current announcement string and a function to set a new one.
 */
export function useAnnounce(duration = 2000) {
  const [announcement, setAnnouncement] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const announce = useCallback((message: string) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setAnnouncement(message);
    timerRef.current = setTimeout(() => {
      setAnnouncement("");
      timerRef.current = null;
    }, duration);
  }, [duration]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return { announcement, announce };
}
