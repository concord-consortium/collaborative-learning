# History View Dialog Specification

## Overview

This spec describes the implementation of a history viewing dialog for CLUE documents. The dialog displays a scrollable list of all history entries for the current document, allowing users to inspect document changes over time.

## Requirements

1. **Activation**: A new button on the document toolbar opens the history view
2. **Debug Gating**: The button is only **shown** when debug option `historyView` is true (not configured per-unit)
3. **Non-Modal**: The dialog does not block interaction with the document
4. **Live Updates**: New history entries appear in the list as they are created
5. **Compact Display**: Each entry occupies one line with an expand/collapse control for details
6. **Persistent State**: Panel open/closed state persists across page reloads
7. **Dual History Sources**: Shows both local (current session) and remote (Firestore) history with independent scrolling

## Technical Design

### 1. Debug Flag Addition

**File:** `src/lib/debug.ts`

Add a new debug flag:

```typescript
export const DEBUG_HISTORY_VIEW = debugContains("historyView");
```

**Usage:** Enable via browser console: `localStorage.debug = "historyView"`

### 2. Toolbar Button (Programmatic Addition)

The history view button is **not** configured in unit JSON files. Instead, it is programmatically added to the toolbar when `DEBUG_HISTORY_VIEW` is true.

**File:** `src/components/toolbar.tsx`

In the render method, conditionally add the history view button to the toolbar buttons array:

```typescript
import { DEBUG_HISTORY_VIEW } from "../../lib/debug";

// In render method, after getting configured toolbar buttons:
const toolbarButtons = [...configuredButtons];

if (DEBUG_HISTORY_VIEW) {
  toolbarButtons.push({
    id: "historyView",
    title: "View History",
    iconId: "icon-history-view",
    isTileTool: false
  });
}
```

Add handler in the button click switch statement:

```typescript
case "historyView":
  this.stores.persistentUI.toggleHistoryView();
  break;
```

### 3. UI State for History View Panel

**File:** `src/models/stores/persistent-ui/persistent-ui.ts`

Add state to the `PersistentUIModelV2` model. This store automatically serializes and saves for the current user via Firebase, so no manual localStorage handling is needed.

```typescript
export const PersistentUIModelV2 = types
  .model("PersistentUI", {
    // ... existing properties
    showHistoryView: false,
    showRemoteHistoryView: false,
    // ...
  })
  // ... existing volatile, views ...
  .actions(self => ({
    // ... existing actions
    toggleHistoryView() {
      self.showHistoryView = !self.showHistoryView;
    },
    setShowHistoryView(show: boolean) {
      self.showHistoryView = show;
    },
    toggleRemoteHistoryView() {
      self.showRemoteHistoryView = !self.showRemoteHistoryView;
    },
    setShowRemoteHistoryView(show: boolean) {
      self.showRemoteHistoryView = show;
    },
  }))
```

Note: The `PersistentUIModel` automatically syncs to Firebase via `onSnapshot` in `initializePersistentUISync`, so these settings will persist across sessions for the logged-in user.

### 4. History View Panel Component

**File:** `src/components/document/history-view-panel.tsx` (new file)

The panel component receives only the document and accesses everything else internally via stores and the document's treeManagerAPI.

