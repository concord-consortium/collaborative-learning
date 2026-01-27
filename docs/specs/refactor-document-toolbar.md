# Spec: Refactoring the Document Toolbar

## Overview

The document toolbar (`src/components/toolbar.tsx`) currently uses a switch statement to dispatch tool actions based on tool IDs. This approach requires modifying the core toolbar component whenever a new tool is added. In contrast, the tile toolbar system (`src/components/toolbar/tile-toolbar.tsx`) uses a component registration pattern that is more extensible.

This spec proposes refactoring the document toolbar to use a similar component-based registration pattern, which would:
1. Allow tools to provide their own UI and action implementations
2. Enable custom tool UI beyond simple button clicks
3. Unify (or at least align) the approach with the tile toolbar system
4. Reduce coupling between the toolbar component and individual tool implementations

## Current Architecture

### Document Toolbar (`toolbar.tsx`)

**Location**: [src/components/toolbar.tsx](../../src/components/toolbar.tsx)

**Key characteristics**:
- Class component (468 lines) extending `BaseComponent`
- Receives `IToolbarModel` (array of MST `ToolbarButtonModel` objects) as props
- Uses a switch statement in `handleClickTool()` (lines 71-108) to dispatch actions:
  - `select`, `undo`, `redo`, `delete`, `duplicate`, `solution`, `edit`, `selectAll`, `togglePlayback`, `copyToWorkspace`, `copyToDocument` → specific handler methods
  - All other IDs → `handleAddTile()` (creates tile of specified type)
- Each handler method lives in the toolbar component and accesses context via:
  - `this.props.document` / `this.props.section`
  - `this.stores` (injected via MobX)
  - `this.context` (EditableTileApiInterfaceRefContext)

**Tool models** ([src/models/tiles/toolbar-button.ts](../../src/models/tiles/toolbar-button.ts)):
- `BaseToolbarButtonModel` - base MST model with id, title, isDefault, isPrimary, isBottom, height
- `AppToolbarButtonModel` - for document-level tools (non-tile creating), has `iconId`
- `TileToolbarButtonModel` - for tile creation tools, loads icon/title from tile content info
- These models handle icon loading and button metadata, but NOT action logic

### Tile Toolbar System

**Location**: [src/components/toolbar/tile-toolbar.tsx](../../src/components/toolbar/tile-toolbar.tsx)

**Key characteristics**:
- Functional component with hooks (159 lines)
- Uses a **component registry** pattern ([toolbar-button-manager.tsx](../../src/components/toolbar/toolbar-button-manager.tsx))
- Each button is a React component that receives `{ name, args? }` props
- Button components access context via React hooks/contexts:
  - `useContext(TileModelContext)` - current tile model
  - Tile-specific contexts (e.g., `TableToolbarContext`, `GeometryTileContext`)
- Configuration specifies button names (strings), registry resolves to components

**Registration example** ([table-toolbar-registration.tsx](../../src/components/tiles/table/table-toolbar-registration.tsx)):
```typescript
registerTileToolbarButtons("table", [
  { name: "delete", component: DeleteSelectedButton },
  { name: "set-expression", component: SetExpressionButton },
  // ...
]);
```

**Button implementation example**:
```typescript
const DeleteSelectedButton = ({name}: IToolbarButtonComponentProps) => {
  const toolbarContext = useContext(TableToolbarContext);
  return (
    <TileToolbarButton
      name={name}
      title="Clear cell"
      onClick={() => toolbarContext?.deleteSelected()}
    >
      <DeleteSelectedIcon />
    </TileToolbarButton>
  );
};
```

## Proposed Approach: Component Registration for Document Toolbar

### Core Design Decisions

1. **Each tool button registers a React component** that implements its UI and action
2. **Components access context through React Context** (props or context providers)
3. **Configuration continues to use tool IDs** (strings), which resolve to registered components
4. **MST models remain for configuration** but no longer need action methods
5. **Gradual migration** - can keep switch statement for unmigrated tools initially

### New Interfaces

```typescript
// src/components/toolbar/document-toolbar-button-manager.ts

export interface IDocumentToolbarButtonComponentProps {
  name: string;
  args?: string[];
}

export interface IDocumentToolbarButtonInfo {
  name: string;
  component: React.ComponentType<IDocumentToolbarButtonComponentProps>;
}

// Registry functions (similar to tile toolbar)
export function registerDocumentToolbarButton(info: IDocumentToolbarButtonInfo): void;
export function getDocumentToolbarButtonInfo(name: string): IDocumentToolbarButtonInfo | undefined;
```

### New Context Provider

```typescript
// src/components/toolbar/document-toolbar-context.tsx

export interface IDocumentToolbarContext {
  document: DocumentModelType | undefined;
  section: SectionModelType | undefined;
  stores: IStores;
  setActiveTool: (tool: IToolbarButtonModel | undefined) => void;
  defaultTool: IToolbarButtonModel | undefined;
}

export const DocumentToolbarContext = React.createContext<IDocumentToolbarContext | null>(null);
export const useDocumentToolbarContext = () => useContext(DocumentToolbarContext);
```

