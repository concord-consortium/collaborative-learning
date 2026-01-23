# Iframe Interactive Tile

The Iframe Interactive tile enables embedding external interactive content into CLUE documents using the [LARA Interactive API](https://github.com/concord-consortium/lara-interactive-api) protocol. This tile provides a secure iframe-based container with bidirectional communication for educational interactives.

## Features

- **LARA Interactive API Support**: Full protocol compliance (v1.x) for interactives built with the standard
- **Bidirectional State Management**: Automatic synchronization between CLUE and embedded interactives
- **Dynamic Height Adjustment**: iframe automatically resizes based on content with loop prevention
- **Debounced State Saving**: 500ms debounce prevents excessive Firebase writes during rapid state changes
- **Read-Only Mode**: Supports "report" mode for viewing saved student work
- **Runtime Mode**: Full interactive mode for students working on activities
- **Accessibility**: WCAG 2.1 AA compliant with ARIA attributes and skip-to-content links
- **Error Isolation**: Error boundaries prevent interactive failures from crashing CLUE
- **Loading States**: Shows spinner after 2s delay with proper cleanup
- **Security**: Configurable iframe sandbox and permissions (geolocation, camera, microphone, etc.)
- **Polling Fallback**: 2-second state polling ensures capture even without proactive state messages
- **iframe-phone Integration**: Robust postMessage communication with automatic cleanup
- **Logging Support**: Interactive log events forwarded to CLUE's logger

## Architecture

### Content Model (MobX State Tree)

The tile uses MST with **frozen types** for immutable state management:

```typescript
{
  type: "IframeInteractive",           // Tile type identifier
  url: string,                      // Interactive URL (required)
  interactiveState: frozen({}),     // Student work state (immutable)
  authoredState: frozen({}),        // Teacher configuration (immutable)
  maxHeight: number,                // Maximum height (0 = unlimited)
  enableScroll: boolean             // Enable iframe scrolling
}
```

**Note**: iframe permissions (`allow` attribute) are configured at the unit level via `settings.iframeInteractive.allowedPermissions` for security reasons, not per-tile.

**Important**: `interactiveState` and `authoredState` use MST frozen types, meaning they must be replaced entirely rather than mutated:

```typescript
// Correct - replaces entire state
content.setInteractiveState({ answer: "42", submitted: true });

// Wrong - mutation not allowed
content.interactiveState.answer = "42";
```

### Component Architecture

The React component (`IframeInteractiveComponent`) handles:
- iframe lifecycle and iframe-phone connection management
- LARA protocol message handling (initInteractive, loadInteractive, etc.)
- State synchronization with 500ms debouncing
- Height updates with 100ms debouncing and 5px threshold
- Error boundaries for isolation
- Accessibility features (skip-to-content, ARIA)
- Loading states with 2s delay

## Usage

### For Curriculum Authors

Add an Iframe Interactive tile to a CLUE document by including this JSON in your curriculum:

```json
{
  "type": "IframeInteractive",
  "url": "https://example.com/interactive.html",
  "authoredState": {
    "questionType": "multiple_choice",
    "prompt": "What is the capital of France?"
  },
  "allowedPermissions": "geolocation; microphone; camera",
  "maxHeight": 800,
  "enableScroll": false
}
```

**Common Interactive URLs**:
- Open Response: `https://question-interactives.concord.org/open-response/`
- Multiple Choice: `https://question-interactives.concord.org/multiple-choice/`
- Fill in the Blank: `https://question-interactives.concord.org/fill-in-the-blank/`

### For Developers

To create content that works with the Iframe Interactive tile:

1. **Implement the LARA Interactive API** in your interactive
2. **Use iframe-phone** for postMessage communication
3. **Handle required messages**:
   - Listen for `initInteractive` with mode, authoredState, interactiveState
   - Send `interactiveState` when student work changes
   - Send `height` when content size changes
   - Respond to `getInteractiveState` polling requests

**Minimal Example**:

```javascript
import { IframePhoneEndpoint } from 'iframe-phone';

const phone = new IframePhoneEndpoint();

// Listen for initialization
phone.addListener('initInteractive', (data) => {
  const { mode, authoredState, interactiveState } = data;

  // Load configuration
  if (authoredState) {
    configureInteractive(authoredState);
  }

  // Restore previous work
  if (interactiveState) {
    restoreState(interactiveState);
  }

  // Report ready
  phone.post('supportedFeatures', {
    apiVersion: 1,
    features: { interactiveState: true }
  });
});

// Send state updates
function saveState(newState) {
  phone.post('interactiveState', newState);
}

// Send height updates
function updateHeight() {
  const height = document.body.scrollHeight;
  phone.post('height', height);
}
```

### Message Flow

**Initialization Sequence**:
1. CLUE creates iframe with interactive URL
2. CLUE establishes iframe-phone connection
3. CLUE sends `initInteractive` with mode, states, features
4. Interactive sends `supportedFeatures` confirming capabilities
5. Interactive sends initial `height`
6. (Optional) CLUE sends `loadInteractive` if resuming work

**Runtime Operation**:
- Student interacts -> Interactive sends `interactiveState` -> CLUE saves (debounced 500ms)
- Content resizes -> Interactive sends `height` -> CLUE adjusts (debounced 100ms)
- Every 2s -> CLUE sends `getInteractiveState` -> Interactive responds with current state

**Read-Only Mode**:
- CLUE sends `mode: "report"` in `initInteractive`
- Interactive displays saved work without editing
- No state polling occurs

## Testing

### Unit Tests

Run the test suite:
```bash
npm test -- src/plugins/iframe-interactive/
```

**Test Coverage**:
- 15 content model tests (state management, frozen types, JSON export)
- 12 component tests (rendering, iframe attributes, accessibility)
- 4 integration tests (iframe-phone communication, polling)

## Configuration Reference

### Content Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `url` | string | `""` | Interactive URL (required for display) |
| `interactiveState` | frozen object | `{}` | Student work state (immutable) |
| `authoredState` | frozen object | `{}` | Teacher configuration (immutable) |
| `maxHeight` | number | `0` | Maximum height in pixels (0 = unlimited) |
| `enableScroll` | boolean | `false` | Enable iframe scrolling |

### Unit Configuration

iframe permissions are configured at the unit level for security (prevents runtime modification by users):

```json
{
  "config": {
    "settings": {
      "iframeInteractive": {
        "allowedPermissions": "geolocation; microphone; camera"
      }
    }
  }
}
```

Default: `"geolocation; microphone; camera; bluetooth"`

### Content Actions

| Action | Parameters | Description |
|--------|------------|-------------|
| `setUrl` | `url: string` | Set interactive URL |
| `setInteractiveState` | `state: any` | Replace entire interactive state |
| `setAuthoredState` | `state: any` | Replace entire authored state |
| `setMaxHeight` | `height: number` | Set maximum height |
| `setEnableScroll` | `enabled: boolean` | Enable/disable scrolling |

### iframe Sandbox Attributes

The tile uses these sandbox flags for security:
- `allow-scripts` - Enables JavaScript execution
- `allow-forms` - Enables form submission
- `allow-same-origin` - Enables same-origin access (required for iframe-phone)
- `allow-popups` - Enables window.open() for external links
- `allow-downloads` - Enables file downloads

## Troubleshooting

### Problem: Interactive doesn't load (blank iframe)

**Symptoms**: White screen, no content visible

**Possible causes**:
- URL not set: Check `content.url` is not empty
- CORS issues: Interactive must allow embedding from CLUE's origin
- HTTPS required: Most browsers block mixed content (HTTP in HTTPS page)
- X-Frame-Options: Server must not send `DENY` or `SAMEORIGIN` headers

**Solutions**:
1. Verify URL is set and accessible
2. Check browser console for CORS/security errors
3. Ensure interactive allows iframe embedding
4. Test URL directly in browser first

### Problem: Interactive state not saving

**Symptoms**: Student work lost on refresh/navigation

**Possible causes**:
- Interactive not sending `interactiveState` messages
- State sent too frequently (debounce dropping updates)
- Invalid state format (must be JSON-serializable)

**Solutions**:
1. Verify interactive sends `interactiveState` via iframe-phone
2. Check browser DevTools -> Network -> WS (WebSocket) for Firebase writes
3. Ensure state is plain object (no functions, circular refs)
4. Test with polling: verify `getInteractiveState` responses

### Problem: Height not adjusting correctly

**Symptoms**: Scrollbars appear, content cut off, or too much whitespace

**Possible causes**:
- Interactive not sending `height` messages
- Height messages sent too frequently (debounce causing lag)
- Recursive height loop (CLUE <-> Interactive)

**Solutions**:
1. Verify interactive sends `height` via iframe-phone
2. Check for height thrashing in console logs
3. Enable `enableScroll: true` if dynamic height problematic
4. Set `maxHeight` to limit growth

### Problem: CORS errors in console

**Symptoms**: Console shows "blocked by CORS policy"

**Cause**: Interactive's server doesn't allow cross-origin requests

**Solutions**:
1. Interactive must send `Access-Control-Allow-Origin: *` header (or specific origin)
2. For development, use proxy or `--disable-web-security` flag (Chrome)
3. Contact interactive provider to enable CORS

### Problem: iframe-phone connection fails

**Symptoms**: No communication, initialization timeout

**Possible causes**:
- Interactive not implementing iframe-phone
- Version mismatch (CLUE uses v1.4.0)
- Interactive loaded before phone initialized

**Solutions**:
1. Verify interactive includes iframe-phone library
2. Check phone initialization happens after DOM ready
3. Use browser DevTools -> Console to check for phone errors
4. Test with minimal example interactive first

## Known Limitations

1. **No Authoring UI**: Currently requires JSON editing to set URL and configuration
2. **Limited Modal Support**: Only supports alerts, not lightbox or dialog modals
3. **No Linked Interactives**: `linkedInteractives` always empty (multi-page sequences not supported)
4. **No Global State**: `globalInteractiveState` always null (cross-page state not supported)
5. **Firebase Write Limits**: Rapid state changes may hit Firebase rate limits (500ms debounce mitigates)
6. **Undo/Redo Limitations**: While CLUE's undo/redo system works with this tile, the interactive will receive the restored state but may not be able to intelligently update its view. The interactive may need to re-initialize, which could lose unsaved state or focus.

## Performance Considerations

- **Debouncing Strategy**:
  - 500ms for state updates (Firebase writes expensive)
  - 100ms for height updates (balance responsiveness vs. performance)
- **State Polling**: 2-second interval ensures capture but adds message overhead
- **Memory Management**: iframe-phone disconnects on unmount to prevent leaks
- **Height Loop Prevention**: 5px threshold prevents recursive adjustments

## Related Documentation

- [LARA Interactive API Specification](https://github.com/concord-consortium/lara-interactive-api)
- [iframe-phone Library](https://github.com/concord-consortium/iframe-phone)
- [CLUE Tile Development Guide](../../docs/tile-development.md)
- [MobX State Tree Documentation](https://mobx-state-tree.js.org/)

## Contributing

When modifying this tile:

1. **Maintain Protocol Compliance**: Follow LARA Interactive API spec exactly
2. **Test State Management**: Verify debouncing prevents data loss
3. **Check Height Behavior**: Ensure no recursive loops or thrashing
4. **Verify Accessibility**: Test keyboard navigation and screen readers
5. **Update Tests**: Add tests for new features/fixes

## Version History

### v1.0.0 (2026-01-16)
- Initial implementation with full LARA Interactive API support
- Bidirectional state management with debouncing
- Dynamic height adjustment with loop prevention
- Read-only (report) and runtime modes
- Comprehensive accessibility features
- Error boundaries for isolation
- 27 unit/integration tests