```typescript
import React, { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { HistoryEntryItem } from "./history-entry-item";
import { HistoryEntry, IHistoryEntry, HistoryEntrySnapshot } from "../../models/history/history";
import { loadHistory, getHistoryPath } from "../../models/history/history-firestore";
import { useStores } from "../../hooks/use-stores";
import { DocumentModelType } from "../../models/document/document";

import "./history-view-panel.scss";

interface IHistoryViewPanelProps {
  document: DocumentModelType;
}

export const HistoryViewPanel: React.FC<IHistoryViewPanelProps> = observer(({
  document
}) => {
  const stores = useStores();
  const { persistentUI, db } = stores;
  const [remoteHistoryEntries, setRemoteHistoryEntries] = useState<IHistoryEntry[]>([]);

  // Get local history from document
  const localHistoryEntries = document.treeManagerAPI?.document.history || [];

  // Get history path for remote history
  const historyPath = getHistoryPath(document);

  const showRemoteHistory = persistentUI.showRemoteHistoryView;

  const handleToggleRemoteHistory = () => {
    persistentUI.toggleRemoteHistoryView();
  };

  const handleClose = () => {
    persistentUI.setShowHistoryView(false);
  };

  // Subscribe to remote history when showRemoteHistory is enabled
  useEffect(() => {
    if (!showRemoteHistory || !historyPath) {
      setRemoteHistoryEntries([]);
      return;
    }

    const unsubscribe = loadHistory(db.firestore, historyPath, (entries: HistoryEntrySnapshot[]) => {
      setRemoteHistoryEntries(entries.map(snapshot => HistoryEntry.create(snapshot)));
    });

    return () => unsubscribe();
  }, [showRemoteHistory, historyPath, db.firestore]);

  return (
    <div className="history-view-panel">
      <div className="history-view-header">
        <h3>Document History</h3>
        <button className="history-view-close" onClick={handleClose}>×</button>
      </div>

      {/* Local History Section */}
      <div className="history-view-section">
        <div className="history-view-section-header">
          <h4>Local History (Current Session)</h4>
          <span className="history-view-count">{localHistoryEntries.length} entries</span>
        </div>
        <div className="history-view-list">
          {localHistoryEntries.length === 0 ? (
            <div className="history-view-empty">No local history entries</div>
          ) : (
            localHistoryEntries.map((entry, index) => (
              <HistoryEntryItem key={entry.id} entry={entry} index={index} />
            ))
          )}
        </div>
      </div>

      {/* Remote History Toggle */}
      <div className="history-view-toggle">
        <label>
          <input
            type="checkbox"
            checked={showRemoteHistory}
            onChange={handleToggleRemoteHistory}
          />
          Show Remote History (Firestore)
        </label>
      </div>

      {/* Remote History Section */}
      {showRemoteHistory && (
        <div className="history-view-section">
          <div className="history-view-section-header">
            <h4>Remote History (Firestore)</h4>
            <span className="history-view-count">{remoteHistoryEntries.length} entries</span>
          </div>
          <div className="history-view-list">
            {remoteHistoryEntries.length === 0 ? (
              <div className="history-view-empty">No remote history entries</div>
            ) : (
              remoteHistoryEntries.map((entry, index) => (
                <HistoryEntryItem key={entry.id} entry={entry} index={index} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
});
```

### 5. History Entry Item Component

**File:** `src/components/document/history-entry-item.tsx` (new file)

Shows all requested info in collapsed view: index, Model.Action name, timestamp, undoable indicator, and patch count.

```typescript
import React, { useState } from "react";
import { observer } from "mobx-react";
import { IHistoryEntry } from "../../models/history/history";

import "./history-entry-item.scss";

interface IHistoryEntryItemProps {
  entry: IHistoryEntry;
  index: number;
}

export const HistoryEntryItem: React.FC<IHistoryEntryItemProps> = observer(({
  entry,
  index
}) => {
  const [expanded, setExpanded] = useState(false);

  const toggleExpanded = () => setExpanded(!expanded);

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString();
  };

  const getPatchCount = () => {
    return entry.records.reduce((total, record) => total + record.patches.length, 0);
  };

  return (
    <div className={`history-entry-item ${expanded ? "expanded" : ""}`}>
      <div className="history-entry-summary" onClick={toggleExpanded}>
        <span className="history-entry-expand">
          {expanded ? "▼" : "▶"}
        </span>
        <span className="history-entry-index">#{index + 1}</span>
        <span className="history-entry-action" title={entry.action}>
          {entry.modelActionKey}
        </span>
        <span className="history-entry-patches" title="Number of patches">
          {getPatchCount()}p
        </span>
        {entry.undoable && (
          <span className="history-entry-undoable" title="Undoable">↩</span>
        )}
        <span className="history-entry-time">{formatTimestamp(entry.created)}</span>
      </div>
      {expanded && (
        <div className="history-entry-details">
          <div><strong>ID:</strong> {entry.id}</div>
          <div><strong>Model:</strong> {entry.model}</div>
          <div><strong>Action:</strong> {entry.action}</div>
          <div><strong>Undoable:</strong> {entry.undoable ? "Yes" : "No"}</div>
          <div><strong>State:</strong> {entry.state}</div>
          <div><strong>Records:</strong> {entry.records.length}</div>
          {entry.records.map((record, recordIndex) => (
            <div key={recordIndex} className="history-entry-record">
              <div className="record-header">
                <strong>Record {recordIndex + 1}:</strong> {record.tree} - {record.action}
              </div>
              <div className="record-patches">
                <strong>Patches ({record.patches.length}):</strong>
                <pre>{JSON.stringify(record.patches, null, 2)}</pre>
              </div>
              <div className="record-inverse-patches">
                <strong>Inverse Patches ({record.inversePatches.length}):</strong>
                <pre>{JSON.stringify(record.inversePatches, null, 2)}</pre>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
```

