# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CLUE (Collaborative Learning User Environment) is an educational platform built by the Concord Consortium for the MSU Inscriptions project. It enables collaborative document editing with modular tile-based content.

## Common Commands

```bash
# Development
npm install                    # Install dependencies (also run in /cms subdirectory)
npm start                      # Start dev server with hot module replacement
npm run start:secure           # Start with HTTPS (requires local SSL certs)

# Building
npm run build                  # Full production build (lint + webpack + cms)
npm run build:webpack          # Webpack bundling only

# Testing
npm test                       # Run all Jest tests
npm test -- path/to/test.ts   # Run a single Jest test
npm run test:coverage          # Run tests with coverage report
npm run test:cypress           # Run Cypress E2E tests headless
npm run test:cypress:open      # Open Cypress interactive UI

# Code Quality
npm run lint                   # ESLint check
npm run lint:fix               # ESLint with auto-fix
npm run check:types            # TypeScript type checking

# Firebase
npm run deploy:firestore:rules # Deploy Firestore security rules
npm run deploy:database:rules  # Deploy realtime database rules
```

## Architecture

### Technology Stack
- **React 17** with **TypeScript 4.9**
- **MobX State Tree (MST)** for state management (using Concord's custom fork `@concord-consortium/mobx-state-tree`)
- **Firebase 8** for realtime database and Firestore
- **Webpack 5** for bundling with code splitting
- **Jest** for unit tests, **Cypress** for E2E tests

### Directory Structure
- `src/models/` - Core MST state models and business logic
  - `stores/` - Global application state (documents, user, UI, etc.)
  - `document/` - Document and tile models
  - `tiles/` - Built-in tile type models
  - `shared/` - Shared models for cross-tile data linking
- `src/plugins/` - Dynamically loaded tile implementations (graph, drawing, dataflow, etc.)
- `src/components/` - React UI components
- `src/lib/` - Core services (db.ts, firestore.ts, auth.ts, logger.ts)
- `src/utilities/` - Helper functions
- `functions-v2/` - Google Cloud Functions (actively maintained)
- `cms/` - Content Management System for authoring

### Plugin/Tile System

Tiles are modular content blocks loaded dynamically. Each tile plugin in `src/plugins/` contains:
- Content model (MST) - state and actions
- React component - UI rendering
- Registration file - registers with the tile system
- Assets - toolbar icons

To add a new tile:
1. Copy `src/plugins/starter/` as a template
2. Rename files and update tile type constants
3. Register in `src/register-tile-types.ts`
4. Add to unit toolbar configuration (e.g., `src/public/demo/units/qa/content.json`)

See [tiles.md](tiles.md) for detailed tile documentation.

### Key Patterns

**MST Models**: All state uses MobX State Tree with strong typing. Models have properties, views (computed), and actions (mutations).

**Shared Models**: Tiles can share data via SharedDataSet, SharedVariables, etc. The `SharedModelDocumentManager` coordinates shared models across documents.

**Document Structure**: Documents contain tiles organized in rows/sections. Each tile has a TileModel wrapper with type-specific content.

**Multi-Entry Points**: Webpack builds multiple entry points:
- `index.tsx` - Main CLUE application
- `doc-editor.tsx` - Standalone document editor (`/editor/`)
- `authoring/` - CMS authoring system

### URL Parameters for Testing

| Parameter | Values | Purpose |
|-----------|--------|---------|
| `appMode` | `dev`, `qa`, `test` | Unsecured modes for testing |
| `unit` | URL or unit code | Curriculum unit to load |
| `problem` | `2.1`, `3.2`, etc. | Problem selection |
| `firebase` | `emulator` or URL | Target Firebase emulator |
| `firestore` | `emulator` or URL | Target Firestore emulator |
| `debug` | see README | Enable debug features |

### Debugging

Set `debug` in localStorage to enable features:
- `stores` - exposes `window.stores`
- `document` - exposes `window.currentDocument`
- `history` - enables history debugging
- `logger` - logs all events to console

## Dependency Notes

Some dependencies are locked to specific versions:
- **React 17**: Cannot upgrade due to netlify-cms-app dependency
- **Firebase 8**: v9 requires substantial migration work
- **mobx-state-tree**: Uses Concord's custom fork with bug fixes
- **nanoid 3**: v4 is ESM-only and breaks dependencies

## Testing Notes

- Firebase test rules require Node.js 16.x and Java for emulators
- Some tests target production database (qa/test partitions) - prefer emulator
- Cypress tests may require portal credentials in `cypress.env.json`
- See `.cursor/rules/testing.mdc` for test runner commands
