import { RefObject, useEffect, useRef } from "react";
import {
  AccessibilityResult,
  AnnouncementsConfig,
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

  // Custom focus function for complex editors (Slate, CodeMirror, etc.)
  focusContent?: () => boolean;

  // Title element
  titleRef?: RefObject<HTMLElement | null>;
  getTitleElement?: () => HTMLElement | undefined;

  // Toolbar element (for FloatingPortal toolbars)
  toolbarRef?: RefObject<HTMLElement | null>;
  getToolbarElement?: () => HTMLElement | undefined;

  // Non-focus ITileApi methods (exportContentAsTileJson, handleTileResize, etc.)
  additionalApi?: Partial<ITileApi>;
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
 * For `type: "tile"`: builds a FocusTrapStrategy from CLUE tile concepts and registers
 * the tile API (including getFocusableElements) on mount.
 *
 * For `type: "region"`: passes through navigation/announcements/resize config without
 * any focus trap registration.
 *
 * Note: the focus trap keyboard handling (Enter/Escape/Tab cycling) currently remains
 * in tile-component.tsx. This hook handles tile API registration and strategy creation.
 * The package's useFocusTrap will take over keyboard mechanics when tile-component
 * is migrated in a future story.
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
        const strategy = createClueTileStrategy(currentOpts.focusTrap);
        const elements = strategy.getElements();
        return {
          contentElement: elements.content,
          titleElement: elements.title,
          focusContent: strategy.focusContent,
        };
      },
    };

    config.onRegisterTileApi(tileApi);
    return () => config.onUnregisterTileApi();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount/unmount lifecycle matches componentDidMount/componentWillUnmount

  // Delegate to generic useAccessibility.
  // focusTrap is deliberately NOT passed — tile-component.tsx handles keyboard mechanics.
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
 *
 * Usage in a class component's render():
 *   <ClueTileAccessibilityBridge
 *     onRegisterTileApi={this.props.onRegisterTileApi}
 *     onUnregisterTileApi={this.props.onUnregisterTileApi}
 *     tileType="text"
 *     getContentElement={() => this.editorDiv}
 *     focusContent={() => { ... }}
 *     additionalApi={{ exportContentAsTileJson: () => ... }}
 *   />
 */
export function ClueTileAccessibilityBridge(props: ClueFocusTrapConfig) {
  useClueAccessibility({
    type: "tile",
    focusTrap: props,
  });
  return null;
}