### 6. Integration with Document View

**File:** `src/components/document/document.tsx` (or appropriate parent component)

Add the HistoryViewPanel to the document view. The panel accesses stores and document data internally, so only the document needs to be passed.

```typescript
import { HistoryViewPanel } from "./history-view-panel";
import { DEBUG_HISTORY_VIEW } from "../../lib/debug";

// In render method:
{DEBUG_HISTORY_VIEW && stores.persistentUI.showHistoryView && (
  <HistoryViewPanel document={document} />
)}
```

### 7. Accessing History Entries

All history access is handled internally by HistoryViewPanel.

**Local History (Current Session):**
```typescript
// Via treeManagerAPI.document.history - accessed internally by HistoryViewPanel
const localHistoryEntries = document.treeManagerAPI?.document.history || [];
```

**Remote History (Firestore):**
```typescript
// Use existing loadHistory() and getHistoryPath() from history-firestore.ts
// Handled internally by HistoryViewPanel
import { loadHistory, getHistoryPath } from "../../models/history/history-firestore";

const historyPath = getHistoryPath(document);

// Returns unsubscribe function, calls handler with updated history on changes
const unsubscribe = loadHistory(db.firestore, historyPath, (entries: HistoryEntrySnapshot[]) => {
  // entries is array of HistoryEntrySnapshot
});
```

### 8. Styling

**File:** `src/components/document/history-view-panel.scss` (new file)

```scss
.history-view-panel {
  position: absolute;
  right: 0;
  top: 0;
  width: 450px;
  height: 100%;
  background: white;
  border-left: 1px solid #ccc;
  box-shadow: -2px 0 5px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  z-index: 100;

  .history-view-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid #ddd;
    background: #f5f5f5;

    h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
    }

    .history-view-close {
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      padding: 4px 8px;
      line-height: 1;

      &:hover {
        background: #e0e0e0;
        border-radius: 4px;
      }
    }
  }

  .history-view-section {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0; // Allow flex shrinking

    .history-view-section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 16px;
      background: #fafafa;
      border-bottom: 1px solid #eee;

      h4 {
        margin: 0;
        font-size: 13px;
        font-weight: 600;
        color: #555;
      }

      .history-view-count {
        font-size: 12px;
        color: #888;
      }
    }

    .history-view-list {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
    }

    .history-view-empty {
      padding: 16px;
      text-align: center;
      color: #888;
      font-style: italic;
    }
  }

  .history-view-toggle {
    padding: 8px 16px;
    border-top: 1px solid #ddd;
    border-bottom: 1px solid #ddd;
    background: #f9f9f9;

    label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      cursor: pointer;

      input[type="checkbox"] {
        cursor: pointer;
      }
    }
  }
}
```

**File:** `src/components/document/history-entry-item.scss` (new file)

