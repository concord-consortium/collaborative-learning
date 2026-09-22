# CLUE-371 Harness — Milestone 1 Implementation

Status: implementation spec for milestone 1 of [CLUE-371-harness-plan.md](./CLUE-371-harness-plan.md). Written to be handed to a coding agent or developer as a self-contained work order. Revision 4 — revision 2 addressed an external (Codex) review (see "Review disposition" at the end); revision 3 is an editorial consistency pass; revision 4 splits A4's tests across two files.
Scope: shared message-builder extraction, harness skeleton, synthetic corpus, text-only runs, cache, spend ceiling, reports as data (no HTML). Nothing else — see "Out of scope" at the end.
Branching: this is spike work — milestone branches PR into the long-running `CLUE-371` integration branch, not `master`. See "Branch and review strategy" in the harness plan.

## Why this shape (one paragraph of context)

The harness compares text vs. image vs. text+image representations of student documents by running them through the same AI call production makes. Milestone 1 builds the frame: the pieces that assemble AI requests get moved to `shared/` so production and the harness use identical code, and the harness gets a working end-to-end path for text-only runs against a small committed corpus of synthetic documents. Images, mixed mode, and production data come in later milestones.

## Canonical serialization (used everywhere; define once)

Several features hash JSON values (cache keys, prompt provenance, experiment hashes, resume identity). Define one function in `src/schemas.ts` — `canonicalJson(value)`: recursively sort object keys, no whitespace, UTF-8 — and one `sha256Canonical(value)` helper. Every hash in this document means `sha256Canonical` unless it says "file bytes."

## Part A — extract the shared message builders (a production refactor)

**A1. Dependency layout — resolve this first, it gates everything.** `shared/ai-analysis-messages.ts` imports `zod` and `openai` (the `zodResponseFormat` helper is a runtime import; the message-param types are type-only). Node resolves bare imports upward from the *imported file's* directory — `shared/` → repo root — and the root `node_modules` contains neither `openai` nor `zod`. So the harness, importing the shared file in place via `tsx`, would fail to resolve them; it works from `functions-v2` today only because that package compiles shared source into its own tree. The fix: **give `shared/` its own dependencies.** Extend `shared/package.json` (currently just `{"type": "module"}`):

```json
{
  "type": "module",
  "name": "clue-shared",
  "private": true,
  "dependencies": {
    "openai": "<exact version from functions-v2/package-lock.json>",
    "zod": "<exact version from functions-v2/package-lock.json>"
  }
}
```

Run `npm install` in `shared/` and commit the lockfile. Exact versions, not ranges: `shared/node_modules` is what the harness resolves at runtime, while deployed functions resolve `functions-v2/node_modules` — behavior parity requires the versions to be identical. A lockstep test (implemented in the harness test suite; acceptance criterion 3) reads all three lockfiles — `shared/`, `functions-v2/`, `scripts/ai-harness/` — and asserts the resolved `openai` and `zod` versions match, so they can't drift silently. `functions-v2`'s compile picks up `shared/node_modules` types (nearest-first resolution) — same versions, so no conflict; if `tsc` surfaces duplicate-type issues, resolve with the same alias approach its tsconfig already uses for `firebase-admin`, not by restructuring.

**A2. The move.** New file `shared/ai-analysis-messages.ts` containing, from `functions-v2/lib/src/ai-categorize-document.ts`:

- Types: `IAiPrompt`, `AgreementInfo`, `Agreements`, `RelatedSummary`
- Data: `defaultAiPrompt`
- Functions: `buildZodResponseSchema`, `categorizationResponseFormat`, `buildImageMessages`, `buildSummaryMessages`

Note: `IAiPrompt`, `defaultAiPrompt`, and `categorizationResponseFormat` are **not currently exported** — the move adds `export` to them; that is the only intended change beyond relocation (the `AgreementValue` import becomes `./shared`). No `firebase-functions`, no Firestore, no logging in this file — that's the point of it. (`buildMixedMessages` joins in milestone 3.)

