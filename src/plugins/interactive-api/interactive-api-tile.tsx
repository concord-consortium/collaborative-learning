/*
 * NOT IMPLEMENTED
 *
 * See: docs/specs/add-interactive-api-tile.md
 *
 * This section lists features from the spec that were not implemented in the initial release.
 * These are items from the "Optional Enhancements" section and other features that remain
 * for future development.
 *
 * 1. URL Configuration UI (Authoring Toolbar)
 *    Spec Section: Optional Enhancements > 1. URL Configuration UI
 *    What's Missing: A toolbar component that allows users to configure the interactive URL
 *    directly in the CLUE interface.
 *    Current Workaround: URLs must be configured via document JSON or authored content files.
 *
 * 2. Authored State Configuration UI
 *    Spec Section: Optional Enhancements > 2. Authored State Configuration
 *    What's Missing: A UI for curriculum authors to configure the `authoredState` property
 *    (the configuration passed to the interactive).
 *    Current Workaround: `authoredState` must be configured via document JSON or authored content files.
 *
 * 3. Linked Interactives Support
 *    Spec Section: Optional Enhancements > 3. Support for Linked Interactives
 *    What's Missing: The ability for interactives to link to and receive data from other
 *    CLUE tiles (e.g., SharedDataSet).
 *    Current Behavior: `linkedInteractives` is always sent as an empty array `[]`.
 *
 * 4. Full Modal/Dialog Support
 *    Spec Section: Optional Enhancements > 4. Advanced Features
 *    What's Missing: Support for lightbox and dialog modal types from interactives.
 *    Current Behavior: Only `window.alert()` is supported for `type: "alert"` modals.
 *    The `hostFeatures.modal` declaration correctly reports `lightbox: false` and `dialog: false`.
 *
 * 5. Hint Display Integration
 *    Spec Section: Technical Notes > Hint System Support
 *    What's Missing: Displaying hints from interactives in the CLUE UI.
 *    Current Behavior: Hints are logged to console but not displayed to users. The hint
 *    listener exists and works, but only outputs to `console.log`.
 *
 * 6. Custom Message Support
 *    Spec Section: Optional Enhancements > 4. Advanced Features
 *    What's Missing: Support for arbitrary custom messages between CLUE and interactives.
 *    Current Behavior: Only standard LARA Interactive API messages are supported.
 *
 * 7. Global Interactive State
 *    Spec Section: Step 6 code (initMessage structure)
 *    What's Missing: Support for sharing state across multiple instances of the same interactive.
 *    Current Behavior: `globalInteractiveState` is always `null`.
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { observer } from "mobx-react";
import iframePhone from "iframe-phone";
import { ITileProps } from "../../components/tiles/tile-component";
import { InteractiveApiContentModelType, isInteractiveApiModel } from "./interactive-api-tile-content";
import { BasicEditableTileTitle } from "../../components/tiles/basic-editable-tile-title";
import { Logger } from "../../lib/logger";
import { LogEventName } from "../../lib/logger-types";
import {
  IShowModal,
  ICloseModal,
  ISupportedFeatures
} from "@concord-consortium/lara-interactive-api";

import "./interactive-api-tile.scss";

// Type from iframe-phone package
// Note: @types/iframe-phone is not available, so we define a minimal interface
interface IframePhone {
  disconnect: () => void;
  addListener: (type: string, handler: (data: any) => void) => void;
  post: (type: string, data: any) => void;
}

// Simple debounce utility to avoid adding external dependencies
// Includes cancel method to prevent updates after component unmount
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): T & { cancel: () => void } {
  let timeout: NodeJS.Timeout | null = null;
  const debounced = ((...args: any[]) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  }) as T & { cancel: () => void };

  debounced.cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };

  return debounced;
}

interface IInteractiveApiComponentProps extends ITileProps {
  // Note: onLog and onHintChange removed - will use Logger directly
}

// Error Boundary for tile isolation
class InteractiveApiErrorBoundary extends React.Component<
  {children: React.ReactNode},
  {hasError: boolean}
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("InteractiveApiTile Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="tile-error" style={{padding: "20px", color: "#d32f2f"}}>
          Failed to load interactive tile. Please try reloading the page.
        </div>
      );
    }
    return this.props.children;
  }
}

const InteractiveApiComponentInternal: React.FC<IInteractiveApiComponentProps> = observer((props) => {
  const { model, readOnly, onRequestRowHeight, onRegisterTileApi } = props;
  const content = isInteractiveApiModel(model.content) ? model.content : null;

  const [isLoading, setIsLoading] = useState(false);
  const [showSpinner, setShowSpinner] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const phoneRef = useRef<IframePhone>();
  const loadingTimeoutRef = useRef<NodeJS.Timeout>();
  const lastHeightRef = useRef<number>(480); // Track last height to prevent recursive loops
  const containerRef = useRef<HTMLDivElement>(null);
  const aspectRatioRef = useRef<number | null>(null); // Store aspect ratio from interactive

  // Use refs to avoid stale closures in iframe-phone callbacks
  const contentRef = useRef<InteractiveApiContentModelType | null>(content);
  contentRef.current = content;

  // Track current interactive state for comparison
  const currentInteractiveState = useRef<any>(content?.interactiveState);

  // Register tile API for export functionality
  useEffect(() => {
    onRegisterTileApi({
      exportContentAsTileJson: () => {
        return content?.exportJson() || "";
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSkipToContent = useCallback((e: React.SyntheticEvent) => {
    e.preventDefault();
    if (iframeRef.current) {
      iframeRef.current.focus();
    }
  }, []);

  // Debounce state updates to prevent excessive Firebase writes
  // Interactive controls (sliders, text inputs) can send updates very frequently
  const debouncedSetState = useMemo(
    () => debounce((state: any) => {
      contentRef.current?.setInteractiveState(state);
    }, 500), // 500ms debounce
    []
  );

  // Action to handle incoming interactive state with debouncing
  // Supports special messages: "nochange" and "touch" (LARA compatibility)
  const handleInteractiveState = useCallback((newState: any) => {
    // "nochange" and "touch" are special messages supported by LARA. We don't want to save them.
    // newState might be undefined if interactive state is requested before any state update.
    if (newState !== undefined && newState !== "nochange" && newState !== "touch") {
      // Only update interactive state if it's different from the current one
      const interactiveStateChanged =
        JSON.stringify(currentInteractiveState.current) !== JSON.stringify(newState);
      if (interactiveStateChanged) {
        currentInteractiveState.current = newState;
        debouncedSetState(newState);
      }
    }

    if (currentInteractiveState.current !== undefined && newState === "touch") {
      // Save the current interactive state with a new timestamp
      contentRef.current?.setInteractiveState(currentInteractiveState.current);
    }
  }, [debouncedSetState]);

  const debouncedRequestHeight = useMemo(
    () => debounce((tileId: string, height: number) => {
      onRequestRowHeight(tileId, height);
    }, 100), // 100ms debounce for height requests
    [onRequestRowHeight]
  );

  const handleHeight = useCallback((newHeight: number) => {
    // Ignore very small heights that might be sent during initial load
    // This prevents "jumpy" load sequences when interactives send 0 or very small heights initially
    if (newHeight < 200) {
      if (newHeight <= 0) {
        console.warn(`Interactive sent invalid height: ${newHeight}px (ignored)`);
      }
      return; // Ignore heights below our minimum
    }

    // Clamp height to reasonable bounds to prevent excessively large or small tiles
    // Min is enforced by SCSS (200px), max is either configured maxHeight or 2000px default
    const maxHeightLimit = content?.maxHeight && content.maxHeight > 0 ? content.maxHeight : 2000;
    const clampedHeight = Math.min(Math.max(newHeight, 200), maxHeightLimit);

    // Only request height change if difference is significant (> 5px)
    // This prevents recursive layout loops if iframe responds to container resizing
    // Note: If you encounter height "jittering" in flex layouts, increase this to 10px
    const heightDiff = Math.abs(clampedHeight - lastHeightRef.current);
    if (heightDiff <= 5) {
      return; // Skip if change is too small
    }

    lastHeightRef.current = clampedHeight;
    // Request the tile row to resize to match the iframe content height
    // Note: This is only called if the interactive sends 'height' messages.
    // If it doesn't, the tile will use the SCSS min-height (200px) or kInteractiveApiDefaultHeight (480px)
    // In dashboard views, CLUE's layout may override this request
    // Debounced to prevent UI jitter from continuous resize events
    debouncedRequestHeight(model.id, clampedHeight);
  }, [model.id, debouncedRequestHeight, content?.maxHeight]);

  // Calculate and apply height based on aspect ratio and current container width
  const applyAspectRatio = useCallback((aspectRatio: number) => {
    if (!containerRef.current || aspectRatio <= 0) return;

    // Get the current width of the container
    const containerWidth = containerRef.current.clientWidth;
    if (containerWidth <= 0) return;

    // Calculate height from aspect ratio (aspectRatio = width/height, so height = width/aspectRatio)
    const calculatedHeight = Math.round(containerWidth / aspectRatio);

    // Use handleHeight to apply the calculated height (it handles clamping and debouncing)
    handleHeight(calculatedHeight);
  }, [handleHeight]);

  const handleIframeLoad = useCallback(() => {
    setIsLoading(false);
    setShowSpinner(false);
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }
  }, []);

  // Reset loading state when URL changes
  useEffect(() => {
    setIsLoading(true);
    setShowSpinner(false);
  }, [content?.url]);

  // Show spinner after 2 seconds if still loading
  // This effect depends on isLoading to avoid stale closure issues
  useEffect(() => {
    if (!isLoading) {
      setShowSpinner(false);
      return;
    }

    // Start timeout to show spinner after delay
    loadingTimeoutRef.current = setTimeout(() => {
      setShowSpinner(true);
    }, 2000);

    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [isLoading]);

  useEffect(() => {
    if (!iframeRef.current || !content?.url) {
      return;
    }

    // Note: The iframe-phone connection is established as early as possible to ensure
    // we don't miss any messages from the iframe. The ParentEndpoint constructor
    // will call initInteractive when the iframe is ready (after it sends a "hello" message).
    // We use contentRef to avoid closure staleness issues since callbacks are registered once.
    const initInteractive = () => {
      const phone = phoneRef.current;
      if (!phone) return;

      // Listen for interactive state updates from the iframe
      phone.addListener("interactiveState", handleInteractiveState);

      // Listen for height change requests
      phone.addListener("height", handleHeight);

      // Listen for supported features (including aspect ratio support)
      phone.addListener("supportedFeatures", (info: any) => {
        const features: ISupportedFeatures = info.features;
        // Interactives can report aspectRatio for responsive sizing
        if (features.aspectRatio && features.aspectRatio > 0) {
          // Store the aspect ratio for use in resize handling
          aspectRatioRef.current = features.aspectRatio;
          // Apply the aspect ratio to calculate initial height
          applyAspectRatio(features.aspectRatio);
        }
      });

      // Listen for hint messages from the interactive
      phone.addListener("hint", (hintData: any) => {
        // Note: Hints are not currently displayed in CLUE UI
        // Future enhancement: integrate with CLUE's hint/tooltip system
        if (hintData.text) {
          console.log(`Interactive ${model.id} hint (not displayed):`, hintData.text);
        }
      });

      // Listen for log messages from the interactive
      phone.addListener("log", (logData: any) => {
        // Use CLUE's Logger system
        // Note: Ensure TILE_INTERACTIVE_LOG is added to LogEventName enum first
        // If not yet added, this will use a fallback string for development
        const logEventName = (LogEventName as any).TILE_INTERACTIVE_LOG || "INTERACTIVE_API_LOG";
        Logger.log(logEventName, {
          tileId: model.id,
          tileType: "InteractiveApi",
          ...logData
        });
      });

      // Handle modal requests (optional - can show modal dialogs)
      phone.addListener("showModal", (modalOptions: IShowModal) => {
        // For now, just alert - could be enhanced with proper modal support
        if (modalOptions.type === "alert") {
          window.alert(modalOptions.text);
        }
      });

      phone.addListener("closeModal", (modalOptions: ICloseModal) => {
        // Handle modal close if needed
      });

      // Send initial state to the iframe interactive
      // Legacy bug fix: In the 1.0.0 release of the AP the special 'nochange'
      // message wasn't handled correctly and it was saved as the interactive state
      // If we see that here we just use undefined instead.
      // Note: content is guaranteed to exist here due to the guard at the start of this effect
      let initialState = content.interactiveState;
      if (initialState === "nochange") {
        initialState = undefined;
      }

      // Common properties for both runtime and report modes
      const commonProps = {
        version: 1 as const,
        hostFeatures: {
          modal: {
            version: "1.0.0",
            lightbox: false,  // CLUE doesn't support lightbox modals
            dialog: false,     // CLUE doesn't support dialog modals
            alert: true        // CLUE supports simple alerts
          }
        },
        authoredState: content.authoredState,
        interactiveState: initialState,
        themeInfo: {
          colors: {
            colorA: "",
            colorB: ""
          }
        }
      };

      const initMessage = readOnly
        ? {
            ...commonProps,
            mode: "report" as const,
            linkedInteractives: [] as any[]
          }
        : {
            ...commonProps,
            mode: "runtime" as const,
            error: null,
            globalInteractiveState: null,
            linkedInteractives: [] as any[]
          };

      // Send loadInteractive message first (LARA compatibility)
      // Only when there is initial interactive state (as LARA does)
      if (initialState) {
        phone.post("loadInteractive", initialState);
      }

      // Then send initInteractive message
      phone.post("initInteractive", initMessage);
    };

    // Create the phone connection
    phoneRef.current = new iframePhone.ParentEndpoint(iframeRef.current, initInteractive);

    // Cleanup - properly disconnect to avoid duplicate listeners and clear any pending timers
    // Note: In React 18+ Strict Mode, effects run twice in development.
    // This cleanup ensures the old connection is destroyed before creating a new one.
    return () => {
      if (phoneRef.current) {
        phoneRef.current.disconnect();
        phoneRef.current = undefined;
      }
      // Clear loading timeout to prevent memory leaks
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = undefined;
      }
      // Cancel debounced functions to prevent MST "dead node" errors
      // after component unmount
      debouncedSetState.cancel();
      debouncedRequestHeight.cancel();
    };
  // Note: debouncedSetState and debouncedRequestHeight are stable (empty/stable deps in useMemo)
  // and are already captured by handleInteractiveState and handleHeight, so they're not needed here.
  // applyAspectRatio depends on handleHeight, so it's also not needed separately.
  // content.interactiveState and content.authoredState are intentionally read once at connection time.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content?.url, model.id, readOnly, handleInteractiveState, handleHeight]);

  // Poll interactive for state updates every 2 seconds
  // This ensures CLUE captures state changes even if the interactive doesn't
  // proactively send interactiveState messages
  useEffect(() => {
    if (!phoneRef.current || readOnly) {
      return; // Don't poll in read-only mode
    }

    const intervalId = setInterval(() => {
      phoneRef.current?.post("getInteractiveState", null);
    }, 2000); // Poll every 2 seconds

    return () => {
      clearInterval(intervalId);
    };
  }, [readOnly]);

  // Watch for container resize to reapply aspect ratio
  // This ensures the tile maintains the correct aspect ratio when the user resizes it
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      // Only reapply aspect ratio if one was set by the interactive
      if (aspectRatioRef.current && aspectRatioRef.current > 0) {
        applyAspectRatio(aspectRatioRef.current);
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [applyAspectRatio]);

  if (!content) return null;

  // Show a placeholder if no URL is configured
  if (!content.url) {
    return (
      <div className="tile-content interactive-api-wrapper">
        <BasicEditableTileTitle />
        <div className="interactive-api-placeholder">
          <p>No URL configured in authoring</p>
        </div>
      </div>
    );
  }

  const iframeStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    border: "none"
    // Note: We don't use pointer-events: none for readOnly mode to allow scrolling.
    // Instead, we rely on the mode: "report" in initMessage to disable interactive controls.
  };

  return (
    <div className="tile-content interactive-api-wrapper" ref={containerRef}>
      <BasicEditableTileTitle />
      {/* Skip to content link for keyboard navigation */}
      <a
        href="#interactive-content"
        className="skip-to-content"
        onClick={handleSkipToContent}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            handleSkipToContent(e);
          }
        }}
      >
        Skip to interactive content
      </a>
      <div
        className="interactive-api-content"
        role="region"
        aria-label="Interactive content"
        aria-busy={isLoading}
      >
        {showSpinner && (
          <div className="interactive-api-loading" role="status" aria-live="polite">
            <div className="spinner" aria-hidden="true" />
            <p>Loading interactive...</p>
          </div>
        )}
        <iframe
          id="interactive-content"
          ref={iframeRef}
          src={content.url}
          style={iframeStyle}
          scrolling={content.enableScroll ? "yes" : "no"}
          // Use configurable permissions from model (defaults to full set)
          // Can be restricted per-tile or via Content Security Policy in strict environments
          allow={content.allowedPermissions}
          // Sandbox for enhanced security - prevents top-level navigation and other malicious actions
          sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-downloads"
          title="Interactive Content"
          onLoad={handleIframeLoad}
        />
      </div>
    </div>
  );
});

InteractiveApiComponentInternal.displayName = "InteractiveApiComponentInternal";

// Export wrapped in error boundary
export const InteractiveApiComponent: React.FC<ITileProps> = (props) => {
  return (
    <InteractiveApiErrorBoundary>
      <InteractiveApiComponentInternal {...props} />
    </InteractiveApiErrorBoundary>
  );
};

InteractiveApiComponent.displayName = "InteractiveApiComponent";
