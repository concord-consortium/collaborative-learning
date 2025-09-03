# CLUE CMS

[See the full documentation in `docs/cms.md`](../docs/cms.md)

## Overview
This folder contains the source code and build configuration for the CLUE CMS, a content management system for authoring curriculum content in the Collaborative Learning User Environment (CLUE). The CMS is based on [Decap CMS](https://decapcms.org/) and is customized to support CLUE's curriculum structure and workflow.

## Features
- Edit curriculum content in the `clue-curriculum` repository via a web interface
- Custom widgets for CLUE document editing and previewing
- Support for GitHub and local git proxy backends
- Flexible configuration via URL parameters

## Documentation
For detailed usage, configuration, and troubleshooting, see [`docs/cms.md`](../docs/cms.md).

## Getting Started

### Prerequisites
- Node.js and npm
- Access to the `clue-curriculum` repository
- (Optional) Local git proxy for development

### Install dependencies
```bash
npm install
```

### Start the CMS for local development
```bash
npm start
```
This runs the CMS on a local development server (default port: 8081).

### Typical local development workflow
1. Start CLUE (`npm start` in the top-level folder)
2. (Optional) Start the local git proxy in the `clue-curriculum` repo: `npx netlify-cms-proxy-server`
3. Start the CMS (`npm start` in this folder)
4. Open the CMS in your browser with appropriate URL parameters (see docs)

## Build & Deployment
- Production builds: `npm run build`
- Output is placed in `dist/` and copied to the main CLUE `dist/cms` folder during CI
- The main entry point for authors is `admin.html`

## Architecture
- The CMS is configured in `src/init-cms.ts` and uses custom widgets in `src/`
- The document editor is embedded via iframe (`cms-editor.html`)
- Webpack is used for building and bundling assets (`webpack.config.js`)
- TypeScript configuration is in `tsconfig.json`

## Scripts
- `npm start` — Start development server on port 8082
- `npm run build` — Build for production
- `npm run lint` — Lint source files
- `npm test` — Run tests (if present)

## Contributing
See the [full documentation](../docs/cms.md) for advanced configuration, known issues, and development notes.

## License
MIT — see LICENSE in the root of the repository.
