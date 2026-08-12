# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CLUE (Collaborative Learning User Environment) is an educational platform built by the Concord Consortium for the MSU Inscriptions project. It enables collaborative document editing with modular tile-based content.

## Common Commands

```bash
# Development
npm install                    # Install dependencies
npm start                      # Start dev server with hot module replacement
npm run start:secure           # Start with HTTPS (requires local SSL certs)

# Building
npm run build                  # Full production build (lint + webpack)
npm run build:webpack          # Webpack bundling only

# Testing
npm test                       # Run all Jest tests
npm test -- path/to/test.ts   # Run a single Jest test
npm run test:coverage          # Run tests with coverage report
npm run test:cypress           # Run Cypress E2E tests headless
npm run test:cypress:open      # Open Cypress interactive UI

# Code Quality
npm run lint                   # ESLint check (use during development)
npm run lint:build             # Stricter check that also flags unnecessarily disabled rules — run before committing
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
- `src/authoring/` - Custom authoring system frontend
- `authoring-api/` - Authoring system backend API

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
- `authoring/` - Custom authoring system

**className construction**: When a JSX element has any conditional or computed class, use the `classnames` helper (`import classNames from "classnames"`) rather than template literals or string concatenation. Pass static classes as bare strings, conditional classes via the object form, and any precomputed class variable as another argument. Example: `classNames("history-entry-item", sourceClass, { expanded, "not-undoable": !undoable })`. A plain string literal is fine only when there are no conditions or interpolations at all.

**Authoring configuration docs**: The unit `config` options (the `UnitConfiguration` interface in [src/models/stores/unit-configuration.ts](src/models/stores/unit-configuration.ts)) are documented for curriculum authors in [docs/unit-configuration.md](docs/unit-configuration.md). Whenever you add, remove, or change an authorable `config` property (or other authorable unit setting), update that doc in the same change to keep it in sync.

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
- **React 17**: Upgrading to 18 requires updating several other dependencies (see dependencies-notes.md)
- **Firebase 8**: v9 requires substantial migration work
- **mobx-state-tree**: Uses Concord's custom fork with bug fixes
- **nanoid 3**: v4 is ESM-only and breaks dependencies

## Testing Notes

- Firebase test rules require Node.js 16.x and Java for emulators
- Some tests target production database (qa/test partitions) - prefer emulator
- Cypress tests may require portal credentials in `cypress.env.json`
- See `.cursor/rules/testing.mdc` for test runner commands

### Cypress dev-server port (worktrees / non-default port)

The default cypress base URL is `http://localhost:8080/`, hard-coded in
`cypress/config/cypress.local.json`. The `setupNodeEvents` function in
[cypress.config.ts](cypress.config.ts) merges that file LAST
(`{ ...config, ...envConfig }`), so it overrides both the `baseUrl` field in
`cypress.config.ts` and any `CYPRESS_BASE_URL` env var or `--config baseUrl=...`
CLI flag. The merge happens because `npm run test:cypress` passes
`--env testEnv=local`.

To run cypress against a dev server on a different port (e.g. when running
multiple worktrees with their own `npm start` instances), invoke cypress
directly without `--env testEnv=local`:

```bash
npx cypress run --spec 'cypress/e2e/...' --config baseUrl=http://localhost:8083/
```

Symptom of getting this wrong: tests pass/fail against an unrelated repo's dev
server, the cypress config log prints the desired baseUrl but
`cy.window().then(w => w.location.href)` shows the default port. Verify by
having a test print `window.location.href`.

### Running one cypress spec in CI

A full `CI Regression` cycle is ~10 minutes and only runs when a PR carries the
`run regression` label. To iterate on a single spec, dispatch the **Manual
Regression** workflow, whose `single-test` job runs exactly one spec (~2 min):

```bash
gh workflow run manual-regression.yml --ref <branch> \
  -f branch=<branch> -f browser=chrome \
  -f test=functional/tile_tests/<your>_spec.js
```

The `test` input is a `choice`, so **a new spec must be added to the list in
[.github/workflows/manual-regression.yml](.github/workflows/manual-regression.yml)
before it can be dispatched.** Add it when you add the spec.