**A3. The caller.** `ai-categorize-document.ts` imports the moved symbols from `../../../shared/ai-analysis-messages` and re-exports them, so existing imports (e.g. `functions-v2/test/on-analysis-document-imaged.test.ts`) keep working unedited. The diff to this file is deletions plus import/re-export lines only.

**A4. Tests — two files, split by what each one is actually testing.** The repo colocates tests with the code they test, so the builder tests belong next to the builders. What cannot move is the check that the module still works through `functions-v2`'s *own* dependency installs, because those are what the deployed function resolves.

New `shared/ai-analysis-messages.test.ts` (colocated; run by the **root** package's jest, whose `testRegex` already picks up `shared/*.test.ts` the same way it picks up the `ai-summarizer` tests) — pure builder behavior:

- Schema from a full `aiPrompt`, vs. one with only `discussionPrompt`, vs. one with no schema fields at all.
- `buildImageMessages` message shape (system + user with a text part and an `image_url` part).
- `buildSummaryMessages` with zero, one and two related summaries, including the agreement-count sentence and its absence when a related summary has no agreements.
- `defaultAiPrompt` still asks for the four design categories.

New `functions-v2/test/ai-analysis-messages-integration.test.ts` — only what is specific to `functions-v2`, with a comment at the top of the file saying why it lives there so nobody relocates it later:

- One case proving the builders and `categorizationResponseFormat` execute correctly against `functions-v2`'s installed `openai` and `zod` copies — the ones the deployed function resolves. (Note that its `instanceof` assertions cannot detect a version drift between `shared/node_modules` and `functions-v2/node_modules`: the jest `moduleNameMapper` deliberately gives every importer one copy of zod. Drift is the lockstep test's job, A1.)
- Re-export check: the symbols are importable from `ai-categorize-document.ts` exactly as before.
- Caller behavior preserved: a prompt with no schema fields still makes the categorize call give up (it throws internally, logs, and resolves to `undefined`).