### Migrated Button Example: Undo

```typescript
// src/components/toolbar/document-toolbar-buttons/undo-button.tsx

import { observer } from "mobx-react";
import { useDocumentToolbarContext } from "../document-toolbar-context";
import { DocumentToolbarButton } from "../document-toolbar-button";
import UndoIcon from "../../../assets/icons/undo-icon.svg";

export const UndoButton = observer(function UndoButton({ name }: IDocumentToolbarButtonComponentProps) {
  const { document } = useDocumentToolbarContext();
  const undoManager = document?.treeManagerAPI?.undoManager;
  const isDisabled = !undoManager?.canUndo;

  const handleClick = () => {
    document?.undoLastAction();
  };

  return (
    <DocumentToolbarButton
      name={name}
      title="Undo"
      onClick={handleClick}
      disabled={isDisabled}
    >
      <UndoIcon />
    </DocumentToolbarButton>
  );
});

// Registration
registerDocumentToolbarButton({ name: "undo", component: UndoButton });
```

### Migrated Button Example: Delete (with confirmation dialog)

```typescript
// src/components/toolbar/document-toolbar-buttons/delete-button.tsx

export const DeleteToolbarButton = observer(function DeleteToolbarButton({ name }: IDocumentToolbarButtonComponentProps) {
  const { document, stores, setActiveTool, defaultTool } = useDocumentToolbarContext();
  const [showConfirmation, setShowConfirmation] = useState(false);

  const selectedTileIds = getSelectedTileIdsInDocument(document, stores);
  const isDisabled = selectedTileIds.length === 0;

  const handleClick = () => {
    setShowConfirmation(true);
    setActiveTool(defaultTool);
  };

  const handleConfirm = () => {
    selectedTileIds.forEach(tileId => {
      stores.ui.removeTileIdFromSelection(tileId);
      document?.deleteTile(tileId);
    });
    setShowConfirmation(false);
  };

  return (
    <>
      <DocumentToolbarButton
        name={name}
        title="Delete"
        onClick={handleClick}
        disabled={isDisabled}
      >
        <DeleteIcon />
      </DocumentToolbarButton>
      {showConfirmation && (
        <ConfirmationDialog onConfirm={handleConfirm} onCancel={() => setShowConfirmation(false)} />
      )}
    </>
  );
});
```

### Migrated Toolbar Component

```typescript
// src/components/toolbar.tsx (refactored)

export const DocumentToolbar = observer(function DocumentToolbar({ document, section, toolbarModel, ... }: IProps) {
  const stores = useStores();
  const [defaultTool, setDefaultTool] = useState<IToolbarButtonModel | undefined>();
  const [activeTool, setActiveTool] = useState<IToolbarButtonModel | undefined>();

  useEffect(() => {
    const defaultTool = toolbarModel.find(item => item.isDefault);
    setDefaultTool(defaultTool);
    setActiveTool(defaultTool);
  }, [toolbarModel]);

  const contextValue: IDocumentToolbarContext = useMemo(() => ({
    document,
    section,
    stores,
    setActiveTool,
    defaultTool,
  }), [document, section, stores, defaultTool]);

  const renderButton = (toolButton: IToolbarButtonModel) => {
    const buttonInfo = getDocumentToolbarButtonInfo(toolButton.id);
    if (buttonInfo) {
      // Use registered component
      const ButtonComponent = buttonInfo.component;
      return <ButtonComponent key={toolButton.id} name={toolButton.id} />;
    } else {
      // Fallback: tile creation or legacy handling
      return <TileCreationButton key={toolButton.id} toolButton={toolButton} />;
    }
  };

  return (
    <DocumentToolbarContext.Provider value={contextValue}>
      <div className="toolbar">
        {toolbarModel.map(renderButton)}
      </div>
    </DocumentToolbarContext.Provider>
  );
});
```

## Unification Considerations

### Option A: Separate Registries (Recommended)

Keep document toolbar and tile toolbar registries separate:
- `registerDocumentToolbarButton(info)` - for document-level tools
- `registerTileToolbarButtons(tileType, infos)` - for tile-specific tools

**Pros**:
- Clear separation of concerns
- Different context requirements (document vs tile)
- Easier to reason about

**Cons**:
- Two similar but separate systems

### Option B: Unified Registry with Namespacing

Single registry with namespaced keys:
- `registerToolbarButton("document", "undo", component)`
- `registerToolbarButton("table", "delete", component)`

**Pros**:
- Single pattern to learn
- Shared infrastructure

**Cons**:
- More complex lookup logic
- Context requirements differ significantly

### Option C: Shared Base Infrastructure

Create shared utilities that both systems use:
- `ToolbarButtonWrapper` - common button styling/behavior
- `useToolbarButtonState` - common disabled/active state logic
- Separate registries but shared components where possible

**Pros**:
- Code reuse without forced unification
- Flexibility to evolve independently

**Cons**:
- More files/abstractions

## Migration Strategy