```scss
.history-entry-item {
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  margin-bottom: 4px;
  background: white;

  &.expanded {
    border-color: #bbb;
  }

  .history-entry-summary {
    display: flex;
    align-items: center;
    padding: 6px 10px;
    cursor: pointer;
    gap: 6px;
    font-size: 12px;

    &:hover {
      background: #f8f8f8;
    }

    .history-entry-expand {
      width: 14px;
      font-size: 9px;
      color: #666;
      flex-shrink: 0;
    }

    .history-entry-index {
      color: #888;
      font-size: 11px;
      min-width: 28px;
      flex-shrink: 0;
    }

    .history-entry-action {
      flex: 1;
      font-family: monospace;
      font-size: 11px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .history-entry-patches {
      color: #666;
      font-size: 10px;
      background: #eee;
      padding: 1px 4px;
      border-radius: 3px;
      flex-shrink: 0;
    }

    .history-entry-undoable {
      color: #4a9;
      font-size: 12px;
      flex-shrink: 0;
      title: "Undoable";
    }

    .history-entry-time {
      color: #888;
      font-size: 11px;
      flex-shrink: 0;
    }
  }

  .history-entry-details {
    padding: 10px 12px;
    background: #fafafa;
    border-top: 1px solid #eee;
    font-size: 11px;
    line-height: 1.5;

    > div {
      margin-bottom: 4px;
    }

    .history-entry-record {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px dashed #ddd;

      .record-header {
        margin-bottom: 6px;
      }

      .record-patches,
      .record-inverse-patches {
        margin-top: 4px;
      }

      pre {
        background: #f0f0f0;
        padding: 8px;
        overflow-x: auto;
        font-size: 10px;
        max-height: 150px;
        overflow-y: auto;
        margin: 4px 0;
        border-radius: 3px;
      }
    }
  }
}
```

### 9. Toolbar Icon

**File:** `src/assets/icons/history-view-icon.svg` (new file)

Create or source an appropriate icon for the history view button. Suggested: a clock with a list/document icon, or a simple timeline icon.

---

## Implementation Phases

### Phase 1: Debug Flag and UI State
**Files to modify/create:**
- `src/lib/debug.ts` - Add `DEBUG_HISTORY_VIEW` flag
- `src/models/stores/persistent-ui/persistent-ui.ts` - Add `showHistoryView` and `showRemoteHistoryView` properties and actions

**Deliverables:**
1. New debug flag that reads from localStorage
2. UI state properties and toggle actions in PersistentUIModel (automatically synced to Firebase)
3. Unit tests for the new state management

### Phase 2: Toolbar Integration
**Files to modify/create:**
- `src/components/toolbar.tsx` - Programmatically add history view button when debug flag is true
- `src/assets/icons/history-view-icon.svg` - New toolbar icon

**Deliverables:**
1. History view button appears in toolbar only when `DEBUG_HISTORY_VIEW` is true
2. Button click toggles `showHistoryView` state
3. Works in all units without configuration changes

### Phase 3: Panel Component with Local History
**Files to create:**
- `src/components/document/history-view-panel.tsx`
- `src/components/document/history-view-panel.scss`
- `src/components/document/history-entry-item.tsx`
- `src/components/document/history-entry-item.scss`

**Files to modify:**
- `src/components/document/document.tsx` (or appropriate parent) - Render panel

**Deliverables:**
1. Right-side panel with header and close button
2. Local history section showing entries from current session
3. Each entry shows: index, Model.Action, timestamp, undoable indicator, patch count
4. Expand/collapse functionality for entry details
5. Panel state persists across page reloads

### Phase 4: Remote History Integration
**Files to modify:**
- `src/components/document/history-view-panel.tsx` - Add remote history section with internal Firestore subscription

**Deliverables:**
1. Toggle checkbox to show/hide remote history section
2. Remote history section below local history with independent scrolling
3. Live updates when new remote entries are created (via Firestore onSnapshot)
4. Remote toggle state persists across sessions via PersistentUIModel

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Panel position | Right side | Standard location for inspector panels; doesn't interfere with document content |
| State persistence | PersistentUIModel (Firebase) | Automatically syncs with user account; survives page reloads and across devices |
| Button visibility | Hidden when debug off | Cleaner UI for non-developers; no configuration needed |
| History sources | Both local + remote | Enables comparison between session and persisted state |
| List scrolling | Independent per section | Allows comparing related entries between local and remote |
| Collapsed entry info | All fields | Maximizes utility for debugging without expanding |
| Entry click behavior | View details only | Simple and safe; no accidental state changes |
| Remote history loading | Inside HistoryViewPanel | Encapsulates Firestore subscription logic; cleaner component boundaries |
| Component props | Document only | Panel accesses stores internally; minimal coupling with parent component |
