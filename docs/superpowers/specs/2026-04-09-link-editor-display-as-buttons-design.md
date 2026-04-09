# Link Editor Modal — "Display as" Radio Buttons

## Overview

Add a "Display as:" option to the existing Link Editor modal in the text tile. Users choose between "Link" (default) and "Button" display modes via radio buttons. The "Button" mode has no functional effect in this story — it will be implemented in a follow-up. This story covers the UI, state management, styling, and logging.

## Requirements

### Dialog Layout

The Link Editor modal is resized to 300×300px. The layout from top to bottom:

1. **Header**: "Link Editor" title with close (×) button (unchanged)
2. **URL input**: "Link text:" label and full-width text input (unchanged, but font updated to Lato)
3. **Display as section** (new):
   - Label: "Display as:"
   - Two radio buttons: "Link" (default, selected) and "Button"
   - Radio buttons are stacked vertically, one over the other
   - Clicking the label text also selects the radio button
4. **Footer**: Cancel and Save buttons (restyled)

### Radio Button Behavior

- Exactly one radio button is always selected; "Link" is the default
- Standard HTML `<input type="radio">` with `<label htmlFor>` for accessible click targets
- States: on (checked), off (unchecked), hover (via CSS), keyboard focus (browser focus ring)
- Radio button `name` attribute groups them so only one can be selected

### Styling

- **Modal size**: 300×300px (width × height)
- **Font**: `font-family: Lato, sans-serif` applied to the dialog content, Cancel button, and Save button
- **Save button default state**: `background-color: $workspace-teal-light-4`; hover and active states use `$workspace-teal-light-3` and `$workspace-teal-light-2` respectively
- **Cancel button**: font updated to Lato, colors unchanged
- **Radio buttons**: native browser radio inputs, no custom styling beyond layout

### State Management

- Add `displayMode` state (`"link" | "button"`) to the `useLinkDialog` hook, defaulting to `"link"`
- When editing an existing link element, initialize `displayMode` from the element's `displayMode` property if present, otherwise default to `"link"`
- On save, include `displayMode` in the link element properties stored in Slate (for future use by the Button story)
- The `displayMode` value has no visual effect on the rendered link in this story

### Logging

- Add `TEXT_LINK_DISPLAY_CHANGE` to the `LogEventName` enum in `src/lib/logger-types.ts`
- Log when the user changes the radio button selection (not on every save)
- Payload: `{ tileId, displayMode: "link" | "button" }`
- Use the existing `Logger.log()` pattern

### Testing

- Radio buttons render with "Link" selected by default
- Clicking "Button" radio selects it and deselects "Link"
- Save handler receives the current `displayMode` value
- Logger fires `TEXT_LINK_DISPLAY_CHANGE` when radio selection changes
- Modal renders at 300×300px

## Files to Modify

| File | Change |
|------|--------|
| `src/components/tiles/text/dialog/use-link-dialog.tsx` | Add `displayMode` state, radio buttons to `LinkDialogContent`, pass displayMode on save |
| `src/components/tiles/text/dialog/use-link-dialog.scss` | Add radio button layout styles, Lato font, 300×300 modal size |
| `src/hooks/custom-modal.scss` | Update Save button default color to teal, add Lato font to `.modal-button` |
| `src/lib/logger-types.ts` | Add `TEXT_LINK_DISPLAY_CHANGE` enum value |

## Out of Scope

- Rendering links as buttons in the editor (future story)
- Any changes to how links are serialized/deserialized beyond adding the `displayMode` property
- Custom radio button styling beyond layout
