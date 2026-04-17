# Save Status Indicator

## Problem

CLUE has no UI feedback for whether document changes have been saved to Firebase. On slow networks, users have no way to know if their work is persisted. Additionally, Cypress tests that navigate between students suffer from flakiness because there's no reliable signal that saves have completed before navigating away.

## Design

### State Machine

Four states driven by the document sync lifecycle:

```
  MST change        Firebase success      3s timeout
idle ──────► saving ──────────────► saved ──────────► idle
                 ▲                    │
                 │    MST change      │
                 ◄────────────────────┘
                 ▲
                 │  retry attempt
            retrying
                 ▲
                 │  Firebase error (auto-retrying)
            saving
```

| State | Icon | Text | Trigger |
|-------|------|------|---------|
| `idle` | Cloud-check | *(none)* | Initial state; 3s after entering `saved` |
| `saving` | Sync arrows | "Saving..." | `onSnapshot` fires (synchronous with MST change) |
| `saved` | Cloud-check | "Saved" | `onSuccess` fires after Firebase write; text disappears after ~3s |
| `retrying` | Sync arrows | "Retrying..." | `onError` fires while retry is automatic |

Any new MST change resets to `saving` regardless of current state.

### Where State Lives

Volatile property `saveState: "idle" | "saving" | "saved" | "retrying"` on the Document model (`src/models/document/document.ts`). Volatile so it's not persisted or part of snapshots. A `setSaveState` action modifies it.

The `useDocumentSyncToFirebase` hook sets the state:
- `onSnapshot` callback (sync with MST change): `document.setSaveState("saving")`
- `onSuccess`: `document.setSaveState("saved")`
- `onError`: `document.setSaveState("retrying")`

### UI Component

`SaveIndicator` — a small MobX observer component rendering icon + optional text.

**Placement:** Rendered by `EditableDocumentContent` for editable documents (not read-only) and portaled into a target in the workspace panel heading. The workspace provides the portal target via `SaveIndicatorPortalContext` so the indicator appears in the shared heading bar above the document rather than inside the document's own title bar. This keeps the indicator visible across documents and avoids per-document-type titlebar changes.

**Icons:** Two new inline SVG icons in `src/assets/icons/`:
- `cloud-check.svg` — small cloud with checkmark (used in `idle` and `saved` states)
- `sync-arrows.svg` — circular arrows (used in `saving` and `retrying` states)

**Styling:** Small text (~12px) next to the icon, muted color. No fade — text simply appears/disappears.

**Data attribute:** `data-testid="save-indicator"` on the container for Cypress targeting.

### Files to Create/Modify

| File | Change |
|------|--------|
| `src/models/document/document.ts` | Add volatile `saveState`, action `setSaveState` |
| `src/hooks/use-document-sync-to-firebase.ts` | Call `setSaveState` in onSnapshot, onSuccess, onError |
| `src/components/document/save-indicator.tsx` | New component, portals into workspace heading via context |
| `src/components/document/save-indicator.scss` | New styles |
| `src/components/document/save-indicator-portal-context.tsx` | New React context providing the portal target ref |
| `src/components/document/editable-document-content.tsx` | Render `SaveIndicator` for editable, sync-enabled documents |
| `src/components/workspace/workspace.tsx` | Create portal target ref; provide via context; pass to `ResizablePanel` via `headingExtra` |
| `src/components/workspace/resizable-panel.tsx` | Accept `headingExtra` prop and render it in the panel heading |
| `src/components/workspace/resizable-panel.scss` | Layout updates for heading to host the portal target |
| `src/assets/icons/cloud-check.svg` | New icon |
| `src/assets/icons/sync-arrows.svg` | New icon |

### Cypress Usage

```js
// After making a change, wait for save to complete
cy.get('[data-testid="save-indicator"]').should('contain', 'Saved');
```

The "Saved" text stays visible for ~3 seconds, giving Cypress's retry loop time to detect it. Since `setSaveState("saving")` is synchronous with the MST change, there's no race where an old "Saved" could be mistaken for the new save completing.

### Testing

- Unit test for Document model: verify `saveState` transitions
- The existing `use-document-sync-to-firebase.test.ts` can be extended to verify `setSaveState` calls
- Update the flaky Cypress test `student_teacher_4up_readonly_spec.js` to wait for `Saved` before navigating
