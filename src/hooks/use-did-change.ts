import { usePrevious } from "./hooks/use-previous";

// This hook will tell you when something has changed between renders.
// It can be useful to help you determine which dependency is causing a hook to fire.
export function useDidChange<T>(label: string, value: T) {
  const prevLabel = usePrevious(value);
  console.log(`${label} didChange:" ${value !== prevLabel}`);
}
