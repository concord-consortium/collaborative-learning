# Spec: Add Settings Support to IframeInteractive Tile

**CLUE Repository**: https://github.com/concord-consortium/collaborative-learning

## Story Info/Status

Story: https://concord-consortium.atlassian.net/browse/CLUE-387
Status: *Implemented*

## Overview

Users should be able to create their own "fresh" instances of an IframeInteractive tile from the toolbar, pre-configured with a URL and other properties defined in the unit's settings. This is the same pattern used by the Simulator tile, where a unit can specify a `defaultSimulation` and `maxTiles` in settings so that toolbar-created tiles come pre-configured.

Currently, IframeInteractive tiles created from the toolbar have no URL and show a "No URL configured" placeholder. The only way to get a working IframeInteractive tile is to author one directly in document JSON. This change will allow unit authors to specify a default URL (and other properties) in the unit settings so toolbar-created tiles are immediately functional.

## Desired Settings Format

The following settings block in a unit's `config.settings` will configure the IframeInteractive tile:

```json
"settings": {
  "iframeInteractive": {
    "maxTiles": 1,
    "url": "https://models-resources.concord.org/hurricane-model/branch/master/index.html?topBarVisible=false",
    "interactiveState": {},
    "authoredState": {},
    "allowedPermissions": "geolocation; microphone; camera; bluetooth",
    "maxHeight": 0,
    "enableScroll": false
  }
}
```

### Settings Properties

| Property | Type | Description |
|---|---|---|
| `maxTiles` | number | Maximum number of IframeInteractive tiles allowed per document. Toolbar button is disabled when limit is reached. |
| `url` | string | Default URL for new tiles created from the toolbar. |
| `interactiveState` | object | Default interactive state passed to the iframe on init. Typically `{}`. |
| `authoredState` | object | Default authored state (curriculum author configuration) passed to the iframe. |
| `allowedPermissions` | string | Iframe `allow` attribute value. Already supported (existing feature). |
| `maxHeight` | number | Maximum height in pixels (0 = unlimited, uses 2000px max). |
| `enableScroll` | boolean | Whether to enable iframe scrolling. |

## Changes Required

### 1. Update `defaultIframeInteractiveContent()` to Read Settings

**File:** `src/plugins/iframe-interactive/iframe-interactive-tile-content.ts`

The `defaultContent` factory function receives an `IDefaultContentOptions` parameter that includes `appConfig`. Update it to read settings from `appConfig` and use them as defaults for new tile instances:

```typescript
export function defaultIframeInteractiveContent(options?: IDefaultContentOptions): IframeInteractiveContentModelType {
  const settings = options?.appConfig?.getSetting("iframeInteractive") as Record<string, any> | undefined;
  return IframeInteractiveContentModel.create({
    url: settings?.url ?? "",
    interactiveState: settings?.interactiveState ?? {},
    authoredState: settings?.authoredState ?? {},
    maxHeight: settings?.maxHeight ?? 0,
    enableScroll: settings?.enableScroll ?? false
  });
}
```

This follows the same pattern as the Drawing tile's `defaultDrawingContent()`, which reads `appConfig.stamps` from options to configure default content.

**Note:** Unlike the Simulator tile (which reads settings lazily in a getter), we read settings eagerly in the factory. This is appropriate because the IframeInteractive tile stores `url`, `authoredState`, etc. directly in the content model and needs them at creation time. The Simulator reads its setting lazily because it has fallback logic for simulation lookup.

### 2. Fix `maxTiles` Lookup in Toolbar (Bug)

**File:** `src/components/toolbar.tsx` (line 231)

The toolbar's `isButtonDisabled()` method looks up tile settings using `toolButton.id.toLowerCase()`:

```typescript
const tileSettings = settings[toolButton.id.toLowerCase()] as Record<string, any>;
```

For `IframeInteractive`, this produces `"iframeinteractive"` (all lowercase), but the settings key is `"iframeInteractive"` (camelCase). This means `maxTiles` will not be found.

