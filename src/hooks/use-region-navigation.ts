import { useEffect, useRef } from "react";
import { focusManager } from "../utilities/focus-manager";

/**
 * Hook for registering a focus region.
 * Regions are major navigable areas (header, resources pane, workspace pane).
 *
 * NOTE: This hook does NOT intercept Tab — browser handles Tab navigation natively.
 * The hook only registers the region for focus memory purposes.
 *
 * @param regionId - Unique identifier for the region
 * @returns ref to attach to the region's root element
 */
export function useRegionNavigation(regionId: string) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (ref.current) {
      focusManager.registerRegion({
        id: regionId,
        element: ref.current,
        type: 'region'
      });
    }
    return () => focusManager.unregisterRegion(regionId);
  }, [regionId]);

  return { ref };
}
