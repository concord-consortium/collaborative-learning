# Wave Runner Tile — Design

## Purpose

The Wave Runner tile will allow students to download, view, and run machine learning models on seismic wave data. This initial implementation creates the tile scaffold only; ML/seismic functionality will be added later.

## Approach

Copy the starter tile template and rename all references from `starter`/`Starter` to `wave-runner`/`WaveRunner`.

## Files to Create

```
src/plugins/wave-runner/
├── assets/
│   ├── wave-runner-icon.svg        # Toolbar icon ("WR")
│   └── wave-runner-tile-id.svg     # Header icon ("WR")
├── wave-runner-types.ts
├── wave-runner-content.ts
├── wave-runner-content.test.ts
├── wave-runner-tile.tsx
├── wave-runner-tile.test.tsx
├── wave-runner-registration.ts
└── wave-runner.scss
```

## Files to Modify

- `src/register-tile-types.ts` — Add WaveRunner registration entry
- `src/public/demo/units/qa/content.json` — Add WaveRunner to QA unit toolbar

## Tile Configuration

- Type constant: `"WaveRunner"`
- Display name: `"Wave Runner"`
- Default height: 320px
- Resizable: yes
- Icon text: "WR"
