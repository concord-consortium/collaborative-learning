# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CLUE (Collaborative Learning User Environment) is a web-based collaborative learning platform built by The Concord Consortium. It enables real-time collaboration among students working on educational activities through a tile-based document system.

## Common Commands

```bash
# Development
npm install                    # Install dependencies (also run in cms/ subdirectory)
npm start                      # Start webpack-dev-server with hot reload
npm run build                  # Production build to dist/

# Testing
npm test                       # Run all Jest tests
npm test -- path/to/file.test.ts  # Run a single Jest test
npm run test:coverage          # Jest tests with coverage report
npm run test:cypress           # Run Cypress tests headless
npm run test:cypress:open      # Open Cypress interactive UI

# Code Quality
npm run lint                   # Run ESLint
npm run lint:fix               # Auto-fix ESLint issues
npm run check:types            # TypeScript type checking
```

## Architecture

### State Management: MobX State Tree (MST)
The project uses a Concord-customized version of MST (`@concord-consortium/mobx-state-tree`). Key patterns:
- **Stores** (`src/models/stores/stores.ts`): Global app state combining user, documents, groups, UI state, and curriculum
- **Document Model** (`src/models/document/document.ts`): Extends `Tree` class for history tracking, manages content, comments, and shared models
- **Volatile state**: Use for transient data that shouldn't be persisted

### Tile System
Tiles are reusable content blocks that students interact with. Each tile has:
- **Model** (`src/models/tiles/` or `src/plugins/`): MST-based state extending `TileContentModel`
- **Component** (`src/components/tiles/` or plugin directories): React UI component
- **Registration** (`src/register-tile-types.ts`): Dynamic, lazy-loaded via webpack code-splitting

Built-in tiles: Text, Table, Geometry, Image, Question
Plugin tiles: Drawing, Graph, Bar Graph, Expression, Dataflow, Diagram, Numberline, Simulator, Data Card

### Shared Models
Tiles share state through shared models stored at document level in `sharedModelMap`. Key patterns:
- Access via `self.tileEnv?.sharedModelManager`
- Use MobX `reaction` in `afterAttach` to set up shared model links
- Implement `updateAfterSharedModelChanges()` to respond to shared model changes
- Do NOT use autorun/reaction to monitor shared model changes directly (breaks undo/redo)

### Document Structure
```
DocumentContent
├── tileMap: { tileId → TileModel }
├── rows: [ TileRow ]  // Layout structure
├── sharedModelMap: { modelId → SharedModelEntry }
└── annotations: [ ArrowAnnotation ]
```

### Entry Points
- `/src/index.tsx`: Main runtime
- `/src/doc-editor.tsx`: Standalone document editor
- `/src/cms/document-editor.tsx`: Content management system

### Key Directories
```
src/
├── models/          # MST models (stores, document, tiles, history, shared)
├── plugins/         # Feature tiles (drawing, graph, dataflow, etc.)
├── components/      # React UI components
├── lib/             # Core utilities (Firebase, logging)
├── clue/            # CLUE-specific configuration and styling
└── hooks/           # React custom hooks
```

## Testing

### Firebase/Firestore Testing
Requires Node 16.x and firebase-tools@12. Tests require emulator running:
```bash
cd firebase-test
npm run start &
npm run test
```

### Cypress Test Credentials
Create `cypress.env.json` (gitignored):
```json
{
  "auth": {
    "username": "your-username",
    "password": "your-password"
  }
}
```

### URL Parameters for Testing
- `appMode`: `dev`, `qa`, `test` - Unsecured modes partitioned from production
- `firebase=emulator`, `firestore=emulator`, `functions=emulator` - Target emulators
- `fakeUser`: `student:<id>` or `teacher:<id>` - Simulate user type

## Debugging

Set localStorage `debug` key with comma-separated values:
- `canvas`: Show document key over canvas
- `document`: Access active document via `window.currentDocument`
- `history`: Print history system info, access `window.historyDocument`
- `stores`: Access `window.stores` in browser console
- `undo`: Print undo stack information

## Code Conventions

- Use TypeScript with strong typing
- ESLint enforces: `semi`, `eqeqeq`, `no-var`, `prefer-const`, max line length 120
- Test files use `.test.ts` or `.test.tsx` extension
- Tile content models must implement `updateAfterSharedModelChanges()` if using shared models