**A5. Cross-package load test (harness side, part of Part B's suite):** import `shared/ai-analysis-messages.ts` from a harness test, call each builder, and assert the module graph contains no `firebase-functions` or `@google-cloud/firestore` module afterward. (The version-lockstep test from A1 also lives in the harness suite.)

**Acceptance for Part A:** `npm run build` and `npm test` in `functions-v2` pass with no changes to existing test expectations, and the root `npm test` passes the new colocated `shared/` test. The root jest must resolve `openai` and `zod` from `shared/node_modules` unaided — neither the root jest config nor `src/test/jest-resolver.js` may be changed to force it.

**Explicit non-goal:** do not touch `findRelatedSummaries` in this PR. The one-word bug fix (spike finding 6a) plus its unit test is a separate, small PR.

## Part B — the harness skeleton

### Directory layout

```
scripts/ai-harness/
  package.json / package-lock.json
  tsconfig.json
  jest.config.js
  README.md
  harness.ts                    # CLI entry: parses argv, dispatches to commands
  src/
    schemas.ts                  # types + runtime validators + canonicalJson/sha256Canonical
    corpus.ts                   # import command, manifest read/write
    capability.ts               # tile capability registry + document classification
    represent-text.ts           # text representation variants (wraps shared/ai-summarizer)
    messages.ts                 # builds requests via shared/ai-analysis-messages
    cache.ts                    # response cache
    cost.ts                     # pricing config, estimation, reservation ledger
    execute.ts                  # OpenAI calls, concurrency, retries, JSONL writer
    report.ts                   # summary tables from result JSONL
    pricing.json
  prompts/
    categorize-design-default.json
  experiments/
    text-baselines.json
  examples/
    synthetic-corpus/
      expectations.json         # per-fixture expected behavior (see Fixtures)
      documents/<one per tile type>.json
      # note: no manifest.json here — manifests are generated by `import`; tests
      # and the smoke test import these documents into data/corpus/ first
  test/
  data/                         # created at runtime; NEVER committed
```

Add to the **root** `.gitignore`: `scripts/ai-harness/data/`.

Also new in `shared/`: `shared/tile-types.ts` (see Capability registry).

### Dependencies and toolchain — exact, locked, verified

Own `package.json`, `"type": "module"`:

- dependencies: `openai` and `zod` at the **exact same versions as `shared/`** (the lockstep test covers all three packages), `dotenv`.
- devDependencies: `tsx`, `typescript` `~5.9.2` (matching `functions-v2`), `jest` 29, `ts-jest` 29, `@types/jest`, `@types/node`.
- scripts: `"test"`, `"typecheck": "tsc --noEmit"`.
- Commit `package-lock.json`; acceptance uses `npm ci`, never bare `npm install`.

**ESM + Jest configuration, spelled out** (this combination is a known time sink; do it this way):

- `tsconfig.json`: `module: "nodenext"`, `moduleResolution: "nodenext"`, `strict: true`, `target: "es2022"`; include `harness.ts`, `src`, and `test`. The `../../shared/*.ts` imports pull shared sources into the compilation automatically; if tsc objects to files outside the project directory, mirror how `functions-v2/tsconfig.json` already handles compiling `../shared` (it's the same situation) rather than inventing a new arrangement. `npm run typecheck` must cover the shared files the harness imports.
- Relative imports in harness source use **`.js` suffixes** (NodeNext requirement), e.g. `import { classify } from "./capability.js"`.
- `jest.config.js`: `preset: "ts-jest/presets/default-esm"`, `extensionsToTreatAsEsm: [".ts"]`, `moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" }`, transform configured with `useESM: true`; test script runs with `NODE_OPTIONS=--experimental-vm-modules`.
- CLI runs via `npx tsx harness.ts …` (tsx handles ESM + TS + the `.js`-suffix convention natively).
- Acceptance requires `npm run typecheck` to pass, not only jest — jest's transform can mask type errors that would break the CLI at runtime.

The OpenAI key is read from `scripts/.env` (`OPENAI_API_KEY=…`) or the environment. `firebase-admin` is *not* a milestone-1 dependency.

CLI parsing: plain `process.argv`; flags are `--name value` pairs; unknown flags are errors.

### Capability registry and document classification (`capability.ts` + `shared/tile-types.ts`)

**The authoritative tile-type list** is a new, import-safe module — `shared/tile-types.ts` — exporting a readonly string array of every tile type CLUE registers. It must include the full set from `src/register-tile-types.ts` **plus** the statically-registered `"Placeholder"` and `"Unknown"`: Question, AI, BarGraph, DataCard, Dataflow, Diagram, Drawing, ErrorTest, Expression, Geometry, Graph, Image, IframeInteractive, Numberline, Simulator, Starter, Table, Text, Timeline, WaveRunner, Placeholder, Unknown. (Verify against the file when implementing; this list is from an audit, the file is the truth.) Do **not** import `src/register-tile-types.ts` from the harness — it drags in client-side loading utilities and its registry object isn't exported.

**The sync tripwire:** a harness test reads `src/register-tile-types.ts` *as text*, extracts the quoted keys of the registration object with a regex, and asserts the extracted set plus `{Placeholder, Unknown}` equals the `shared/tile-types.ts` list. New tile registrations then fail this test until both the list and the capability registry are updated. (Migrating `register-tile-types.ts` to consume the shared list is a nice later refactor; out of scope here.)

**Per-tile capability record** — three properties, because they answer different questions:

```ts
interface TileRepresentationCapability {
  containsStudentText: boolean;            // can students author text content in this tile type?
  summaryFidelity: "full" | "partial" | "stub" | "fallback";  // how well the CURRENT text summarizer carries it
  requiresVisualRepresentation: boolean;   // does an image add information text can't carry?
}
```

Seed values (verify judgment calls in review):

| Tile types | containsStudentText | summaryFidelity | requiresVisualRepresentation |
|---|---|---|---|
| Text | true | full | false |
| Table | true | full | false |
| Dataflow | true | full | true |
| Graph | false | full | true |
| Simulator | false | partial | true |
| Question | false — children classify individually (see traversal below) | partial | false — children decide |
| Drawing | true (text labels) | stub | true |
| Image | false | stub | true |
| Geometry, Diagram, BarGraph, DataCard, Numberline, Expression, Timeline, WaveRunner | false (known simplification — several of these can hold typed text, e.g. DataCard fields; instance-level checks may upgrade them in M3, and any deviation found while authoring fixtures gets recorded in `expectations.json`) | fallback | true |
| AI, ErrorTest, Starter, IframeInteractive | false | fallback | true |
| Placeholder | false | full (empty) | false |
| **Unknown / unlisted** | **false** | **fallback** | **true** |

Unknown types are conservatively visual so nothing silently drops.

**Instance-level refinement:** type-level flags say what a tile *can* contain; classification of a real document also checks what it *does* contain. Milestone 1 implements two instance checks: a Text tile counts as text only if its content is non-empty after trimming, and a Drawing tile counts as containing student text only if it has text objects with content. Other instance checks can come later.

**Question traversal:** Question tiles hold their children in a nested `rowOrder`/`rowMap` inside their content, with tile ids resolving through the *document's* top-level `tileMap` — iterate them the way `handleQuestionTile()` in `shared/ai-summarizer/ai-tile-summarizer.ts` does (first row = authored prompt, remaining rows = student response). Rules: the authored prompt does **not** count as student text; response tiles classify individually by their own types; missing tile references are skipped with a recorded warning; a tile referenced twice counts once; nested Questions recurse with a depth cap (8) against cycles. Unit-test each rule.

**Document classification** (`computedModality`): `"text-only" | "visual-only" | "mixed" | "empty"`. Any tile with (instance-level) student text and any tile requiring visual representation → `mixed`; only text → `text-only`; only visual → `visual-only`; neither → `empty`.

Tests must iterate the `shared/tile-types.ts` list and fail if any type lacks a capability record.

### File formats (schemas.ts implements these as types + validators)

Every format has `schemaVersion: 1`. Validators run on every read; a bad file fails with a message naming the file and field.

**Corpus manifest** (`manifest.json`):

```json
{
  "schemaVersion": 1,
  "name": "synthetic-corpus",
  "createdAt": "2026-08-12T00:00:00Z",
  "documents": [
    {
      "id": "drawing-only",
      "file": "documents/drawing-only.json",
      "source": "synthetic",
      "contentSha256": "…",
      "retrievedAt": null,
      "unit": null, "investigation": null, "problem": null, "contextId": null,
      "computedModality": "visual-only",
      "modalityOverride": null,
      "labels": {},
      "relatedSummaries": [],
      "historical": null
    }
  ]
}
```

- `source`: `"synthetic" | "demo" | "qa" | "production"`.
- `computedModality` is always refreshed by `import` from current content; `modalityOverride` is only ever set by a human and never touched by tooling. Reports use the override when present and show both. (Same pattern for any future derived-vs-manual metadata.)
- `historical`: `null`, or (production, later) `{ summarizer, promptTokens, completionTokens, response, analyzedAt }`. Never compared pairwise against new runs unless `contentSha256` matches — enforced in `report.ts`.

**Import command rules:** document id = source filename without extension, validated as `[a-z0-9-]+`; id collision within a corpus is an error; resolved paths must stay inside the corpus directory (reject `..`); source files that disappear leave their manifest entries in place with a warning (explicit `--prune` removes them); `--source demo|qa|synthetic` sets the source field (default `synthetic`).

**Prompt file** (`prompts/categorize-design-default.json`): the `aiPrompt` object plus `provenance { source, retrievedAt, aiPromptSha256 }` where the hash is `sha256Canonical(aiPrompt)`. **Anti-drift test:** a harness test computes `sha256Canonical(defaultAiPrompt)` from the shared module and asserts it equals both the file's `aiPromptSha256` and the hash of the file's own `aiPrompt` — the committed copy can't drift from production's default without a failing test.

**Experiment file** (`experiments/text-baselines.json`) — milestone 1 supports an explicit run list only:

```json
{
  "schemaVersion": 1,
  "name": "text-baselines",
  "runs": [
    { "id": "text-default", "message": "text-only", "textVariant": "default", "prompt": "categorize-design-default" },
    { "id": "text-minimal", "message": "text-only", "textVariant": "minimal", "prompt": "categorize-design-default" }
  ]
}
```

Validation: `message` must be `"text-only"`; `textVariant` known; `prompt` names an existing file; run ids unique.

**Result rows** — a **discriminated union on `status`**; report code handles every status exhaustively:

Common fields (all statuses): `schemaVersion`, `experiment`, `experimentSha256`, `runId`, `corpus`, `docId`, `modality` (effective: override ?? computed), `message`, `textVariant`, `prompt {name, sha256}`, `requestKey` (the cache key — this is also resume identity; `null` on `skipped` rows, which never build a request), `runMeta { date, openaiSdkVersion, gitCommit, gitDirty }`.

- `status: "success"` → `response {parsed, raw}`, `usage {promptTokens, completionTokens, source: "api" | "cache"}`, `cost {modeledUsd, incurredThisRunUsd}`, `responseOriginMeta {date, modelReturned, systemFingerprint}` (equals this run for API calls; the originating call's for cache hits — `incurredThisRunUsd` is 0 for cache hits).
- `status: "refusal"` → refusal text, usage, cost, responseOriginMeta (refusals are real API responses: they cost money, and they are **cached** like successes so reruns don't re-spend on deterministic refusals).
- `status: "error"` → structured `error {type, message, attempts}`; never cached.
- `status: "skipped"` → `skipReasons: string[]` (reserved for milestone 3's skip-empty; the shape ships now).

**Pricing config** (`src/pricing.json`): `{ schemaVersion, effectiveDate, models: { "gpt-4o-mini": { inputPerMTokUsd, outputPerMTokUsd, maxOutputTokens } } }`. Verify current prices when implementing.

### Cost control (`cost.ts`) — a real upper bound, not an accounting fiction

- **Every OpenAI request sets `max_completion_tokens` to the pricing config's `maxOutputTokens`** (1024 to start). This is a deliberate, documented deviation from production (which sets no cap): without it the reservation is not a bound. Record the cap in the request config; note in the README that production should likely adopt the same cap later. Feedback comments are short; 1024 is generous.
- Input-token estimate: `messages` text length ÷ 3 (conservative chars-per-token) + canonical response-schema length ÷ 3, rounded up.
- Worst-case reservation per call = (input estimate + `maxOutputTokens`) priced, × (1 + retries) — **the same formula in `plan` and `run`**, so `plan`'s projected maximum is never lower than what `run` can reserve.
- Reservation ledger: before dispatch, atomically reserve; if the reservation would exceed `--max-cost`, don't dispatch (finish in-flight work, then stop with a clear message). Cache hits reserve nothing. On completion, replace the reservation with actual cost. Final report: reserved vs. actual.

### Cache (`cache.ts`)

Key = `sha256Canonical({ model, messages, responseFormat, generationSettings })` — `generationSettings` includes `max_completion_tokens`. Store under `data/cache/<first-2>/<key>.json` with the full response and its `responseOriginMeta`. Successes **and refusals** are cached; errors never. Flags: `--no-cache` disables reads *and* writes; `--refresh-cache` bypasses reads but writes fresh results.

### Execution and resume (`execute.ts`)

- `run` takes `--output <file>` (default `data/results/<experiment>.jsonl` — a stable, deterministic path; no timestamp in the name). Rerunning with the same output file resumes it: a (docId × runId) pair is skipped only if an existing row has the **same `requestKey`** — so a changed document, prompt, representation, experiment definition, or generation setting re-runs automatically (the key embeds all of them via the messages), while true duplicates skip. Error rows never block a retry-rerun.
- All completions flow through a single JSONL writer queue; one line per write, flushed per line — concurrent tasks can't interleave, and a crash leaves whole rows or nothing.
- Concurrency cap 4; retry twice on transient errors (429/5xx/network) with backoff.

### Commands

- `npx tsx harness.ts import --from <dir> --corpus <name> [--source synthetic|demo|qa] [--prune]` — rules under "Import command rules" above; `production` is deliberately not an option here (the `pull` command sets it, milestone 6).
- `npx tsx harness.ts represent --corpus <name> --variants default,minimal` — writes each representation as a JSON envelope `{ schemaVersion, docId, variantId, variantVersion, sourceContentSha256, generatedAt, markdown }` under `data/corpus/<name>/representations/` — the envelope, not the file's existence, is how staleness is detected (regenerate when `sourceContentSha256` or `variantVersion` differ). Each variant implementation in `represent-text.ts` exports a `variantVersion` integer constant, bumped whenever its output would change for the same input. Variants: `default`, `minimal`; `svg-drawings` (via `documentSummarizerWithDrawings`) is a stretch goal — include only if the React import works under tsx without build gymnastics; otherwise note it in the README and move on.
- `npx tsx harness.ts plan --corpus <name> --experiment <file>` — validate everything; print the expanded run list (runs × documents) with its total call count, and the worst-case cost using the same reservation formula as `run`. No network.
- `npx tsx harness.ts run --corpus <name> --experiment <file> --max-cost <usd> [--output <file>] [--no-cache | --refresh-cache]` — `--max-cost` required; no unlimited mode.
- `npx tsx harness.ts report --results <file>.jsonl` — stdout table + `summary.json`: per run-config × modality (and overall): docs, cache hits, statuses, token mean/median/total, modeled and incurred cost, category distribution, refusal count.

### Synthetic corpus and fixtures

The committed example corpus is `documents/` plus `expectations.json` — no committed manifest; tests (and the smoke test) run `import` on it first, which generates the manifest under `data/corpus/` and exercises the import path for free.

One minimal document per type in `shared/tile-types.ts`, plus one `mixed` document (Text + Drawing) and one `empty` document. Two special cases: the `Unknown` fixture is a document containing a tile with a made-up type string (that is what "unknown" means in practice), and the `Placeholder` fixture is a document whose section is empty. Author as CLUE document-content JSON (`rowOrder`/`rowMap`/`tileMap`; copy structure from `shared/ai-summarizer/ai-summarizer.test.ts` fixtures). Tiles needing shared models (Table/Graph datasets, Diagram variables) must include them — a fixture that exercises only the degenerate empty case doesn't test the handler.

`expectations.json` records, per fixture: expected `computedModality`; expected capability classification; handler tier (`full|partial|stub|fallback`); a distinctive string (the fixture id embedded in its content) that must appear in the `default` summary **when the tier is full or partial**; whether `default` and `minimal` summarization must succeed. A test walks the corpus against these expectations. Weak summaries from stub/fallback tiles are expected and *visible* — that's data, not failure.

## Acceptance criteria (milestone 1 is done when…)

1. `functions-v2`: `npm run build` + `npm test` pass; existing test expectations unchanged; builders come from `shared/ai-analysis-messages.ts`.
2. `scripts/ai-harness`: `npm ci`, `npm run typecheck`, and `npm test` all pass.
3. Lockstep test: `shared/`, `functions-v2/`, and `scripts/ai-harness/` lockfiles resolve identical `openai` and `zod` versions.
4. Cross-package load test: the shared module imports and runs from both `functions-v2` tests and harness tests; the harness import loads no Firebase modules.
5. Capability registry covers every type in `shared/tile-types.ts`; the text-parse tripwire against `src/register-tile-types.ts` passes; Question traversal rules each have a test.
6. Every OpenAI request sets `max_completion_tokens`; `plan` and `run` share one reservation formula; a concurrency test proves the ledger can't overshoot `--max-cost`.
7. Success, refusal, error, and skipped rows validate against distinct schemas; `report` handles all four.
8. A cache-hit test verifies `usage.source`, zero `incurredThisRunUsd`, current `runMeta`, and preserved `responseOriginMeta`; a refusal-caching test verifies refusals don't re-spend.
9. An interrupted run resumed via `--output` skips completed pairs; a changed document/prompt/experiment/representation is *not* skipped (requestKey mismatch test).
10. Concurrent completions produce valid, non-interleaved JSONL (writer-queue test).
11. The committed default prompt's hash mechanically matches `sha256Canonical(defaultAiPrompt)`.
12. The mocked-OpenAI smoke test runs `import` → `represent` → `plan` → `run` → `report` end-to-end with no network; message arrays match snapshots built with the shared builders; modality breakdowns appear in the summary.
13. One real run of `text-baselines` on the synthetic corpus completes under $0.50 with a readable report (human-verified; needs `OPENAI_API_KEY`).
14. `git status` after a full real run shows nothing untracked outside `scripts/ai-harness/data/`.
15. `README.md` documents setup, per-command prerequisites (network/key/none), file formats (pointing at `schemas.ts`), cache flags, resume, and the data-safety rules from the harness plan.

## Out of scope for milestone 1 (do not build, even if tempting)

Image representations and backends (M2); `buildMixedMessages`, mixed/image-only execution, extras variants, skip-empty *execution* (M3 — the registry and the `skipped` row shape ship now, unused); HTML review report and `--shareable` (M4); rubric scoring (M5); production `pull`, `firebase-admin`, anything touching real student data (M6); the `findRelatedSummaries` bug fix (separate small PR); matrix-style experiment expansion (M3); migrating `register-tile-types.ts` to consume `shared/tile-types.ts` (nice refactor, not now).

## Review disposition (revision 2)

An external (Codex) review of revision 1 raised 15 findings plus 12 acceptance-criteria additions; all were verified against the code where checkable and essentially all adopted. The three blockers were real: the root `node_modules` lacks `openai`/`zod`, so the shared module couldn't have resolved its imports from the harness (fixed by giving `shared/` its own pinned dependencies + a lockstep test); the tile-registry test as specified was impossible (`gTileRegistration` is unexported and the module drags in client code) and the capability table was missing `ErrorTest`, `IframeInteractive`, `Starter`, and `Unknown` (fixed with `shared/tile-types.ts` as the authoritative import-safe list plus a text-parse tripwire); and the spend ceiling wasn't a true bound without `max_completion_tokens` on the request (fixed, recorded as a deliberate parity deviation). Also adopted: the three-property capability model replacing the conflated two flags, Question-traversal rules, exact version pinning with committed lockfiles and `npm ci`, the spelled-out ESM/jest configuration with a required typecheck, discriminated result rows, cache-hit cost/provenance fields, refusal caching, `--no-cache` vs `--refresh-cache` semantics, deterministic `--output` resume keyed on `requestKey`, the single JSONL writer, the prompt anti-drift hash test, `computedModality`/`modalityOverride` separation with import edge-case rules, representation envelopes, expectation-driven fixtures, and the explicit note that three moved symbols gain `export` keywords. One correction of fact from the review: TypeScript is pinned to `~5.9.2` (matching `functions-v2`), not 5.5 as revision 1 said.

Revision 3 (editorial pass, no design changes): fixed cross-references between A1/A4/A5 (the lockstep test lives in the harness suite and is described once, in A1); replaced the capability table's "varies — audit each" with an explicit default (`false`, documented as a known simplification) so no judgment call is delegated to the implementer; resolved a contradiction where the committed example corpus contained a `manifest.json` that the `import` command is supposed to generate (the example corpus is now documents + expectations only); defined where `variantVersion` comes from; clarified that `requestKey` is `null` on skipped rows; and specified the `Unknown` and `Placeholder` fixtures.

Revision 4 (A4 only): the Part A tests are split into two files instead of one. `shared/ai-analysis-messages.test.ts` sits next to the code it tests, following the repo's colocation convention, and runs under the root package's jest. `functions-v2/test/ai-analysis-messages-integration.test.ts` keeps only the cross-package checks — the re-exports, the caller behavior, and one case executing the builders against `functions-v2`'s own `openai`/`zod` installs — since those are the parts that would be meaningless anywhere else. Acceptance for Part A now also requires the root `npm test` to pass, without altering the root jest config or `src/test/jest-resolver.js` to make `shared/node_modules` resolve.
