# Build Performance Optimization

## Summary

**Status: Implemented** (February 2026)

Replaced `ts-loader` with `swc-loader` + `ForkTsCheckerWebpackPlugin` for ~3x faster builds.

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Dev initial build | ~31s | ~10s | 3x faster |
| Core file rebuild | ~2.2s | ~0.7s | 3x faster |

TypeScript errors still appear in the browser overlay via ForkTsCheckerWebpackPlugin.

## Problem Statement

The CLUE codebase had slow build times that impacted developer productivity and CI pipeline duration:
- Full production builds took ~48 seconds
- Incremental rebuilds during development were slow (2+ seconds for core files)
- These issues cascaded into Cypress test duration

## Codebase Metrics
- ~145,000 lines of TypeScript/TSX
- ~1,074 source files
- 5 webpack entry points (index, iframe, doc-editor, authoring, standalone)
- 880MB node_modules / ~180 dependencies

## Build Architecture

### Current (after optimization)
- **Transpilation**: `swc-loader` (fast Rust-based transpiler, no type checking)
- **Type Checking**: `ForkTsCheckerWebpackPlugin` (runs in parallel, reports to overlay)
- **Linting**: `ESLintPlugin` with `lintDirtyModulesOnly` in dev mode

### Previous (before optimization)
- **Transpilation**: `ts-loader` (performed both transpilation AND type checking, blocking)
- **Linting**: `ESLintPlugin` (ran on all files during compilation)
- **Both were synchronous/blocking**: Build waited for type checking and linting to complete

### Comparison with Similar Codebases

| Codebase | Size | Build Time | Notes |
|----------|------|------------|-------|
| CLUE | 145K LoC | 48s | ts-loader + ESLintPlugin |
| Mews (pre-optimization) | 1M+ LoC | 5+ min | Later achieved 80% reduction with Rspack |
| Slack (before) | Large | 170s median | Achieved 10x improvement |
| Slack (after) | Large | 17s median | Via parallel processing |

Our build time is within normal ranges but has room for improvement.

## Options Considered

### Option 1: swc-loader + ForkTsCheckerWebpackPlugin (Implemented)

**Description**: Replace `ts-loader` with `esbuild-loader` for fast transpilation. Run TypeScript type checking in a parallel process using `ForkTsCheckerWebpackPlugin`. Configure `eslint-webpack-plugin` to use thread pooling.

**Pros**:
- Significant speed improvement (benchmarks show esbuild 10-12x faster than tsc for transpilation)
- Type errors still appear in webpack dev server overlay (maintains current DX)
- ESLint errors still appear in overlay
- Non-blocking: page loads while checking continues in background
- Minimal changes to developer workflow

**Cons**:
- Errors may appear slightly after initial page load rather than blocking it
- Two packages to configure instead of one
- esbuild doesn't support all TypeScript features (though most are covered)

### Option 2: Monorepo Architecture

**Description**: Split the codebase into multiple packages so only changed packages need rebuilding.

**Pros**:
- Only rebuild what changed
- Better code organization and boundaries
- Could enable independent deployment of components

**Cons**:
- Significant architectural change
- Adds complexity (package management, versioning, build orchestration)
- Migration effort would be substantial
- May not help if most changes touch shared code

**Decision**: Discarded for now. The complexity cost is high and Option 1 addresses the immediate pain with less risk.

### Option 3: Switch to Vite/Rspack

**Description**: Replace webpack entirely with a faster bundler.

**Pros**:
- Vite: Native ESM dev server, very fast HMR
- Rspack: Rust-based webpack-compatible bundler, 80% faster in case studies

**Cons**:
- Significant migration effort
- Risk of compatibility issues with existing loaders/plugins
- Team would need to learn new tooling
- Some webpack-specific configurations may not transfer

**Decision**: Discarded for now. Worth revisiting if Option 1 doesn't provide sufficient improvement, but the migration risk isn't justified as a first step.

