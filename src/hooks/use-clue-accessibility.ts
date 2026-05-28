import { RefObject, useEffect, useRef } from "react";
import {
  AccessibilityResult,
  AnnouncementsConfig,
  EscapeHandlerResult,
  FocusContentContext,
  NavigationConfig,
  ResizableConfig,
  TabHandlerResult,
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

  // Drag handle element for keyboard tile pick-up
  dragHandleRef?: RefObject<HTMLElement | null>;
  getDragHandleElement?: () => HTMLElement | undefined;

  // Resize handle element
  resizeRef?: RefObject<HTMLElement | null>;
  getResizeElement?: () => HTMLElement | undefined;

  // Non-focus ITileApi methods (exportContentAsTileJson, handleTileResize, etc.)
  additionalApi?: Partial<ITileApi>;

  // Called when Tab is pressed but the trap is not active (for inter-tile navigation)
  onTabWhenInactive?: (e: KeyboardEvent, reverse: boolean) => boolean;

  /**
   * Override for which slots route Tab within them vs treating the whole slot
   * as one stop. Default: `["topbar", "content"]`. Tiles with heterogeneous
   * palette focusables (XY Plot's legend) opt the palette in.
   */
  tabWithinSlots?: string[];

  /**
   * Per-slot Escape interceptors. "handled" suppresses the trap's exit (so a
   * React keydown can still see the event on bubble); "exit" exits normally.
   */
  escapeHandlers?: Record<string, (e: KeyboardEvent) => EscapeHandlerResult>;

  /**
   * Per-slot Tab interceptors. "handled" — the handler moved focus and called
   * preventDefault. "exit" — let the trap advance. Any listed slot is treated
   * as managing its own tabindex (the trap's mount-time
   * setChildrenNonTabbable skips its descendants).
   */
  tabHandlers?: Record<string, (e: KeyboardEvent, reverse: boolean) => TabHandlerResult>;
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

    // Build the tile API once. Every additionalApi method registered here is a
    // proxy that delegates to the *current* additionalApi at call time, so
    // dependency-driven updates inside the caller (e.g. XY Plot's `getDotCenter`
    // becoming usable after a table is linked) are reflected without needing
    // to re-register the tile API. The mount-only registration matches the
    // componentDidMount / componentWillUnmount lifecycle the API registry
    // expects, while preserving reactivity for the methods themselves.
    const tileApi: ITileApi = {};
    for (const key of Object.keys(config.additionalApi ?? {}) as Array<keyof ITileApi>) {
      (tileApi as Record<string, unknown>)[key] = (...args: unknown[]) => {
        const currentOpts = optionsRef.current;
        if (currentOpts.type !== "tile") return undefined;
        const fn = (currentOpts.focusTrap.additionalApi as Record<string, unknown> | undefined)?.[key];
        return typeof fn === "function" ? fn(...args) : undefined;
      };
    }
    // getFocusableElements always wins — overwrite any same-named proxy above.
    tileApi.getFocusableElements = () => {
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
        dragHandleElement: elements.dragHandle,
        tabWithinSlots: strategy.tabWithinSlots,
        tabHandlers: strategy.tabHandlers,
        escapeHandlers: strategy.escapeHandlers,
      };
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
