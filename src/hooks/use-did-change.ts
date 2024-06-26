import { usePrevious } from "./use-previous";

// This hook will tell you when something has changed between renders.
// It can be useful to help you determine which dependency is causing a hook to fire.
export function useDidChange<T>(label: string, value: T) {
  const prevLabel = usePrevious(value);
  // eslint-disable-next-line no-console
  console.log(`${label} didChange:" ${value !== prevLabel}`);
}