### Option 4: Remove Type Checking/Linting from Build Entirely

**Description**: Run `tsc --watch` and `eslint --watch` as separate terminal processes.

**Pros**:
- Fastest possible webpack builds
- Each tool runs independently

**Cons**:
- **Loses webpack dev server overlay for errors** - This is critical. The overlay makes errors annoying enough that developers fix them immediately rather than letting them accumulate.
- Developers must monitor multiple terminals
- Errors could be missed more easily

**Decision**: Discarded. The webpack overlay is a key part of enforcing code quality during development.

### Option 5: Improve VSCode Integration Instead

**Description**: Rely on VSCode's TypeScript and ESLint extensions for error feedback, remove from build.

**Pros**:
- VSCode provides inline error highlighting
- Problems panel aggregates all errors

**Cons**:
- VSCode TypeScript server can get out of sync, especially with complex MST types
- Problems panel can be noisy (errors in files you're not working on)
- Not all developers use VSCode
- Still need checks in CI
- No "forcing function" like the overlay to make developers address errors

**Decision**: Discarded as primary solution. VSCode integration is complementary but doesn't replace the overlay's effectiveness at catching issues early.

### Option 6: Terminal-Based Multi-Watch (mprocs, tmux)

**Description**: Use tools like `mprocs` to run multiple watchers with a TUI for switching between them.

**Pros**:
- Can see output from multiple processes
- Tools like mprocs allow expanding/collapsing individual process output

**Cons**:
- Same problem as Option 4: no browser overlay
- Additional tooling for developers to learn
- Doesn't integrate with existing webpack dev server workflow

**Decision**: Discarded. Could be useful as a complement but doesn't solve the overlay problem.

## Implemented Solution

**Option 1: swc-loader + ForkTsCheckerWebpackPlugin** (implemented February 2026)

We used `swc-loader` instead of `esbuild-loader` because CODAP v3 uses swc-loader with the
same MST-based architecture and has proven it works well.

### Architecture

```
webpack-dev-server
├── swc-loader (fast transpile only, no type check)
├── ForkTsCheckerWebpackPlugin ──► reports TS errors ──► overlay
└── eslint-webpack-plugin (lintDirtyModulesOnly) ──► reports lint errors ──► overlay
```

### Changes Made
1. Installed `@swc/core`, `swc-loader`, and `fork-ts-checker-webpack-plugin`
2. Replaced `ts-loader` with `swc-loader` (kept ts-loader for CODE_COVERAGE builds)
3. Added `ForkTsCheckerWebpackPlugin` with 4GB memory limit
4. Configured `ESLintPlugin` with `lintDirtyModulesOnly: devMode`

### Notes
- **CODE_COVERAGE builds**: Still use `ts-loader` with `transpileOnly: true` for compatibility
  with istanbul code coverage instrumentation
- **Memory limit**: Set to 4GB for ForkTsCheckerWebpackPlugin to handle large type graphs
- **Error timing**: TypeScript errors appear in overlay shortly after page loads (not blocking)

## Measuring Build Performance

Use the measurement script to get baseline and comparison metrics:

```bash
# Measure with default settings (5 samples, touches src/index.tsx)
node scripts/measure-rebuild-time.cjs

# Measure with specific file and sample count
node scripts/measure-rebuild-time.cjs --samples 5 --file src/models/stores/stores.ts
```

The script:
1. Starts webpack-dev-server
2. Waits for initial build to complete
3. Touches the specified file to trigger rebuild
4. Measures time until rebuild completes
5. Repeats for N samples and reports min/max/avg/median

## Future Considerations

If Option 1 doesn't provide sufficient improvement, consider:
1. Profiling to identify other bottlenecks (specific loaders, plugins)
2. Rspack migration (webpack-compatible, significantly faster)
3. Monorepo for very large changes (if codebase continues to grow)
