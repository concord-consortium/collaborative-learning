import { useCallback, useState } from "react";

/**
 * Like useState, but for storing function values.
 *
 * React's setState interprets a function argument as a state updater
 * (i.e. setState(prev => next)), which means you can't pass a function
 * directly as the new value. This hook wraps the setter to handle the
 * thunk indirection internally, so callers can just write:
 *
 *   const [fn, setFn] = useFunctionState<(text: string) => void>();
 *   setFn(myCallback);   // stores myCallback
 *   setFn(null);          // clears it
 */
export function useFunctionState<T extends (...args: any[]) => any>() {
  const [fn, setFn] = useState<T | null>(null);
  const set = useCallback((newFn: T | null) => {
    setFn(newFn ? () => newFn : null);
  }, []);
  return [fn, set] as const;
}
