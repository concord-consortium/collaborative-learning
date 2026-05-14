import { RefObject, useEffect, useRef } from "react";
import {
  AccessibilityResult,
  AnnouncementsConfig,
  EscapeHandlerResult,
  FocusContentContext,
  NavigationConfig,
  ResizableConfig,
  useAccessibility,
} from "@concord-consortium/accessibility-tools/hooks";
import { ITileApi } from "../components/tiles/tile-api";
import { createClueTileStrategy } from "./create-clue-tile-strategy";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClueFocusTrapConfig {
  onRegisterTileApi: (api: ITileApi, facet?: string) => void;
  onUnregisterTileApi: (facet?: string) => void;
  tileType: string;

  // Content element — provide a ref (function components) or getter (class components)
  contentRef?: RefObject<HTMLElement | null>;
  getContentElement?: () => HTMLElement | undefined;

  // Custom focus function for complex editors (Slate, CodeMirror, etc.). The
  // FocusContentContext carries entryMode so direction-aware implementations
  // can pick the right tab stop on reverse entry.
  focusContent?: (context: FocusContentContext) => boolean;

  // Title element
  titleRef?: RefObject<HTMLElement | null>;
  getTitleElement?: () => HTMLElement | undefined;

  // Toolbar element (for FloatingPortal toolbars)
  toolbarRef?: RefObject<HTMLElement | null>;
  getToolbarElement?: () => HTMLElement | undefined;

  // Optional secondary controls bar element (e.g. dataflow's Sampling Rate / Record bar).
  // Visited as its own slot between `title` and `content`; walked focusable-by-focusable.
  topbarRef?: RefObject<HTMLElement | null>;
  getTopbarElement?: () => HTMLElement | undefined;

  // Optional inline secondary toolbar element (e.g. dataflow's Add-Block palette).
  // Visited as its own slot between `content` and `toolbar` (single tab stop with
  // arrow-key roving inside).
  paletteRef?: RefObject<HTMLElement | null>;
  getPaletteElement?: () => HTMLElement | undefined;

  // Resize handle element
  resizeRef?: RefObject<HTMLElement | null>;
  getResizeElement?: () => HTMLElement | undefined;

  // Non-focus ITileApi methods (exportContentAsTileJson, handleTileResize, etc.)
  additionalApi?: Partial<ITileApi>;

  // Called when Tab is pressed but the trap is not active (for inter-tile navigation)
  onTabWhenInactive?: (e: KeyboardEvent, reverse: boolean) => boolean;

  /**
   * Optional override for which slot names should have Tab routed within the
   * slot (vs treating the whole slot as a single Tab stop). The default in
   * `createClueTileStrategy` is `["topbar", "content"]`. Tiles whose palette
   * contains heterogeneous native focusables (e.g. XY Plot's legend) can opt
   * the palette in with `["topbar", "content", "palette"]`.
   */
  tabWithinSlots?: string[];

  /**
   * Optional per-slot Escape interceptors. Return "handled" to suppress the
   * trap's default exit (the React keydown handler downstream gets to see the
   * event during bubble); return "exit" to let the trap exit normally.
   */
  escapeHandlers?: Record<string, (e: KeyboardEvent) => EscapeHandlerResult>;
}

interface ClueTileOptions {
  type: "tile";
  focusTrap: ClueFocusTrapConfig;
  navigation?: NavigationConfig;
  announcements?: AnnouncementsConfig;
  resize?: ResizableConfig;
}

interface ClueRegionOptions {
  type: "region";
  navigation?: NavigationConfig;
  announcements?: AnnouncementsConfig;
  resize?: ResizableConfig;
}

export type ClueAccessibilityOptions = ClueTileOptions | ClueRegionOptions;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * CLUE-specific wrapper around useAccessibility from @concord-consortium/accessibility-tools.
 *
 * For `type: "tile"`: registers the tile API. Each call to the registered
 * `getFocusableElements()` builds a fresh FocusTrapStrategy from the latest
 * options, so tile-component.tsx's FocusTrapController always reads the
 * current render's element getters.
 *
 * For `type: "region"`: passes through navigation/announcements/resize config without
 * any tile API registration.
 */
export function useClueAccessibility(options: ClueAccessibilityOptions): AccessibilityResult {
  // Capture latest options in a ref so the mount-only effect always sees current values
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Register tile API on mount, unregister on unmount
  useEffect(() => {
    const opts = optionsRef.current;
    if (opts.type !== "tile") return;

    const { focusTrap: config } = opts;

    // Delegate through optionsRef so the registered API always uses the latest
    // callbacks/refs even if the component re-renders after mount.
    // Spread additionalApi first so getFocusableElements below always wins
    const tileApi: ITileApi = {
      ...config.additionalApi,
      getFocusableElements: () => {
        const currentOpts = optionsRef.current;
        if (currentOpts.type !== "tile") return undefined;
        // Create a fresh strategy from the latest options so element getters
        // reflect the current render (not stale closures from mount time).
        const strategy = createClueTileStrategy(currentOpts.focusTrap);
        const elements = strategy.getElements();
        return {
          contentElement: elements.content,
          titleElement: elements.title,
          focusContent: strategy.focusContent,
          topbarElement: elements.topbar,
          paletteElement: elements.palette,
          tabWithinSlots: strategy.tabWithinSlots,
          escapeHandlers: strategy.escapeHandlers,
        };
      },
    };

    config.onRegisterTileApi(tileApi);
    return () => config.onUnregisterTileApi();
  }, []); // mount/unmount lifecycle matches componentDidMount/componentWillUnmount

  // Delegate to generic useAccessibility for the navigation / announcements /
  // resize hooks. Focus trapping is owned by tile-component.tsx's
  // FocusTrapController, which reads the tile's getFocusableElements() (registered
  // above) — no focus-trap wiring is needed here.
  return useAccessibility({
    navigation: options.navigation,
    announcements: options.announcements,
    resize: options.resize,
  });
}

// ---------------------------------------------------------------------------
// Bridge component for class components
// ---------------------------------------------------------------------------

/**
 * Renderless bridge that lets class components use useClueAccessibility.
 * Render as a child — it returns null and only runs the hook.
 */
export function ClueTileAccessibilityBridge(props: ClueFocusTrapConfig) {
  useClueAccessibility({
    type: "tile",
    focusTrap: props,
  });
  return null;
}
