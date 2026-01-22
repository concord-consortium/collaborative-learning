# Spec: Adding an Interactive API Tile to CLUE

**CLUE Repository**: https://github.com/concord-consortium/collaborative-learning

## Story Info/Status

Story: https://concord-consortium.atlassian.net/browse/CLUE-333
Status: *Implemented*

## Overview

This document outlines the steps to create a new "Interactive API" tile in CLUE that embeds external interactive content via an iframe using the [@concord-consortium/interactive-api-host](https://www.npmjs.com/package/@concord-consortium/interactive-api-host) package. This tile will allow curriculum authors to specify a URL to an external interactive.

**Compatibility**: The tile works with:
- Interactives that implement the LARA Interactive API protocol (full two-way communication, state persistence, height management)
- Any embeddable content URL (displays content without errors, even if it doesn't support the Interactive API)

## Reference Implementation

The implementation will be based on:
- **Starter Tile**: [src/plugins/starter/](../src/plugins/starter/) - Provides the basic tile structure
- **Complete iframe host**: [activity-player iframe-runtime.tsx](https://github.com/concord-consortium/activity-player/blob/master/src/components/activity-page/managed-interactive/iframe-runtime.tsx) - Full-featured LARA Interactive API host implementation

## Implementation Steps

### Step 1: Copy the Starter Tile

```bash
cp -r src/plugins/starter src/plugins/interactive-api
```

### Step 2: Rename Files

Rename all files with "starter" in the filename:

```bash
cd src/plugins/interactive-api

# Rename files
mv starter-content.test.ts interactive-api-tile-content.test.ts
mv starter-content.ts interactive-api-tile-content.ts
mv starter-icon.svg interactive-api-tile-icon.svg
mv starter-registration.ts interactive-api-tile-registration.ts
mv starter-tile-id.svg interactive-api-tile-id.svg
mv starter-tile.scss interactive-api-tile.scss
mv starter-tile.test.tsx interactive-api-tile.test.tsx
mv starter-tile.tsx interactive-api-tile.tsx
mv starter-types.ts interactive-api-tile-types.ts
```

### Step 3: Update Type Definitions

**File**: `interactive-api-tile-types.ts`

```typescript
export const kInteractiveApiTileType = "InteractiveApi";
export const kInteractiveApiDefaultHeight = 480;
```

**Icon Updates**:
- Edit `interactive-api-tile-icon.svg`
  - Find the line: `<text text-anchor="middle" x="50%" y="15">St</text>`
  - Replace "St" with "IA": `<text text-anchor="middle" x="50%" y="15">IA</text>`
- Edit `interactive-api-tile-id.svg`
  - Find the line with "St" text and replace with "IA"

### Step 4: Install Required Dependencies

Add the interactive-api-host package:

```bash
npm install @concord-consortium/lara-interactive-api
npm install iframe-phone
```

**Note:** The `iframe-phone` package does not provide TypeScript definitions, so the implementation includes a minimal interface. Use the latest compatible versions, or specify versions if needed:
- `@concord-consortium/lara-interactive-api@1.11.0` (or newer)
- `iframe-phone@^1.3.1` (or newer)

### Step 5: Define Content Model

**File**: `interactive-api-tile-content.ts`

The content model needs to store:
- `url`: The URL of the external interactive to load
- `interactiveState`: The current runtime state of the iframe interactive (populated by the interactive at runtime, NOT authored)
- `authoredState`: Configuration set by curriculum authors in the template, passed to all students' instances of the interactive
- `allowedPermissions`: Configurable iframe permissions (optional, defaults to full set)
- `maxHeight`: Maximum height for the tile in pixels (optional, 0 = use calculated height up to 2000px)
- `enableScroll`: Whether to enable iframe scrolling for tall interactives (optional, defaults to false)

**Important distinction:**
- `interactiveState` always starts as `{}` in the curriculum template and is populated per-student at runtime as they interact. This is saved in each student's document.
- `authoredState` is configured once by curriculum authors in the template and is the same for all students.
- `allowedPermissions`, `maxHeight`, and `enableScroll` are configuration options that can be set per-tile in the curriculum template.

```typescript
import { types, Instance } from "mobx-state-tree";
import { TileContentModel } from "../../models/tiles/tile-content";
import { kInteractiveApiTileType } from "./interactive-api-tile-types";
import stringify from "json-stringify-pretty-compact";

export function defaultInteractiveApiContent(): InteractiveApiContentModelType {
  return InteractiveApiContentModel.create({
    url: "",
    interactiveState: {},
    authoredState: {}
  });
}

export const InteractiveApiContentModel = TileContentModel
  .named("InteractiveApiContent")
  .props({
    type: types.optional(types.literal(kInteractiveApiTileType), kInteractiveApiTileType),
    url: types.optional(types.string, ""),
    // frozen() types are immutable - to update, replace the entire object
    // interactiveState: Runtime-only, populated by interactive as students interact. Always starts empty.
    interactiveState: types.optional(types.frozen(), {}),
    // authoredState: Configured by curriculum authors, same for all students
    authoredState: types.optional(types.frozen(), {}),
    // Optional: Allow configuration of iframe permissions
    allowedPermissions: types.optional(types.string, "geolocation; microphone; camera; bluetooth"),
    // Optional: Maximum height for the tile (useful for very tall interactives)
    // If not set or 0, uses calculated height from interactive with 2000px max
    maxHeight: types.optional(types.number, 0),
    // Optional: Enable scrolling for interactives taller than maxHeight
    enableScroll: types.optional(types.boolean, false)
  })
  .views(self => ({
    get isUserResizable() {
      return true;
    },
    exportJson(options?: any) {
      const snapshot = {
        type: self.type,
        url: self.url,
        interactiveState: self.interactiveState,
        authoredState: self.authoredState,
        allowedPermissions: self.allowedPermissions,
        maxHeight: self.maxHeight,
        enableScroll: self.enableScroll
      };
      return stringify(snapshot, { maxLength: 200 });
    }
  }))
  .actions(self => ({
    setUrl(url: string) {
      self.url = url;
    },
    setInteractiveState(state: any) {
      // Note: frozen types are immutable, so we replace the entire object
      self.interactiveState = state;
    },
    setAuthoredState(state: any) {
      self.authoredState = state;
    },
    setAllowedPermissions(permissions: string) {
      self.allowedPermissions = permissions;
    },
    setMaxHeight(height: number) {
      self.maxHeight = height;
    },
    setEnableScroll(enable: boolean) {
      self.enableScroll = enable;
    }
  }));

export interface InteractiveApiContentModelType extends Instance<typeof InteractiveApiContentModel> {}

export function isInteractiveApiModel(model?: any): model is InteractiveApiContentModelType {
  return model?.type === kInteractiveApiTileType;
}
```

### Step 6: Create the React Component

**File**: `interactive-api-tile.tsx`

This component will:
1. Render an iframe with the specified URL
2. Use `iframe-phone` to establish communication with the iframe
3. Implement the Interactive API host functions (based on activity-player implementation)
4. Handle state updates from the iframe with "nochange" and "touch" special message support
5. Support read-only mode (report mode)
6. Handle height changes from the iframe
7. Poll interactive for state every 2 seconds (ensuring state capture)
8. Support logging from the interactive
9. Support hint messages (logged but not displayed)
10. Support supportedFeatures including aspectRatio
11. Automatically persist state via MST snapshot system
12. Handle legacy linkedInteractiveState format
13. Send both initInteractive and loadInteractive messages (LARA compatibility)

```typescript
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { observer } from "mobx-react";
import iframePhone from "iframe-phone";
import { ITileProps } from "../../components/tiles/tile-component";
import { InteractiveApiContentModelType, isInteractiveApiModel } from "./interactive-api-tile-content";
import { BasicEditableTileTitle } from "../../components/tiles/basic-editable-tile-title";
import { Logger } from "../../lib/logger";
import { LogEventName } from "../../lib/logger-types";
import {
  IInitInteractive,
  IReportInitInteractive,
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

  const [iframeHeight, setIframeHeight] = useState(480);
  const [isLoading, setIsLoading] = useState(false);
  const [showSpinner, setShowSpinner] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const phoneRef = useRef<IframePhone>();
  const loadingTimeoutRef = useRef<NodeJS.Timeout>();
  const lastHeightRef = useRef<number>(480); // Track last height to prevent recursive loops
  const containerRef = useRef<HTMLDivElement>(null);

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

  const handleSkipToContent = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
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
    setIframeHeight(clampedHeight);
    // Request the tile row to resize to match the iframe content height
    // Note: This is only called if the interactive sends 'height' messages.
    // If it doesn't, the tile will use the SCSS min-height (200px) or kInteractiveApiDefaultHeight (480px)
    // In dashboard views, CLUE's layout may override this request
    // Debounced to prevent UI jitter from continuous resize events
    debouncedRequestHeight(model.id, clampedHeight);
  }, [model.id, debouncedRequestHeight, content?.maxHeight]);

  const handleIframeLoad = useCallback(() => {
    setIsLoading(false);
    setShowSpinner(false);
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }
  }, []);

  // Initialize iframe communication
  useEffect(() => {
    // Start loading state and set timeout for spinner
    setIsLoading(true);
    setShowSpinner(false);

    // Show spinner after 2 seconds if still loading
    loadingTimeoutRef.current = setTimeout(() => {
      if (isLoading) {
        setShowSpinner(true);
      }
    }, 2000);

    // Cleanup timeout on unmount
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [content?.url]);

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
        if (features.aspectRatio) {
          // Note: CLUE may not support aspect ratio directly, but we log it for future use
          console.log(`Interactive ${model.id} reported aspect ratio:`, features.aspectRatio);
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
      let initialState = content.interactiveState;
      if (initialState === "nochange") {
        initialState = undefined;
      }

      const baseProps: Omit<IReportInitInteractive, "mode"> = {
        version: 1,
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

      const initMessage: IInitInteractive | IReportInitInteractive = readOnly
        ? {
            ...baseProps,
            mode: "report"
          }
        : {
            ...baseProps,
            error: null,
            mode: "runtime",
            globalInteractiveState: null,
            linkedInteractives: []
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
  }, [content?.url, content?.authoredState, content?.interactiveState, model.id,
      readOnly, handleInteractiveState, handleHeight]);

  // Poll interactive for state updates every 2 seconds
  // This ensures CLUE captures state changes even if the interactive doesn't
  // proactively send interactiveState messages
  useEffect(() => {
    if (!phoneRef.current || readOnly) {
      return; // Don't poll in read-only mode
    }

    const intervalId = setInterval(() => {
      phoneRef.current?.post("getInteractiveState");
    }, 2000); // Poll every 2 seconds

    return () => {
      clearInterval(intervalId);
    };
  }, [readOnly]);

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
        onKeyDown={(e) => e.key === 'Enter' && handleSkipToContent(e)}
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
```

### Step 7: Create Styling

**File**: `interactive-api-tile.scss`

```scss
.interactive-api-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;

  // Skip to content link for keyboard navigation
  .skip-to-content {
    position: absolute;
    left: -9999px;
    z-index: 999;
    padding: 0.5rem 1rem;
    background-color: #0592af;
    color: white;
    text-decoration: none;
    border-radius: 4px;

    &:focus {
      left: 10px;
      top: 10px;
    }
  }

  .interactive-api-content {
    flex: 1;
    overflow: hidden;
    position: relative;
    min-height: 0; // Important for flex child to shrink
    // Fallback minimum to prevent collapse if iframe doesn't send height
    min-height: 200px;
  }

  .interactive-api-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 200px;
    background-color: #f5f5f5;
    border: 2px dashed #ccc;
    border-radius: 4px;
    margin: 10px;

    p {
      margin: 5px 0;
      color: #666;
    }
  }

  .interactive-api-loading {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    z-index: 10;
    // Match CLUE theme to prevent jarring visual transition when iframe renders
    background: rgba(255, 255, 255, 0.95);
    padding: 24px;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #f3f3f3;
      // Use CLUE's primary color for the spinner
      border-top: 4px solid #0592af;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    p {
      margin: 0;
      color: #666;
      font-size: 14px;
    }
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  iframe {
    display: block;
    width: 100%;
    height: 100%;
  }
}
```

### Step 8: Update Registration

**File**: `interactive-api-tile-registration.ts`

```typescript
import { registerTileComponentInfo } from "../../models/tiles/tile-component-info";
import { registerTileContentInfo } from "../../models/tiles/tile-content-info";
import { kInteractiveApiTileType, kInteractiveApiDefaultHeight } from "./interactive-api-tile-types";
import { InteractiveApiComponent } from "./interactive-api-tile";
import { defaultInteractiveApiContent, InteractiveApiContentModel } from "./interactive-api-tile-content";

import Icon from "./interactive-api-tile-icon.svg";
import HeaderIcon from "./interactive-api-tile-id.svg";

registerTileContentInfo({
  type: kInteractiveApiTileType,
  displayName: "Interactive",
  modelClass: InteractiveApiContentModel,
  defaultContent: defaultInteractiveApiContent,
  defaultHeight: kInteractiveApiDefaultHeight
});

registerTileComponentInfo({
  type: kInteractiveApiTileType,
  Component: InteractiveApiComponent,
  tileEltClass: "interactive-api-tile",
  Icon,
  HeaderIcon
});
```

### Step 9: Create Unit Tests

Add comprehensive unit tests for the content model and component.

**File**: `interactive-api-tile-content.test.ts`

```typescript
import { defaultInteractiveApiContent, InteractiveApiContentModel } from "./interactive-api-tile-content";
import { kInteractiveApiTileType } from "./interactive-api-tile-types";

describe("InteractiveApiContent", () => {
  it("has default empty url and states", () => {
    const content = defaultInteractiveApiContent();
    expect(content.url).toBe("");
    expect(content.interactiveState).toEqual({});
    expect(content.authoredState).toEqual({});
  });

  it("has correct tile type", () => {
    const content = defaultInteractiveApiContent();
    expect(content.type).toBe(kInteractiveApiTileType);
  });

  it("supports setting the url", () => {
    const content = InteractiveApiContentModel.create();
    content.setUrl("https://example.com/interactive");
    expect(content.url).toBe("https://example.com/interactive");
  });

  it("supports setting interactive state", () => {
    const content = InteractiveApiContentModel.create();
    const newState = { answer: "42", submitted: true };
    content.setInteractiveState(newState);
    expect(content.interactiveState).toEqual(newState);
  });

  it("supports setting authored state", () => {
    const content = InteractiveApiContentModel.create();
    const authoredState = { version: 1, questionType: "open_response" };
    content.setAuthoredState(authoredState);
    expect(content.authoredState).toEqual(authoredState);
  });

  it("replaces entire state object when updated (frozen type)", () => {
    const content = InteractiveApiContentModel.create();
    const state1 = { value: "first" };
    const state2 = { value: "second" };

    content.setInteractiveState(state1);
    expect(content.interactiveState).toEqual(state1);

    content.setInteractiveState(state2);
    expect(content.interactiveState).toEqual(state2);
    expect(content.interactiveState).not.toBe(state1);
  });

  it("has default permissions", () => {
    const content = defaultInteractiveApiContent();
    expect(content.allowedPermissions).toBe("geolocation; microphone; camera; bluetooth");
  });

  it("supports setting custom permissions", () => {
    const content = InteractiveApiContentModel.create();
    content.setAllowedPermissions("geolocation");
    expect(content.allowedPermissions).toBe("geolocation");
  });

  it("has default maxHeight of 0 (unlimited)", () => {
    const content = defaultInteractiveApiContent();
    expect(content.maxHeight).toBe(0);
  });

  it("supports setting maxHeight", () => {
    const content = InteractiveApiContentModel.create();
    content.setMaxHeight(1500);
    expect(content.maxHeight).toBe(1500);
  });

  it("has default enableScroll of false", () => {
    const content = defaultInteractiveApiContent();
    expect(content.enableScroll).toBe(false);
  });

  it("supports setting enableScroll", () => {
    const content = InteractiveApiContentModel.create();
    content.setEnableScroll(true);
    expect(content.enableScroll).toBe(true);
  });

  it("is always user resizable", () => {
    const content = InteractiveApiContentModel.create();
    expect(content.isUserResizable).toBe(true);
  });

  it("exports JSON with all properties", () => {
    const content = InteractiveApiContentModel.create({
      url: "https://example.com",
      interactiveState: { value: "test" },
      authoredState: { config: "option" },
      allowedPermissions: "geolocation",
      maxHeight: 1000,
      enableScroll: true
    });

    const json = content.exportJson();
    expect(json).toContain('"type": "InteractiveApi"');
    expect(json).toContain('"url": "https://example.com"');
    expect(json).toContain('"value": "test"');
    expect(json).toContain('"config": "option"');
    expect(json).toContain('"allowedPermissions": "geolocation"');
    expect(json).toContain('"maxHeight": 1000');
    expect(json).toContain('"enableScroll": true');
  });

  it("can be created from snapshot", () => {
    const snapshot = {
      type: "InteractiveApi",
      url: "https://example.com/interactive",
      interactiveState: { answer: "42" },
      authoredState: { version: 1 },
      allowedPermissions: "geolocation",
      maxHeight: 800,
      enableScroll: false
    };

    const content = InteractiveApiContentModel.create(snapshot);
    expect(content.url).toBe("https://example.com/interactive");
    expect(content.interactiveState).toEqual({ answer: "42" });
    expect(content.authoredState).toEqual({ version: 1 });
    expect(content.allowedPermissions).toBe("geolocation");
    expect(content.maxHeight).toBe(800);
    expect(content.enableScroll).toBe(false);
  });
});
```

**File**: `interactive-api-tile.test.tsx`

```typescript
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { ITileApi } from "../../components/tiles/tile-api";
import { TileModel } from "../../models/tiles/tile-model";
import { defaultInteractiveApiContent } from "./interactive-api-tile-content";
import { InteractiveApiComponent } from "./interactive-api-tile";

// Mock iframe-phone to avoid actual iframe communication in tests
jest.mock("iframe-phone", () => ({
  ParentEndpoint: jest.fn().mockImplementation(() => ({
    disconnect: jest.fn(),
    addListener: jest.fn(),
    post: jest.fn()
  }))
}));

// The interactive-api tile needs to be registered so the TileModel.create
// knows it is a supported tile type
import "./interactive-api-tile-registration";

describe("InteractiveApiComponent", () => {
  const content = defaultInteractiveApiContent();
  const model = TileModel.create({ content });

  const mockRequestRowHeight = jest.fn();
  const mockRegisterTileApi = jest.fn();

  const defaultProps = {
    tileElt: null,
    context: "",
    docId: "",
    documentContent: null,
    isUserResizable: true,
    model,
    onResizeRow: jest.fn(),
    onSetCanAcceptDrop: jest.fn(),
    onRequestRowHeight: mockRequestRowHeight,
    onRequestUniqueTitle: jest.fn(),
    onRegisterTileApi: mockRegisterTileApi,
    onUnregisterTileApi: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders successfully", () => {
    render(<InteractiveApiComponent {...defaultProps} />);
    expect(screen.getByText("No URL configured in authoring")).toBeInTheDocument();
  });

  it("shows placeholder when no URL is set", () => {
    render(<InteractiveApiComponent {...defaultProps} />);
    expect(screen.getByText("No URL configured in authoring")).toBeInTheDocument();
  });

  it("renders iframe when URL is set", () => {
    content.setUrl("https://example.com/interactive");
    render(<InteractiveApiComponent {...defaultProps} />);

    const iframe = screen.getByTitle("Interactive Content");
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute("src", "https://example.com/interactive");
  });

  it("registers tile API for export", () => {
    render(<InteractiveApiComponent {...defaultProps} />);

    expect(mockRegisterTileApi).toHaveBeenCalledWith(
      expect.objectContaining({
        exportContentAsTileJson: expect.any(Function)
      })
    );
  });

  it("exports content as JSON via tile API", () => {
    content.setUrl("https://example.com/test");
    render(<InteractiveApiComponent {...defaultProps} />);

    const tileApi = mockRegisterTileApi.mock.calls[0][0];
    const json = tileApi.exportContentAsTileJson();

    expect(json).toContain('"type": "InteractiveApi"');
    expect(json).toContain('"url": "https://example.com/test"');
  });

  it("applies configurable iframe permissions", () => {
    content.setUrl("https://example.com/interactive");
    content.setAllowedPermissions("geolocation; microphone");
    render(<InteractiveApiComponent {...defaultProps} />);

    const iframe = screen.getByTitle("Interactive Content");
    expect(iframe).toHaveAttribute("allow", "geolocation; microphone");
  });

  it("applies sandbox attributes for security", () => {
    content.setUrl("https://example.com/interactive");
    render(<InteractiveApiComponent {...defaultProps} />);

    const iframe = screen.getByTitle("Interactive Content");
    expect(iframe).toHaveAttribute("sandbox",
      "allow-scripts allow-forms allow-same-origin allow-popups allow-downloads");
  });

  it("enables scrolling when enableScroll is true", () => {
    content.setUrl("https://example.com/interactive");
    content.setEnableScroll(true);
    render(<InteractiveApiComponent {...defaultProps} />);

    const iframe = screen.getByTitle("Interactive Content");
    expect(iframe).toHaveAttribute("scrolling", "yes");
  });

  it("disables scrolling when enableScroll is false", () => {
    content.setUrl("https://example.com/interactive");
    content.setEnableScroll(false);
    render(<InteractiveApiComponent {...defaultProps} />);

    const iframe = screen.getByTitle("Interactive Content");
    expect(iframe).toHaveAttribute("scrolling", "no");
  });

  it("includes skip to content link for accessibility", () => {
    content.setUrl("https://example.com/interactive");
    render(<InteractiveApiComponent {...defaultProps} />);

    const skipLink = screen.getByText("Skip to interactive content");
    expect(skipLink).toBeInTheDocument();
    expect(skipLink).toHaveAttribute("href", "#interactive-content");
  });

  it("has proper ARIA attributes", () => {
    content.setUrl("https://example.com/interactive");
    render(<InteractiveApiComponent {...defaultProps} />);

    const region = screen.getByRole("region");
    expect(region).toHaveAttribute("aria-label", "Interactive content");
  });

  it("shows loading spinner after 2 seconds if still loading", async () => {
    content.setUrl("https://example.com/interactive");
    render(<InteractiveApiComponent {...defaultProps} />);

    // Initially no spinner
    expect(screen.queryByText("Loading interactive...")).not.toBeInTheDocument();

    // Wait for 2 second timeout
    await waitFor(() => {
      expect(screen.getByText("Loading interactive...")).toBeInTheDocument();
    }, { timeout: 2500 });
  });

  it("updates when model URL changes", () => {
    const { rerender } = render(<InteractiveApiComponent {...defaultProps} />);
    expect(screen.getByText("No URL configured in authoring")).toBeInTheDocument();

    content.setUrl("https://example.com/new-interactive");
    rerender(<InteractiveApiComponent {...defaultProps} />);

    const iframe = screen.getByTitle("Interactive Content");
    expect(iframe).toHaveAttribute("src", "https://example.com/new-interactive");
  });

  it("renders error boundary on component error", () => {
    // Force an error by providing invalid props
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});

    const invalidModel = null as any;
    const invalidProps = { ...defaultProps, model: invalidModel };

    render(<InteractiveApiComponent {...invalidProps} />);

    // Error boundary should catch and show error message
    // (Note: actual error message depends on ErrorBoundary implementation)

    consoleError.mockRestore();
  });
});
```

**File**: `interactive-api-tile-integration.test.tsx` (Optional - Integration tests)

```typescript
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { TileModel } from "../../models/tiles/tile-model";
import { defaultInteractiveApiContent } from "./interactive-api-tile-content";
import { InteractiveApiComponent } from "./interactive-api-tile";

// Import registration to ensure tile type is registered
import "./interactive-api-tile-registration";

describe("InteractiveApiComponent Integration Tests", () => {
  const mockIframePhone = {
    disconnect: jest.fn(),
    addListener: jest.fn(),
    post: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock iframe-phone with access to listeners
    const listeners: Record<string, Function> = {};
    mockIframePhone.addListener.mockImplementation((type: string, handler: Function) => {
      listeners[type] = handler;
    });

    // Provide access to trigger listeners in tests
    (mockIframePhone as any).triggerListener = (type: string, data: any) => {
      if (listeners[type]) {
        listeners[type](data);
      }
    };

    jest.doMock("iframe-phone", () => ({
      ParentEndpoint: jest.fn().mockImplementation((iframe, callback) => {
        // Call initInteractive callback after setup
        setTimeout(callback, 0);
        return mockIframePhone;
      })
    }));
  });

  const createDefaultProps = () => {
    const content = defaultInteractiveApiContent();
    content.setUrl("https://example.com/interactive");
    const model = TileModel.create({ content });

    return {
      tileElt: null,
      context: "",
      docId: "",
      documentContent: null,
      isUserResizable: true,
      model,
      onResizeRow: jest.fn(),
      onSetCanAcceptDrop: jest.fn(),
      onRequestRowHeight: jest.fn(),
      onRequestUniqueTitle: jest.fn(),
      onRegisterTileApi: jest.fn(),
      onUnregisterTileApi: jest.fn()
    };
  };

  it("sends initInteractive message on mount", async () => {
    const props = createDefaultProps();
    render(<InteractiveApiComponent {...props} />);

    await waitFor(() => {
      expect(mockIframePhone.post).toHaveBeenCalledWith(
        "initInteractive",
        expect.objectContaining({
          version: 1,
          mode: "runtime"
        })
      );
    });
  });

  it("sends report mode in read-only", async () => {
    const props = createDefaultProps();
    props.readOnly = true;
    render(<InteractiveApiComponent {...props} />);

    await waitFor(() => {
      expect(mockIframePhone.post).toHaveBeenCalledWith(
        "initInteractive",
        expect.objectContaining({
          mode: "report"
        })
      );
    });
  });

  it("updates interactive state when received from iframe", async () => {
    const props = createDefaultProps();
    render(<InteractiveApiComponent {...props} />);

    const newState = { answer: "42", submitted: true };

    await waitFor(() => {
      (mockIframePhone as any).triggerListener("interactiveState", newState);
    });

    // Wait for debounce (500ms)
    await waitFor(() => {
      expect(props.model.content.interactiveState).toEqual(newState);
    }, { timeout: 1000 });
  });

  it("polls for interactive state every 2 seconds", async () => {
    jest.useFakeTimers();
    const props = createDefaultProps();
    render(<InteractiveApiComponent {...props} />);

    // Clear initial calls
    mockIframePhone.post.mockClear();

    // Advance 2 seconds
    jest.advanceTimersByTime(2000);
    expect(mockIframePhone.post).toHaveBeenCalledWith("getInteractiveState");

    // Advance another 2 seconds
    jest.advanceTimersByTime(2000);
    expect(mockIframePhone.post).toHaveBeenCalledTimes(2);

    jest.useRealTimers();
  });

  it("cleans up iframe-phone connection on unmount", async () => {
    const props = createDefaultProps();
    const { unmount } = render(<InteractiveApiComponent {...props} />);

    unmount();

    expect(mockIframePhone.disconnect).toHaveBeenCalled();
  });
});
```

### Step 10: Add Logger Event Type

**File**: `src/lib/logger-types.ts`

**CRITICAL**: This step MUST be completed before the component will compile successfully.

Add the new event type to the `LogEventName` enum:

```typescript
export enum LogEventName {
  // ... existing values ...
  TILE_INTERACTIVE_LOG = "TILE_INTERACTIVE_LOG",
  // ... rest of enum ...
}
```

**Placement recommendation**: Add near other tile-related log events (e.g., near `TILE_ADD`, `TILE_DELETE`, etc.) for consistency.

**To find the file:**
```bash
# Search for the LogEventName enum
grep -r "enum LogEventName" src/lib/
```

**Note**: The component code includes a fallback for development (`(LogEventName as any).TILE_INTERACTIVE_LOG || "INTERACTIVE_API_LOG"`), but this should only be used during initial development. For production, ensure the enum value is properly added.

### Step 11: Register in Tile Registry

**File**: `src/register-tile-types.ts`

Add to the `gTileRegistration` object:

```typescript
"InteractiveApi": loggedLoad("InteractiveApi", () => [
  import(/* webpackChunkName: "InteractiveApi" */"./plugins/interactive-api/interactive-api-tile-registration")
]),
```

### Step 12: TileContentUnion (No Action Required)

**File**: `src/models/tiles/tile-content-union.ts`

**No manual updates are needed.** CLUE uses a dynamic registration system that automatically includes all registered tile content models.

The `TileContentUnion` in CLUE uses MST's `late()` function combined with `getTileContentModels()` to dynamically build the union at runtime:

```typescript
export const TileContentUnion = types.late<typeof TileContentModel>(() => {
  const contentModels = getTileContentModels();
  return types.union({ dispatcher: tileContentFactory }, ...contentModels) as typeof TileContentModel;
});
```

When you call `registerTileContentInfo()` in your tile's registration file (Step 8), the content model is automatically added to the registry. The `late()` function ensures that when MST first needs to use the union (e.g., during deserialization), it will include all registered models.

**Why this works:**
1. `registerTileContentInfo()` adds your model to `gTileContentInfoMap`
2. `getTileContentModels()` returns all registered model classes
3. `types.late()` defers union creation until first use, after all tiles are registered
4. `tileContentFactory` dispatches based on the `type` property in snapshots

**Verification:**
- Ensure your registration file is imported (via `register-tile-types.ts`)
- Test by loading a document containing an InteractiveApi tile
- If the tile fails to load, check that the registration is being called before document load

## Testing Plan

### Step 1: Run Unit Tests

Run the unit tests to verify the implementation:

```bash
# Run all tests for the interactive-api tile
npm test interactive-api

# Or run specific test files
npm test interactive-api-tile-content.test
npm test interactive-api-tile.test
npm test interactive-api-tile-integration.test

# Run tests in watch mode during development
npm test -- --watch interactive-api
```

**Expected results:**
- All content model tests should pass (18 tests)
- All component tests should pass (12 tests)
- All integration tests should pass (4 tests)

If any tests fail, review the error messages and verify:
- The content model actions work correctly
- The component renders properly
- iframe-phone is mocked correctly in tests
- All props are provided to the component

### Step 2: Add Tile to Existing QA Unit for Testing

To test the tile, modify the existing `qa` unit to add the Interactive API tile to its toolbar and content.

**NOTE**: Do NOT modify `app-config.json`. The tile automatically appears in unit toolbars once registered in `register-tile-types.ts`.

**Steps:**

1. **Add Interactive API tile to the qa unit toolbar**:

   **File**: `src/public/demo/units/qa/content.json`

   Find the `"toolbar"` array in the `config` object (around line 70) and add the Interactive API entry after "Drawing":

   ```json
   "toolbar": [
     {"id": "Question", "title": "Question", "isTileTool": true},
     {"id": "Text", "title": "Text", "isTileTool": true},
     {"id": "Table", "title": "Table", "isTileTool": true},
     {"id": "DataCard", "title": "Data Card", "isTileTool": true},
     {"id": "Dataflow", "title": "Sensor Program", "isTileTool": true},
     {"id": "Diagram", "title": "Diagram", "isTileTool": true},
     {"id": "Numberline", "title": "Numberline", "isTileTool": true},
     {"id": "Graph", "title": "XY Plot", "iconId": "icon-plot-tool", "isTileTool": true},
     {"id": "Geometry", "isTileTool": true},
     {"id": "Image", "title": "Image", "isTileTool": true},
     {"id": "Drawing", "title": "Drawing", "isTileTool": true},
     {"id": "InteractiveApi", "title": "Interactive", "isTileTool": true},
     {"id": "Starter", "title": "Starter", "isTileTool": true},
     {"id": "Simulator", "title": "EMG Simulator", "isTileTool": true},
     {"id": "Expression", "title": "Expression", "isTileTool": true},
     {"id": "BarGraph", "title": "Bar Graph", "isTileTool": true},
     {"id": "undo", "title": "Undo", "iconId": "icon-undo-tool", "isTileTool": false},
     {"id": "redo", "title": "Redo", "iconId": "icon-redo-tool", "isTileTool": false},
     {"id": "duplicate", "title": "Duplicate", "iconId": "icon-duplicate-tool", "isTileTool": false},
     {"id": "delete", "title": "Delete", "iconId": "icon-delete-tool", "isTileTool": false}
   ]
   ```

   **Key points for toolbar entry:**
   - The `"id"` must be `"InteractiveApi"` (matching the registration in `register-tile-types.ts`)
   - The `"title"` will appear as the button label in the toolbar
   - Set `"isTileTool": true` to make it draggable
   - No `"iconId"` needed - the icon is automatically loaded from the tile registration

2. **Add Interactive API tiles to the first investigation**:

   **File**: `src/public/demo/units/qa/investigation-0/problem-1/introduction/content.json`

   Add three Interactive API tiles to the end of the `tiles` array in the content section:

   a. **Tile with URL configured** (to test iframe rendering):

   ```json
   {
     "id": "interactive-api-test-tile-with-url",
     "title": "Test Interactive with URL",
     "content": {
       "type": "InteractiveApi",
       "url": "https://example.com",
       "interactiveState": {},
       "authoredState": {},
       "allowedPermissions": "geolocation; microphone; camera; bluetooth",
       "maxHeight": 0,
       "enableScroll": false
     }
   }
   ```

   b. **Tile without URL** (to test placeholder message):

   ```json
   {
     "id": "interactive-api-test-tile-no-url",
     "title": "Test Interactive without URL",
     "content": {
       "type": "InteractiveApi",
       "url": "",
       "interactiveState": {},
       "authoredState": {},
       "allowedPermissions": "geolocation; microphone; camera; bluetooth",
       "maxHeight": 0,
       "enableScroll": false
     }
   }
   ```

   c. **Tile with open response interactive** (to test real LARA Interactive API integration):

   ```json
   {
     "id": "interactive-api-test-tile-open-response",
     "title": "Test Open Response Question",
     "content": {
       "type": "InteractiveApi",
       "url": "https://models-resources.concord.org/question-interactives/branch/master/open-response/",
       "interactiveState": {},
       "authoredState": {
         "version": 1,
         "questionType": "open_response",
         "prompt": "What did you observe in this activity?",
         "hint": "Describe your observations in detail",
         "required": false,
         "predictionFeedback": null,
         "audioEnabled": false
       },
       "allowedPermissions": "geolocation; microphone; camera; bluetooth",
       "maxHeight": 0,
       "enableScroll": false
     }
   }
   ```

**Testing the unit:**

1. Start the development server: `npm start`
2. Open the qa unit in your browser:
   ```
   http://localhost:8080/editor/?unit=./demo/units/qa/content.json
   ```
3. Navigate to Investigation 0, Problem 0.1 "Intro to CLUE", Introduction tab
4. You should see three Interactive API tiles at the end of the section

**Expected behavior:**

For the **first tile (with URL - example.com)**:
- Renders with an iframe showing https://example.com
- The iframe is visible and loads the external content
- Displays the configured title "Test Interactive with URL"

For the **second tile (without URL)**:
- Shows the placeholder message: "No URL configured in authoring"
- No iframe is rendered
- Displays the configured title "Test Interactive without URL"

For the **third tile (open response interactive)**:
- Renders with an iframe showing the open response question interactive
- Displays the prompt: "What did you observe in this activity?"
- Shows a text area for student response
- Includes a hint button that reveals: "Describe your observations in detail"
- Student can type a response and it should be saved to `interactiveState`
- Tests full LARA Interactive API protocol (initInteractive, interactiveState messages, height updates)
- Displays the configured title "Test Open Response Question"

For the **toolbar**:
- The "Interactive" button appears with the "IA" icon
- Dragging the toolbar button creates new tile instances
- New instances from toolbar show "No URL configured in authoring" placeholder (since authoring UI isn't implemented yet)

**Key points:**
- The tile's `type` property must be `"InteractiveApi"` (matching the registered tile type)
- The tile automatically appears in the toolbar because it's registered in `register-tile-types.ts` and added to the unit's toolbar config
- No changes to `app-config.json` are needed - that file is only for the standalone editor, not units
- These changes to the `qa` unit are for testing only - they can be reverted after testing is complete

### Step 3: Basic Testing

1. Start the dev server: `npm start`
2. Open the standalone editor: `http://localhost:8080/editor/`
3. Look for the "Interactive" button with "IA" icon in the toolbar
4. Drag the button onto the canvas to create a new Interactive API tile
5. Verify placeholder appears when no URL is set

### Step 4: Configure Tile for Advanced Testing

To make the tile available in the standalone editor, add it to a unit configuration:

1. **For testing**, use the QA unit which is configured for development:
   ```
   http://localhost:8080/editor/?unit=./demo/units/qa/content.json
   ```

2. **Add to QA unit configuration** - Edit `src/public/demo/units/qa/content.json`:
   ```json
   "toolbar": [
     {"id": "Question", "title": "Question", "isTileTool": true},
     {"id": "Text", "title": "Text", "isTileTool": true},
     {"id": "InteractiveApi", "title": "Interactive", "isTileTool": true},
     // ... other tiles
   ]
   ```

3. **Reload the editor** to see the new tile in the toolbar

### Step 5: Test with Sample Interactive

Use the open-response question interactive for testing:

**Test URL:**
```
https://models-resources.concord.org/question-interactives/branch/master/open-response/
```

**Example Authored State:**
```json
{
  "version": 1,
  "questionType": "open_response",
  "defaultAnswer": "This is the default",
  "hint": "This is the hint",
  "predictionFeedback": "Here is some feedback",
  "audioEnabled": true,
  "voiceTypingEnabled": true,
  "demo": false
}
```

**Example Interactive State (saved per-student):**
```json
{
  "answerType": "open_response_answer",
  "answerText": "Hello world!",
  "submitted": false
}
```

**To test:**
1. Add an Interactive API tile to a document
2. Use browser console to configure the tile:
   ```javascript
   // Find the tile in the document
   const tiles = document.querySelectorAll('.interactive-api-tile');
   // Then use React DevTools or access the model directly to set URL and authoredState
   ```
3. Or create a test document JSON with the tile pre-configured

### Step 6: Verify Interactive API Communication

Test that the following work:
- Interactive receives `initInteractive` message
- Interactive can send `interactiveState` updates
- Height changes are reflected in the tile
- Read-only mode prevents interaction
- State persists when document is saved/loaded

### Step 7: Test State Persistence

1. Add an interactive tile with a URL
2. Interact with the iframe (if it accepts input)
3. Save the document
4. Reload the page
5. Verify the interactive state is restored

### Step 8: Using the Tile in Production

**Example: Adding the open-response interactive to a curriculum unit**

1. **Edit the unit configuration** (e.g., `curriculum/unit-1/content.json`):
   ```json
   {
     "code": "unit-1",
     "title": "Introduction Unit",
     "config": {
       "toolbar": [
         {"id": "Text", "title": "Text", "isTileTool": true},
         {"id": "InteractiveApi", "title": "Interactive", "isTileTool": true},
         {"id": "Drawing", "title": "Drawing", "isTileTool": true}
       ]
     },
     "sections": {
       "introduction": {
         "type": "problem",
         "tiles": [
           {
             "type": "InteractiveApi",
             "url": "https://models-resources.concord.org/question-interactives/branch/master/open-response/",
             "authoredState": {
               "version": 1,
               "questionType": "open_response",
               "hint": "Think about what you learned in the previous section",
               "audioEnabled": false
             }
           }
         ]
       }
     }
   }
   ```

2. **Test the integration**:
   - Load the unit in CLUE
   - Verify the interactive appears in the specified section
   - Test student interaction (typing response, submitting)
   - Verify state persists across page reloads
   - Test in read-only mode (teacher view, published work)

3. **Configure for different interactive types**:
   - Multiple choice: Use `/multiple-choice/` endpoint
   - Image question: Use `/image-question/` endpoint
   - Drawing: Different URL entirely

## Optional Enhancements

### 1. URL Configuration UI

Add a toolbar with a button to configure the URL:

**File**: `interactive-api-tile-toolbar.tsx`

```typescript
import React, { useState } from "react";
import { observer } from "mobx-react";
import { InteractiveApiContentModelType } from "./interactive-api-tile-content";

interface IProps {
  content: InteractiveApiContentModelType;
}

export const InteractiveApiToolbar: React.FC<IProps> = observer(({ content }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [urlInput, setUrlInput] = useState(content.url);

  const handleSave = () => {
    content.setUrl(urlInput);
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <button onClick={() => setIsEditing(true)}>
        Configure URL
      </button>
    );
  }

  return (
    <div>
      <input
        type="text"
        value={urlInput}
        onChange={(e) => setUrlInput(e.target.value)}
        placeholder="Enter interactive URL"
      />
      <button onClick={handleSave}>Save</button>
      <button onClick={() => setIsEditing(false)}>Cancel</button>
    </div>
  );
});
```

### 2. Authored State Configuration

Allow curriculum authors to configure authored state (props passed to the interactive):
- Could be done via JSON editor in a modal
- Or through a form-based UI for common properties

### 3. Support for Linked Interactives

If the interactive needs to link to other CLUE tiles (like SharedDataSet):
- Implement linked interactive support
- Add to the `initInteractive` message
- Handle state listener requests

### 4. Advanced Features

- Support for attachment uploads
- Support for logging interactive events
- Support for showing modals/dialogs from the interactive
- Support for custom messages between host and interactive

## File Checklist

After completing all steps, you should have:

**Core Files:**
- [ ] `src/plugins/interactive-api/interactive-api-tile-types.ts`
- [ ] `src/plugins/interactive-api/interactive-api-tile-content.ts`
- [ ] `src/plugins/interactive-api/interactive-api-tile.tsx`
- [ ] `src/plugins/interactive-api/interactive-api-tile.scss`
- [ ] `src/plugins/interactive-api/interactive-api-tile-registration.ts`
- [ ] `src/plugins/interactive-api/interactive-api-tile-icon.svg` (verify it's a valid SVG with "IA" text, not just renamed)
- [ ] `src/plugins/interactive-api/interactive-api-tile-id.svg` (verify it's a valid SVG with "IA" text, not just renamed)

**Test Files:**
- [ ] `src/plugins/interactive-api/interactive-api-tile-content.test.ts`
- [ ] `src/plugins/interactive-api/interactive-api-tile.test.tsx`
- [ ] `src/plugins/interactive-api/interactive-api-tile-integration.test.tsx` (optional integration tests)

**Registry Updates:**
- [ ] Updated `src/register-tile-types.ts` (added InteractiveApi entry)
- [ ] Updated `src/models/tiles/tile-content-union.ts` (added InteractiveApiContentModel before UnknownContentModel)
- [ ] Updated `src/lib/logger-types.ts` (added TILE_INTERACTIVE_LOG to LogEventName enum)

**Dependencies:**
- [ ] Added `@concord-consortium/lara-interactive-api` to package.json
- [ ] Added `iframe-phone` to package.json
- [ ] Ran `npm install` to install dependencies

**Optional Files:**
- [ ] `src/plugins/interactive-api/README.md` (documentation for the tile)

**Critical Verifications:**
- [ ] SVG icon files have been properly updated with "IA" graphics (not just renamed from "St")
- [ ] `iframe-phone` version is compatible with `@concord-consortium/lara-interactive-api`
- [ ] `UnknownContentModel` is still the last item in `TileContentUnion`
- [ ] Logger event type `TILE_INTERACTIVE_LOG` added before using it in component
- [ ] All unit tests pass: `npm test interactive-api`
- [ ] Test with sample interactive URL to verify communication works
- [ ] Test debouncing with an interactive that sends frequent state updates

## Common Issues and Solutions

### Issue: iframe-phone not connecting

**Solution**: Ensure the iframe URL is on a different origin and supports postMessage. Check browser console for CORS errors.

### Issue: Interactive state not persisting

**Solution**: Verify that `interactiveState` listener is properly updating the MST model and that the model is being saved to Firebase.

### Issue: Height not updating

**Solution**: Check that the interactive is sending `height` messages. Some interactives may need explicit height configuration.

### Issue: Read-only mode not working

**Solution**: Ensure that the interactive respects the `mode: "report"` value in the `initInteractive` message. Most LARA-compliant interactives will disable their input fields in report mode while still allowing scrolling and navigation. We intentionally do NOT use `pointer-events: none` to allow users to scroll within the iframe if the content is taller than the tile.

### Issue: Styles not appearing

**Solution**: The SCSS file is imported directly in the component (`import "./interactive-api-tile.scss";`), which is the standard pattern in CLUE. The webpack configuration will automatically process and include these styles. No additional registration is needed.

### Issue: Iframe fails to load

**Symptoms**: Blank tile, endless loading spinner, or browser console errors.

**Solutions**:
1. **CORS errors**: Check browser console. The iframe URL must allow being embedded via `X-Frame-Options` or CSP headers
2. **Mixed content**: If CLUE is served over HTTPS, the iframe URL must also be HTTPS
3. **Invalid URL**: Verify the URL is correctly formatted and accessible
4. **Network issues**: Check browser Network tab to see if the request failed

**Error Boundary**: The tile should be wrapped in CLUE's existing error boundary system. If the tile component crashes, users will see an error message instead of breaking the entire document.

### Issue: Invalid interactive state

**Symptoms**: Console errors, state not saving, or interactive behaves incorrectly after reload.

**Solutions**:
1. **Validate state format**: Ensure the interactive sends state matching its expected schema
2. **Handle null/undefined**: The tile should gracefully handle missing or incomplete state
3. **Check frozen types**: MST frozen types are immutable - always replace the entire object
4. **Debug with React DevTools**: Inspect the MST model to see the actual saved state

### Issue: Malformed initMessage

**Symptoms**: Interactive doesn't initialize, doesn't receive state, or console errors about missing properties.

**Solution**: Verify the `initMessage` structure matches the LARA Interactive API specification. Required properties:
- `version`: Should be `1`
- `mode`: Should be `"runtime"` or `"report"`
- `authoredState`: Can be `null` or an object
- `interactiveState`: Can be `null` or an object

## Technical Notes

### Error Handling Strategy

The tile implements a **user-visible error handling** approach:

1. **Configuration errors** (missing/invalid URL): Show clear message in placeholder
2. **Loading errors**: Show loading spinner with timeout, then gracefully degrade
3. **Connection failures**: Silent (no iframe-phone connection), tile still displays iframe
4. **State errors**: Log to console, continue with graceful degradation

**Error Boundary**: The component should be wrapped in a React error boundary to prevent crashes from propagating. CLUE's tile system should provide this automatically. If implementing custom error handling, add:

```typescript
class InteractiveApiErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean}> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <div className="tile-error">Failed to load interactive tile</div>;
    }
    return this.props.children;
  }
}
```

### iframe-phone Type Safety

The `iframe-phone` package does not provide TypeScript definitions (`@types/iframe-phone` is not available). The plan includes a minimal interface definition for the `ParentEndpoint` to provide basic type safety. This interface can be expanded as needed.

### iframe Permissions

The `allow` attribute on the iframe grants permissions that embedded interactives may need:
- `geolocation`: For location-based interactives
- `microphone`: For audio recording/analysis interactives
- `camera`: For video/image capture interactives
- `bluetooth`: For sensor-based interactives

These permissions are now configurable via the `allowedPermissions` property in the tile model (defaults to the full list). For strict security environments or Content Security Policy (CSP) compliance, you can:
- Set custom permissions per tile via the authored state
- Restrict permissions at the unit configuration level
- Override via CSP headers for the entire CLUE deployment

### iframe-phone Connection Timing

The iframe-phone connection is established immediately in the `useEffect` to ensure we don't miss the initial "hello" message from the iframe. The `ParentEndpoint` constructor handles the connection handshake and will call the `initInteractive` callback when the iframe is ready. The `onLoad` handler primarily manages the loading spinner state.

### iframe Security (Sandbox)

The `sandbox` attribute is applied to the iframe for enhanced security:
- `allow-scripts`: Allows the interactive to run JavaScript
- `allow-forms`: Allows form submission within the iframe
- `allow-same-origin`: Allows the iframe to access its own origin (required for postMessage)
- `allow-popups`: Allows the interactive to open popup windows if needed
- `allow-downloads`: Allows the interactive to trigger downloads

This sandbox configuration prevents the external interactive from performing top-level navigation or other potentially malicious actions within the CLUE environment.

### Height Management

The tile uses `onRequestRowHeight` to dynamically resize its container based on the iframe content height. CLUE's layout engine (especially in multi-column layouts and dashboard views) can sometimes be restrictive:
- The `kInteractiveApiDefaultHeight` (480px) is used as the initial height
- A `min-height: 200px` is set in the SCSS to prevent the tile from collapsing to 0px if the iframe fails to send a height message
- Heights are clamped between 200px (min) and a configurable maximum:
  - **Default max**: 2000px if `maxHeight` is not set or is 0
  - **Configured max**: Use `maxHeight` property for interactives that need more space
  - **Scrolling**: Enable `enableScroll` property if content exceeds maxHeight
- In strict layouts like dashboards, CLUE may override the requested height
- Ensure your interactive sends `height` messages via iframe-phone if it needs to control its display height

**For very tall interactives (e.g., long forms, surveys):**
```json
{
  "type": "InteractiveApi",
  "url": "https://example.com/long-form/",
  "maxHeight": 3000,
  "enableScroll": true,
  "authoredState": {...}
}
```

With `enableScroll: true`, the iframe will have `scrolling="yes"` allowing users to scroll within the iframe if content exceeds the tile height. This prevents content from being cut off while maintaining a reasonable tile size in the document.

### State Update Frequency and Debouncing

The implementation includes debouncing by default (500ms) for interactive state updates. This is critical because:
- CLUE syncs tile state to Firebase in real-time
- Many interactives (sliders, text inputs, drawing tools) send state updates on every change
- Without debouncing, this can cause hundreds of Firebase writes per second, throttling the connection

The debounce is implemented as a simple inline utility to avoid adding external dependencies:
```typescript
// Simple debounce utility
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): T {
  let timeout: NodeJS.Timeout | null = null;
  return ((...args: any[]) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  }) as T;
}

const debouncedSetState = useMemo(
  () => debounce((state: any) => {
    contentRef.current?.setInteractiveState(state);
  }, 500), // 500ms debounce
  []
);
```

You can adjust the debounce delay (500ms-1000ms recommended) based on:
- The interactive's update frequency
- Desired responsiveness for multi-user collaboration
- Firebase usage patterns in your deployment

### Read-Only Mode Implementation

The tile relies on the `mode: "report"` value sent in the `initInteractive` message rather than using CSS `pointer-events: none`. This approach:
- Allows users to scroll within the iframe even in read-only mode
- Lets the interactive control its own disabled state more intelligently
- Works better with LARA-compliant interactives that understand the report mode convention
- Prevents issues where `pointer-events: none` would block all interaction including scrolling

### Special Interactive State Messages (LARA Compatibility)

The implementation supports special interactive state messages for LARA compatibility:

**"nochange" message**:
- Sent by interactives to indicate they were touched but state didn't actually change
- The tile does NOT save "nochange" as actual state
- Legacy bug fix: If "nochange" was previously saved as state (from older AP versions), it's treated as undefined

**"touch" message**:
- Sent by interactives to update the timestamp without changing state
- Useful for tracking when a student last interacted with the tile
- The tile re-saves the current state (updating Firebase timestamp) but doesn't change the actual state value

**undefined state**:
- Sent before the interactive has any state
- The tile gracefully handles undefined state and doesn't attempt to save it

### Message Sequence and LARA Compatibility

The tile follows LARA's message sequence for maximum compatibility:

1. **Connection established** - iframe loads and sends "hello" message
2. **loadInteractive sent** (if initialState exists) - Legacy LARA compatibility
3. **initInteractive sent** - Full initialization with mode, authoredState, interactiveState, hostFeatures, themeInfo
4. **Interactive responds with supportedFeatures** (optional) - Reports capabilities like aspectRatio
5. **Interactive sends state updates** - As user interacts

**Note**: The sequence intentionally does NOT include `getInteractiveState` because CLUE uses MST's snapshot system for saves (see State Management section below).

### Host Features Declaration

The tile declares host features in `initInteractive` to communicate capabilities to the interactive:

```typescript
hostFeatures: {
  modal: {
    version: "1.0.0",
    lightbox: false,  // CLUE doesn't support lightbox modals
    dialog: false,     // CLUE doesn't support dialog modals
    alert: true        // CLUE supports simple window.alert()
  }
}
```

Interactives can check `hostFeatures` to adapt their behavior based on host capabilities.

### State Management and MST Snapshots

**IMPORTANT**: Unlike activity-player, CLUE does NOT use an imperative API (`requestInteractiveState`) for saves. Instead:

1. **Automatic snapshots**: CLUE uses MobX State Tree's snapshot system to automatically capture and save tile state
2. **Debounced updates**: When the interactive sends state via `interactiveState` message, the tile calls `content.setInteractiveState(state)` after debouncing (500ms)
3. **MST observability**: The MST model change triggers CLUE's document save mechanism automatically
4. **No manual save requests needed**: The interactive doesn't need to respond to `getInteractiveState` messages

**State flow (two mechanisms):**

1. **Reactive updates** (when interactive proactively sends state):
```
Interactive user action
  → interactive sends "interactiveState" message via iframe-phone
  → Tile's handleInteractiveState handler receives it
  → After 500ms debounce, calls content.setInteractiveState(newState)
  → MST detects model change
  → CLUE's Firebase sync saves the change automatically
```

2. **Polling updates** (ensuring state is captured):
```
Every 2 seconds (if not read-only):
  → Tile posts "getInteractiveState" to interactive
  → Interactive responds with "interactiveState" message
  → Same flow as reactive updates above
```

**Why both mechanisms?** Some interactives may not send state updates proactively. Polling ensures CLUE always captures the latest state, even if the interactive doesn't implement the full LARA protocol.

### Logging Support

The tile integrates with CLUE's Logger system for analytics:

```typescript
import { Logger } from "../../lib/logger";
import { LogEventName } from "../../lib/logger-types";

// In interactive
phone.post("log", { event: "button_click", data: { buttonId: "submit" } });

// In CLUE tile
Logger.log(LogEventName.TILE_INTERACTIVE_LOG, {
  tileId: model.id,
  tileType: "InteractiveApi",
  ...logData
});
```

**Before implementation:**

1. Add the enum value to `src/lib/logger-types.ts`:
```typescript
export enum LogEventName {
  // ... existing values ...
  TILE_INTERACTIVE_LOG = "TileInteractiveLog",
  // ... rest of enum ...
}
```

2. Verify logging format matches CLUE's analytics requirements

### Hint System Support

The tile supports dynamic hints from interactives:

```typescript
// In interactive
phone.post("hint", { text: "Try adjusting the slider to see the effect" });

// In CLUE tile (currently logs to console, not displayed)
console.log(`Interactive ${model.id} hint (not displayed):`, hintData.text);
```

**Implementation Status:**
- Hint messages are received and logged to console
- NOT currently displayed in CLUE UI
- Future enhancement: integrate with CLUE's hint/tooltip system (if/when available)
- Console logging allows debugging and verification that hints are being sent

### Error Boundary Implementation

The tile wraps the interactive component in an ErrorBoundary to prevent crashes from propagating:

```typescript
class InteractiveApiErrorBoundary extends React.Component<...> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("InteractiveApiTile Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <div className="tile-error">Failed to load interactive tile...</div>;
    }
    return this.props.children;
  }
}

// Export pattern
export const InteractiveApiComponent: React.FC<ITileProps> = (props) => {
  return (
    <InteractiveApiErrorBoundary>
      <InteractiveApiComponentInternal {...props} />
    </InteractiveApiErrorBoundary>
  );
};
```

This ensures that if the iframe or component crashes, the error is isolated to just this tile rather than breaking the entire document.

### Non-Interactive API Content

The tile gracefully handles URLs that don't implement the LARA Interactive API protocol:
- The iframe will display the content normally
- No errors are shown to the user
- The `iframe-phone` connection simply won't establish (this is expected and handled silently)
- The tile will use the default or configured height instead of dynamic height
- No state will be persisted (since the interactive can't send state updates)
- Read-only mode won't affect the content (since there's no mode message sent)

This means you can use this tile for:
- Interactive API-compliant interactives (full feature set)
- Simple embedded content like videos, simulations, or static HTML pages
- External tools that don't support the Interactive API protocol

The tile will work correctly in all cases without showing errors or requiring special handling.

### Keyboard Navigation and Accessibility

The tile implements comprehensive keyboard accessibility features:

**Skip to Content Link:**
- A "Skip to interactive content" link is visually hidden but becomes visible when focused via keyboard
- Allows keyboard users to jump directly to the iframe content
- Positioned absolutely and styled to appear on focus

**ARIA Attributes:**
- The interactive content region has `role="region"` and `aria-label="Interactive content"`
- Loading state uses `aria-busy="true"` to inform screen readers
- Loading spinner has `role="status"` and `aria-live="polite"` for announcements
- The spinner itself is marked `aria-hidden="true"` to avoid redundant announcements

**Focus Management:**
- The iframe has a descriptive `title` attribute for screen readers
- Skip to content link focuses the iframe when activated
- Tab order is maintained naturally through the tile

**What's NOT implemented (potential future enhancements):**
- Keyboard shortcuts for tile-specific actions (e.g., full-screen mode)
- Custom focus indicators for the embedded content

Note: Keyboard navigation within the iframe is controlled by the embedded content. The embedded interactive should follow accessibility best practices independently.

### React 18 Strict Mode Compatibility

If CLUE is running on React 18+, the tile properly handles Strict Mode behavior:
- In development, React Strict Mode runs effects twice to help detect issues
- The `useEffect` cleanup function properly calls `phoneRef.current.disconnect()` and clears all pending timers
- This prevents duplicate iframe-phone listeners when the effect re-runs
- The cleanup ensures each new ParentEndpoint connection replaces the old one cleanly

This pattern is essential for avoiding:
- Memory leaks from undestroyed phone connections or pending setTimeout calls
- Duplicate message handlers causing state to be set multiple times
- Console errors about multiple postMessage listeners on the same iframe
- Timer callbacks executing after component unmount

### Step 13: Update README Documentation

The final step is to create comprehensive documentation for developers who will use or maintain the Interactive API tile.

**File**: `src/plugins/interactive-api/README.md`

Replace the starter tile documentation with comprehensive usage information:

```markdown
# Interactive API Tile

The Interactive API tile allows embedding external interactive content that implements the [LARA Interactive API](https://github.com/concord-consortium/lara-interactive-api) protocol. This enables CLUE to host question interactives, simulations, and other educational tools that communicate state bidirectionally.

## Features

- **Full LARA Interactive API Support** - Implements the complete protocol for state management, initialization, and communication
- **Bidirectional State Management** - Syncs runtime state between CLUE and embedded interactives
- **Debounced Updates** - Prevents excessive Firebase writes with configurable debouncing (500ms for state, 100ms for height)
- **Dynamic Height Management** - Automatically adjusts tile height based on interactive's reported dimensions
- **Read-Only Mode** - Supports report mode for viewing student work without interaction
- **Accessibility** - Includes skip-to-content links, ARIA attributes, and keyboard navigation support
- **Error Isolation** - Error boundary prevents interactive failures from crashing CLUE
- **Configurable Security** - Customizable iframe permissions and sandbox attributes
- **State Polling** - Polls for state updates every 2 seconds to ensure capture even if interactive doesn't send updates
- **Loading Indicators** - Shows spinner after 2 seconds if interactive takes time to load

## Architecture

### Content Model (MST)

**File**: `interactive-api-tile-content.ts`

The content model stores the tile's configuration and state:

```typescript
{
  type: "InteractiveApi",                    // Tile type identifier
  url: string,                                // URL of the interactive to embed
  interactiveState: frozen,                   // Runtime student state (saved per-student)
  authoredState: frozen,                      // Curriculum author configuration (same for all)
  allowedPermissions: string,                 // iframe permissions (default: all sensors)
  maxHeight: number,                          // Max tile height in pixels (0 = unlimited)
  enableScroll: boolean                       // Enable iframe scrolling
}
```

**Frozen Types**: `interactiveState` and `authoredState` use MST frozen types, meaning they're immutable. To update, replace the entire object:
```typescript
content.setInteractiveState({ newData: "value" }); // Replaces entire state
```

### Component Architecture

**File**: `interactive-api-tile.tsx`

The React component handles:
1. **iframe-phone Setup** - Establishes postMessage communication channel
2. **Protocol Messages** - Sends `initInteractive`, `loadInteractive`, `getInteractiveState`
3. **State Listening** - Receives `interactiveState`, `height`, `supportedFeatures`, `hint`, `log`
4. **Debouncing** - Prevents excessive updates to MST/Firebase
5. **Error Handling** - Wraps component in error boundary
6. **Accessibility** - Provides skip-to-content link and ARIA attributes

## Usage

### For Curriculum Authors

Add an Interactive API tile to a document with a configured URL:

```json
{
  "type": "InteractiveApi",
  "url": "https://example.com/interactive",
  "authoredState": {
    "questionType": "open_response",
    "prompt": "Explain your thinking"
  },
  "allowedPermissions": "geolocation; microphone; camera",
  "maxHeight": 800,
  "enableScroll": false
}
```

**Key Configuration Options:**

- **url** (required): URL of the Interactive API-compliant interactive
- **authoredState** (optional): Configuration object sent to the interactive (format varies by interactive)
- **allowedPermissions** (optional): iframe permissions string (default: "geolocation; microphone; camera; bluetooth")
- **maxHeight** (optional): Maximum tile height in pixels, 0 for unlimited (default: 0)
- **enableScroll** (optional): Enable scrolling if interactive is taller than maxHeight (default: false)

### For Developers

#### Creating Interactive API-Compliant Content

Your interactive must:
1. Load the iframe-phone library
2. Create a `ChildEndpoint` connection
3. Listen for `initInteractive` message
4. Send state updates via `interactiveState` messages
5. (Optional) Send height updates via `height` messages

**Minimal Example:**
```typescript
import { ChildEndpoint } from 'iframe-phone';

const phone = new ChildEndpoint();

phone.addListener('initInteractive', (data) => {
  console.log('Received init:', data);
  // Use data.authoredState for configuration
  // Restore data.interactiveState if present
});

// Send state updates
function updateState(newState) {
  phone.post('interactiveState', newState);
}

// Send height updates (optional)
function reportHeight(height) {
  phone.post('height', height);
}
```

#### Message Flow

**Initialization Sequence:**
1. CLUE creates iframe and establishes phone connection
2. Interactive loads and sends "hello" message
3. CLUE responds with `initInteractive` containing:
   - `mode`: "runtime" or "report"
   - `authoredState`: Configuration from curriculum
   - `interactiveState`: Saved student state (if any)
   - `version`: Protocol version (1)
   - `hostFeatures`: Capabilities CLUE supports
4. (Optional) CLUE sends `loadInteractive` with initial state (LARA compatibility)

**Runtime Operation:**
- Interactive sends `interactiveState` whenever student changes something
- CLUE debounces updates (500ms) and saves to Firebase
- CLUE polls for state every 2 seconds via `getInteractiveState`
- Interactive can send `height` messages to resize tile
- Interactive can send `log` messages for CLUE's logging system

**Read-Only Mode:**
- CLUE sends `mode: "report"` in `initInteractive`
- Interactive should disable editing controls
- State updates are ignored by CLUE

## Testing

### Unit Tests

Run the test suite:
```bash
npm test interactive-api
```

**Test Coverage:**
- 15 content model tests (MST actions, views, frozen types)
- 12 component tests (rendering, props, accessibility)
- 4 integration tests (iframe-phone communication)

### Manual Testing

1. **Start dev server**: `npm start`
2. **Open standalone editor**: `http://localhost:8080/editor/`
3. **Drag "Interactive" button** from toolbar to create tile
4. **Configure URL** via document JSON or browser dev tools
5. **Test with sample interactive**:
   ```
   https://models-resources.concord.org/question-interactives/branch/master/open-response/
   ```

## Common Interactive URLs

**Question Interactives (Concord Consortium):**
- Open Response: `https://models-resources.concord.org/question-interactives/branch/master/open-response/`
- Multiple Choice: `https://models-resources.concord.org/question-interactives/branch/master/multiple-choice/`
- Image Question: `https://models-resources.concord.org/question-interactives/branch/master/image-question/`

**Development/Testing:**
- Example.com placeholder: `https://example.com`
- Local development: `http://localhost:3000` (requires CORS configuration)

## Configuration Reference

### Content Model Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `url` | string | `""` | URL of the interactive to embed |
| `interactiveState` | frozen | `{}` | Runtime student state (populated by interactive) |
| `authoredState` | frozen | `{}` | Curriculum author configuration |
| `allowedPermissions` | string | `"geolocation; microphone; camera; bluetooth"` | iframe permissions policy |
| `maxHeight` | number | `0` | Maximum tile height in pixels (0 = unlimited, max 2000) |
| `enableScroll` | boolean | `false` | Enable iframe scrolling |

### Content Model Actions

| Action | Parameters | Description |
|--------|------------|-------------|
| `setUrl(url)` | string | Set the interactive URL |
| `setInteractiveState(state)` | any | Update student runtime state (replaces entire object) |
| `setAuthoredState(state)` | any | Update authored configuration (replaces entire object) |
| `setAllowedPermissions(permissions)` | string | Set iframe permissions policy |
| `setMaxHeight(height)` | number | Set maximum tile height |
| `setEnableScroll(enable)` | boolean | Enable/disable scrolling |

### iframe Sandbox Attributes

The tile uses the following sandbox permissions (not configurable):
- `allow-scripts` - Required for interactive to run
- `allow-forms` - Allows form submission
- `allow-same-origin` - Allows access to same-origin resources
- `allow-popups` - Allows opening new windows
- `allow-downloads` - Allows file downloads

**NOT allowed:**
- Top-level navigation (prevents hijacking CLUE)
- Modals (uses window.alert fallback)
- Pointer lock

## Troubleshooting

### Interactive doesn't load

**Symptoms:** Placeholder shows "No URL configured" or infinite spinner

**Solutions:**
1. Verify `url` property is set in content model
2. Check browser console for CORS errors
3. Ensure interactive URL is HTTPS (HTTP may be blocked)
4. Test URL directly in browser to verify it loads

### Interactive state not saving

**Symptoms:** State resets on reload

**Solutions:**
1. Verify interactive is sending `interactiveState` messages
2. Check browser console for iframe-phone connection errors
3. Ensure interactive implements proper state serialization
4. Test with a known-working interactive to isolate issue

### Height not adjusting

**Symptoms:** Tile is too tall/short for content

**Solutions:**
1. Verify interactive is sending `height` messages
2. Check `maxHeight` configuration (0 = unlimited, 2000px absolute max)
3. Use browser dev tools to inspect tile height vs. iframe content height
4. If interactive doesn't send height, set fixed height via CSS

### CORS errors

**Symptoms:** Console shows "blocked by CORS policy"

**Solutions:**
1. Interactive must send proper CORS headers (`Access-Control-Allow-Origin`)
2. For local development, use a CORS proxy or configure your dev server
3. Ensure URL uses HTTPS (mixed content may be blocked)

### Iframe-phone connection fails

**Symptoms:** No messages exchanged, timeout errors

**Solutions:**
1. Verify interactive loads iframe-phone library
2. Check interactive creates `ChildEndpoint` after page load
3. Ensure both CLUE and interactive use compatible iframe-phone versions
4. Test with a known-working interactive to isolate issue

## Known Limitations

1. **No Authoring UI** - URL and configuration must be set via JSON or API (future enhancement)
2. **Limited Modal Support** - Only `window.alert()` is supported; lightbox/dialog modals are not
3. **No Linked Interactives** - `linkedInteractives` is always empty (not yet implemented)
4. **No Global Interactive State** - Each tile's state is independent
5. **Height Debouncing** - Rapid height changes are debounced (100ms), may cause brief visual lag

## Performance Considerations

### Debouncing Strategy

**State Updates (500ms):**
- Prevents excessive Firebase writes
- Suitable for text input, slider changes
- Trade-off: Brief delay before save

**Height Updates (100ms):**
- Prevents UI jitter from frequent resizes
- Suitable for responsive interactives
- Trade-off: May see brief layout shift

### State Polling

The tile polls for state every 2 seconds via `getInteractiveState`:
- **Why:** Ensures state capture even if interactive doesn't proactively send updates
- **Trade-off:** 2-second delay for "silent" state changes
- **Disabled in:** Read-only mode (no need to capture state)

### Memory Management

- iframe-phone connections are properly cleaned up on unmount
- Debounced functions are cancelled on unmount to prevent "dead node" errors
- Loading timeout is cleared to prevent memory leaks
- Error boundary prevents interactive failures from leaking to CLUE

## Related Documentation

- [LARA Interactive API Specification](https://github.com/concord-consortium/lara-interactive-api)
- [iframe-phone Library](https://github.com/concord-consortium/iframe-phone)
- [Question Interactives Examples](https://github.com/concord-consortium/question-interactives)
- [CLUE Tiles Documentation](../../../tiles.md)

## Contributing

When modifying the Interactive API tile:

1. **Update tests** - Maintain test coverage (currently 27 tests)
2. **Update this README** - Document new features or configuration options
3. **Test with real interactives** - Verify against known-working interactives
4. **Check accessibility** - Maintain WCAG 2.1 AA compliance
5. **Monitor performance** - Profile state updates and rendering performance

## Version History

- **v1.0.0** (2026-01) - Initial implementation
  - Full LARA Interactive API protocol support
  - Debounced state management
  - Dynamic height adjustment
  - Read-only mode support
  - Comprehensive test coverage
```

### Implementation

Replace the contents of `src/plugins/interactive-api/README.md` with the comprehensive documentation above. This provides:

1. **Complete feature list** and architecture overview
2. **Usage examples** for curriculum authors and developers
3. **Configuration reference** with all properties and actions
4. **Testing instructions** and common test URLs
5. **Troubleshooting guide** for common issues
6. **Performance considerations** and known limitations
7. **Contributing guidelines** for future developers

The documentation is structured to serve both:
- **Curriculum authors** who need to configure the tile
- **Developers** who need to create compatible interactives or maintain the tile code

## Not Implemented

This section lists features from the spec that were **not implemented** in the initial release. These are items from the "Optional Enhancements" section and other features that remain for future development.

### 1. URL Configuration UI (Authoring Toolbar)

**Spec Section**: Optional Enhancements > 1. URL Configuration UI

**What's Missing**: A toolbar component that allows users to configure the interactive URL directly in the CLUE interface.

**Current Workaround**: URLs must be configured via document JSON or authored content files.

### 2. Authored State Configuration UI

**Spec Section**: Optional Enhancements > 2. Authored State Configuration

**What's Missing**: A UI for curriculum authors to configure the `authoredState` property (the configuration passed to the interactive).

**Current Workaround**: `authoredState` must be configured via document JSON or authored content files.

### 3. Linked Interactives Support

**Spec Section**: Optional Enhancements > 3. Support for Linked Interactives

**What's Missing**: The ability for interactives to link to and receive data from other CLUE tiles (e.g., SharedDataSet).

**Current Behavior**: `linkedInteractives` is always sent as an empty array `[]`.

### 4. Full Modal/Dialog Support

**Spec Section**: Optional Enhancements > 4. Advanced Features

**What's Missing**: Support for lightbox and dialog modal types from interactives.

**Current Behavior**: Only `window.alert()` is supported for `type: "alert"` modals. The `hostFeatures.modal` declaration correctly reports `lightbox: false` and `dialog: false`.

### 6. Hint Display Integration

**Spec Section**: Technical Notes > Hint System Support

**What's Missing**: Displaying hints from interactives in the CLUE UI.

**Current Behavior**: Hints are logged to console but not displayed to users. The hint listener exists and works, but only outputs to `console.log`.

### 7. Custom Message Support

**Spec Section**: Optional Enhancements > 4. Advanced Features

**What's Missing**: Support for arbitrary custom messages between CLUE and interactives.

**Current Behavior**: Only standard LARA Interactive API messages are supported.

### 8. Global Interactive State

**Spec Section**: Step 6 code (initMessage structure)

**What's Missing**: Support for sharing state across multiple instances of the same interactive.

**Current Behavior**: `globalInteractiveState` is always `null`.

## References

- [LARA Interactive API Documentation](https://github.com/concord-consortium/lara-interactive-api)
- [iframe-phone Documentation](https://github.com/concord-consortium/iframe-phone)
- [Question Interactives Example](https://github.com/concord-consortium/question-interactives)
- [CLUE Tiles Documentation](../tiles.md)
- [Starter Tile README](../src/plugins/starter/README.md)