### Phase 1: Infrastructure Setup
1. Create `DocumentToolbarContext` and provider
2. Create `document-toolbar-button-manager.ts` with registry functions
3. Create `DocumentToolbarButton` wrapper component (similar to `TileToolbarButton`)
4. Modify `toolbar.tsx` to check registry before switch statement

### Phase 2: Migrate Non-Tile Tools
Migrate in order of complexity:
1. `undo` - simple, no state
2. `redo` - simple, no state
3. `select` - simple toggle
4. `selectAll` - simple toggle
5. `togglePlayback` - simple toggle
6. `edit` - simple action
7. `duplicate` - needs selected tiles
8. `copyToWorkspace` - needs selected tiles + async
9. `copyToDocument` - needs dialog
10. `solution` - needs toggle state
11. `delete` - needs confirmation dialog (already has `DeleteButton` component)

### Phase 3: Handle Tile Creation Tools
Options for tile creation buttons:
- **Option A**: Keep as special case in toolbar with generic `TileCreationButton`
- **Option B**: Register each tile type as a button component
- **Option C**: Single `AddTileButton` that takes tileType as arg

### Phase 4: Convert to Functional Component
- Convert `ToolbarComponent` class to functional component
- Remove switch statement entirely
- Clean up legacy code

### Phase 5: Evaluate Unification
- Assess whether document and tile toolbars should share more infrastructure
- Consider extracting common patterns to shared utilities

## File Structure

```
src/components/toolbar/
├── document-toolbar-button-manager.ts    # Registry (new)
├── document-toolbar-context.tsx          # Context provider (new)
├── document-toolbar-button.tsx           # Button wrapper (new)
├── document-toolbar-buttons/             # (new folder)
│   ├── undo-button.tsx
│   ├── redo-button.tsx
│   ├── select-button.tsx
│   ├── delete-toolbar-button.tsx
│   ├── duplicate-button.tsx
│   ├── solution-button.tsx
│   ├── edit-button.tsx
│   ├── select-all-button.tsx
│   ├── toggle-playback-button.tsx
│   ├── copy-to-workspace-button.tsx
│   ├── copy-to-document-button.tsx
│   └── tile-creation-button.tsx
├── tile-toolbar.tsx                      # (existing)
├── tile-toolbar-button.tsx               # (existing)
└── toolbar-button-manager.tsx            # (existing - tile registry)
```

## Questions

Q: Should the document toolbar buttons have access to the `onToolClicked` callback that allows the parent to intercept clicks?
A: Probably yes - this would need to be included in the context or passed as a prop to each button component. The current implementation uses this to allow parent components to prevent default actions.

Q: Should we keep the MST `ToolbarButtonModel` types or replace them with plain objects/interfaces?
A:
- (a) Keep MST models - they handle icon loading and are already integrated with configuration
- (b) Replace with plain interfaces - simpler, but requires migration of icon loading logic
- (c) Hybrid - keep models for configuration, but button components don't depend on them directly

Q: How should tile creation buttons work in the new system?
A:
- (a) Generic `TileCreationButton` component that takes `toolButton` prop and handles all tile types
- (b) Register each tile type separately (e.g., `registerDocumentToolbarButton({ name: "geometry", component: GeometryTileButton })`)
- (c) Single `AddTileButton` that uses `args` to specify tile type

Q: Should button components receive the full `IToolbarButtonModel` or just the name/args?
A:
- (a) Full model - buttons have access to title, isPrimary, height, etc.
- (b) Just name/args - buttons look up what they need from context or separate sources
- (c) Relevant subset - define what props buttons actually need

Q: Should we create a shared `ToolbarButton` component that both document and tile toolbar buttons can use, or keep them separate?
A:
- (a) Shared base component - reduces duplication, ensures consistent styling
- (b) Separate components - different requirements may justify separate implementations
- (c) Shared styles only - CSS sharing without component coupling

Q: The current delete button has special handling (`DeleteButton` component with confirmation). Should this pattern continue or be absorbed into the registered component?
A:
- (a) Absorb into registered component - the registered `DeleteToolbarButton` handles its own confirmation dialog
- (b) Keep separate - toolbar renders a wrapper that handles confirmation, calls the action handler
- (c) Use a common pattern - create a `ConfirmableToolbarButton` that any button can use

Q: How should button disabled state be determined?
A:
- (a) Each button component manages its own disabled state (current tile toolbar approach)
- (b) Toolbar passes `isDisabled` prop based on centralized logic
- (c) Context provides helper functions (e.g., `useIsToolDisabled(toolId)`)

Q: Should we migrate the toolbar to a functional component as part of this refactor, or as a separate effort?
A:
- (a) Migrate as part of this refactor - cleaner end result
- (b) Separate effort - reduces scope of this change
- (c) Keep as class component - if there's a reason it needs to be a class

Q: The current toolbar has drag-and-drop support for tile creation (`handleDragNewTile`). How should this work with registered components?
A:
- (a) Tile creation buttons handle their own drag events
- (b) Toolbar wrapper provides drag handling, buttons opt-in
- (c) Keep drag handling in toolbar, only applies to tile creation buttons