Other tiles don't have this problem because their type IDs are single words (`Simulator` → `simulator`, `Diagram` → `diagram`).

**Fix:** Update the lookup to use two named variables so the intent is clear:

```typescript
// "Diagram" → "diagram", "IframeInteractive" → "iframeinteractive"
const lowerCaseId = toolButton.id.toLowerCase();
// "IframeInteractive" → "iframeInteractive" (works for multi-word types where settings use camelCase keys)
const camelCaseId = toolButton.id.charAt(0).toLowerCase() + toolButton.id.slice(1);
const tileSettings = (settings[lowerCaseId] || settings[camelCaseId]) as Record<string, any>;
```

The `lowerCaseId` preserves backward compatibility with existing single-word tile types (`Simulator` → `simulator`, `Diagram` → `diagram`). The `camelCaseId` fallback handles multi-word tile types where the settings key is conventionally camelCase (`IframeInteractive` → `iframeInteractive`). For single-word types, both variables produce the same value, so the fallback is harmless.

### 3. Update Unit Configuration Documentation

**File:** `docs/unit-configuration.md`

Add a new section for IframeInteractive settings after the existing "Simulation" section:

```markdown
#### IframeInteractive

- `maxTiles`: number
- `url`: string (URL for the embedded interactive)
- `interactiveState`: object (default interactive state)
- `authoredState`: object (default authored state for curriculum configuration)
- `allowedPermissions`: string (iframe permissions policy)
- `maxHeight`: number (max height in pixels, 0 for unlimited)
- `enableScroll`: boolean

(no toolbar)
```

### 4. Add Settings to QA Unit for Testing

**File:** `src/public/demo/units/qa/content.json`

Add an `iframeInteractive` settings block to the QA unit so the feature can be tested:

```json
"iframeInteractive": {
  "maxTiles": 1,
  "url": "https://models-resources.concord.org/hurricane-model/branch/master/index.html?topBarVisible=false",
  "interactiveState": {},
  "authoredState": {},
  "allowedPermissions": "geolocation; microphone; camera; bluetooth",
  "maxHeight": 0,
  "enableScroll": false
}
```

### 5. Update Tests

**File:** `src/plugins/iframe-interactive/iframe-interactive-tile-content.test.ts`

Add test cases for the updated `defaultIframeInteractiveContent()`:

- When called without options (no appConfig), creates a tile with empty defaults (backward-compatible).
- When called with appConfig containing `iframeInteractive` settings, creates a tile with settings values applied.
- Individual settings properties are optional (partial settings objects work).

**File:** `src/components/toolbar.test.tsx` (or similar)

- Verify that `maxTiles` for `IframeInteractive` correctly disables the toolbar button when the limit is reached.

## Files Modified

| File | Change |
|---|---|
| `src/plugins/iframe-interactive/iframe-interactive-tile-content.ts` | Update `defaultIframeInteractiveContent()` to accept options and read settings |
| `src/components/toolbar.tsx` | Fix settings lookup to support camelCase tile type keys |
| `docs/unit-configuration.md` | Document IframeInteractive settings |
| `src/public/demo/units/qa/content.json` | Add iframeInteractive settings for testing |
| `src/plugins/iframe-interactive/iframe-interactive-tile-content.test.ts` | Add tests for settings-based defaults |

## Testing Plan

1. **No settings (backward compatibility):** Without `iframeInteractive` in settings, toolbar-created tiles should behave exactly as before (empty URL, placeholder shown).
2. **With settings:** With `iframeInteractive` settings in the unit config, toolbar-created tiles should load with the configured URL and properties.
3. **maxTiles enforcement:** With `maxTiles: 1`, creating one IframeInteractive tile should disable the toolbar button for creating another.
4. **Authored content unaffected:** IframeInteractive tiles specified directly in authored document JSON should continue to use their own explicit properties, not the settings defaults.
5. **allowedPermissions:** Verify the existing `allowedPermissions` setting continues to work (it reads from settings at render time, not from the content model).
