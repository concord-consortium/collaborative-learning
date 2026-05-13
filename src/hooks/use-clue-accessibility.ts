import { RefObject, useEffect, useRef } from "react";
import {
  AccessibilityResult,
  AnnouncementsConfig,
  FocusTrapResult,
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

  // Container element — the .tool-tile wrapper that the focus trap attaches to
  containerRef?: RefObject<HTMLElement | null>;
  getContainerElement?: () => HTMLElement | undefined;

  // Content element — provide a ref (function components) or getter (class components)
  contentRef?: RefObject<HTMLElement | null>;
  getContentElement?: () => HTMLElement | undefined;

  // Custom focus function for complex editors (Slate, CodeMirror, etc.)
  focusContent?: (context: { reverse: boolean }) => boolean;

  // Per-slot custom Tab/Escape handlers forwarded to FocusTrapStrategy
  tabHandlers?: Record<string, (event: KeyboardEvent, reverse: boolean) => "handled" | "exit">;
  escapeHandlers?: Record<string, (event: KeyboardEvent) => "handled" | "exit">;

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
 * For `type: "tile"`: builds a FocusTrapStrategy from CLUE tile concepts, registers
 * the tile API, and wires useFocusTrap for keyboard Tab/Enter/Escape handling.
 *
 * For `type: "region"`: passes through navigation/announcements/resize config without
 * any focus trap registration.
 */
export function useClueAccessibility(options: ClueAccessibilityOptions): AccessibilityResult {
  // Capture latest options in a ref so the mount-only effect always sees current values
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Build a stable containerRef for the focus trap.
  // Updated on each render so it reflects the latest DOM element.
  // Note: current function-component tiles (bar-graph, drawing, etc.) don't pass containerRef
  // or getContainerElement because tile-component.tsx's FocusTrapController handles their
  // focus trap. This wiring exists for future tiles that manage their own trap.
  const containerRef = useRef<HTMLElement | null>(null);
  if (options.type === "tile") {
    const config = options.focusTrap;
    if (config.containerRef) {
      containerRef.current = config.containerRef.current;
    } else if (config.getContainerElement) {
      containerRef.current = config.getContainerElement() ?? null;
    }
  }

  // Build the strategy once and keep it stable across renders.
  // The strategy captures getter functions from the initial options.focusTrap,
  // but those getters read from stable React refs (contentRef, titleRef, etc.)
  // or close over stable refs, so .current always yields the live element.
  // Keeping the strategy object itself stable avoids churning useFocusTrap's effect.
  const strategyRef = useRef<ReturnType<typeof createClueTileStrategy> | undefined>(undefined);
  if (options.type === "tile" && !strategyRef.current) {
    strategyRef.current = createClueTileStrategy(options.focusTrap);
  }

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
        // This is separate from strategyRef which stays stable for useFocusTrap.
        const strategy = createClueTileStrategy(currentOpts.focusTrap);
        const elements = strategy.getElements();
        return {
          contentElement: elements.content,
          titleElement: elements.title,
          focusContent: strategy.focusContent,
          topbarElement: elements.topbar,
          paletteElement: elements.palette,
        };
      },
    };

    config.onRegisterTileApi(tileApi);
    return () => config.onUnregisterTileApi();
  }, []); // mount/unmount lifecycle matches componentDidMount/componentWillUnmount

  // Delegate to generic useAccessibility with focus trap wired.
  // Only pass focusTrap when a container element exists — without one, useFocusTrap
  // can't attach listeners and would just allocate no-op hooks on every render.
  const hasFocusTrapContainer = options.type === "tile" && containerRef.current != null;
  const result = useAccessibility({
    focusTrap: hasFocusTrapContainer && strategyRef.current ? {
      containerRef,
      strategy: strategyRef.current,
    } : undefined,
    navigation: options.navigation,
    announcements: options.announcements,
    resize: options.resize,
  });

  return result;
}

// ---------------------------------------------------------------------------
// Bridge component for class components
// ---------------------------------------------------------------------------

/**
 * Renderless bridge that lets class components use useClueAccessibility.
 * Render as a child — it returns null and only runs the hook.
 *
 * The onFocusTrapReady callback provides imperative control (enterTrap/exitTrap)
 * so the class component can wire Enter/Escape to trap activation.
 */
export function ClueTileAccessibilityBridge(props: ClueFocusTrapConfig & {
  onFocusTrapReady?: (trap: FocusTrapResult) => void;
}) {
  const { onFocusTrapReady, ...focusTrapConfig } = props;
  const result = useClueAccessibility({
    type: "tile",
    focusTrap: focusTrapConfig,
  });

  // Expose the trap controller to the class component
  useEffect(() => {
    if (result.focusTrap && onFocusTrapReady) {
      onFocusTrapReady(result.focusTrap);
    }
  }, [result.focusTrap, onFocusTrapReady]);

  return null;
}