### `/editor/` renders the document more than once

The standalone doc-editor route mounts the same document in **three** panes — the
main editable one, a Read Only Local copy, and a Read Only Remote (emulated) copy.
Any unscoped count in a spec — `cy.get('.tile-row')`, `cy.get('.some-tile')` — is
therefore 3× what the document contains, and `.first()` matters when interacting.

**Always pass `noStorage=true` when testing cross-tile behavior on this route.**
The doc-editor restores a document from `sessionStorage` and builds a model from
it ([doc-editor-app.tsx](src/components/doc-editor/doc-editor-app.tsx):32-42),
then *replaces* that model once the `document=` param finishes loading. An
`onSnapshot` effect writes the document back to session storage on every change,
so a fixture with a running Simulator repopulates it constantly.

The consequence is nasty: tile types that register **lazily** (Drawing among
them) can stay bound to the superseded document instance while eagerly-present
tiles move to the newly loaded one, leaving **two document-content instances in a
single pane**. Anything depending on shared ephemeral state — highlight refs,
hover, selection, all volatile and per-document — then silently does nothing
between the two groups of tiles.

This does not reproduce under Cypress, which starts with clean session storage.
It reproduces immediately in a browser tab you have been using for a while, and
presents as "the feature works in CI and does nothing on my screen." Symptom to
recognize: `window.currentDocument.content.activeRef` is `undefined` while the
effect of that ref is plainly visible in another tile.

**The three panes are two models, by design.** The editable pane and the Read
Only Local copy share the same `document`; the Read Only Remote copy renders a
separate `remoteDocument`
([doc-editor-app.tsx](src/components/doc-editor/doc-editor-app.tsx):293,299),
rebuilt from a snapshot on every document change. So a ring, selection, or other
volatile state set in the editable pane will never appear in the remote copy —
that is expected, not a bug.

Instrumenting `getDocumentContentFromNode` from inside tile components turned up
*more* instances than that — four on one page, with the text tile and the drawing
tiles on different ones. Those extras came from the sessionStorage restore
described above, not from the panes. With `noStorage=true` the pane count alone
does not split tiles across trees.

Consequences for testing:

- **`noStorage=true` is the part that matters for correctness.** Without it, two
  tiles that depend on shared ephemeral state (highlight refs, hover, selection —
  all volatile and per-document) may sit in different trees and silently fail to
  talk to each other. With it, the editable pane is a valid place to verify such
  behavior by hand, panes and all.
- Disabling the read-only copies is about *assertions*, not correctness. The
  remote copy is a separate document, so an unscoped selector can be satisfied by
  a match there while the editable pane shows nothing. Scope per pane, or turn
  the copies off via the `clue-doc-editor-settings` localStorage key — the
  highlight spec does the latter.
- Assertions that a tile does *not* exist after a deletion do hold unscoped: the
  local read-only copy shares the editable pane's model, and the remote copy is
  rebuilt from the snapshot, so all three follow the deletion. The exception is
  the sessionStorage split above — one more reason to pass `noStorage=true`.

Also: `.primary-workspace` does not exist on this route (it is a CLUE workspace
class), so page objects built on it — including most of `cypress/support/elements`
— do not work there. Select directly, or pass a different `workspaceClass`.

### Branch preview URLs

Branch builds deploy to `https://collaborative-learning.concord.org/branch/[name]/`,
but the deploy action **strips a leading ticket prefix** from the folder name:
branch `CLUE-603-linked-representation-references` deploys to
`/branch/linked-representation-references/`. Guessing the full branch name gives a
404. The real URL is on the GitHub deployment status:

```bash
D=$(gh api repos/{owner}/{repo}/deployments \
  --jq '[.[] | select(.ref=="refs/heads/<branch>")][0].id')
gh api repos/{owner}/{repo}/deployments/$D/statuses --jq '.[0].environment_url'
```

Relative `unit=` / `document=` URL params work on these deploys: they are resolved
against the webpack public path (the branch root) rather than the page, via
`getAssetUrl` — see the comment in `doc-editor-app.tsx`.
