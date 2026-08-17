# CLUE AI evaluation harness

A checked-in tool that runs (representation × prompt × message-shape) experiments against a corpus of
CLUE documents and reports quality inputs plus token and cost numbers — so text-only vs. image-only
vs. mixed-mode claims are backed by measurements instead of intuition.

This is **milestone 1** of [CLUE-371](../../docs/plans/CLUE-371-harness-plan.md): the shared message
builders, the harness skeleton, a synthetic corpus, text-only runs, the response cache, the spend
ceiling, and reports as data. Images (milestone 2), mixed mode (milestone 3), the HTML review report
(milestone 4), rubric scoring (milestone 5) and the production corpus pull (milestone 6) are not here
yet.

All runs target `gpt-4o-mini`. That is deliberately the rolling alias, not a pinned snapshot:
production calls the alias, and a harness that pinned a snapshot would stop measuring what production
actually does. Reproducibility is handled instead by recording the returned model id and
`system_fingerprint` in every result row's `responseOriginMeta`, so runs months apart can be told
apart after the fact.

## Setup

```bash
cd scripts/ai-harness
npm ci                 # not `npm install` — the lockfile is the contract (see "Version lockstep")
npm run typecheck
npm test
```

This package has its own jest, and the root package's jest is told to skip it
(`testPathIgnorePatterns` in the root `package.json`) — these tests are ESM with NodeNext-style `.js`
specifiers and cannot run under the root CommonJS runner. CI runs them anyway, as two steps in the
`jest` job of `.github/workflows/ci.yml`: several of these tests are tripwires on production code
(a new tile type without a capability record, a drifted prompt copy, an openai/zod version that has
fallen out of lockstep, a tile summarizer that stopped carrying content), and nobody changing that
code would think to run them by hand.

For `run` you also need an OpenAI key, either in the environment or in `scripts/.env`:

```
OPENAI_API_KEY=sk-…
```

## Commands and what each one needs

| Command | Network | OpenAI key | Notes |
|---|---|---|---|
| `import` | no | no | Copies documents into `data/corpus/<name>/` and (re)generates the manifest. |
| `represent` | no | no | Renders text representations. Pure local computation. |
| `plan` | no | no | Validates everything and prints the expanded run list and worst-case cost. |
| `run` | **yes** | **yes** | The only command that calls OpenAI. `--max-cost` is required. |
| `report` | no | no | Reads a results JSONL file and writes `summary.json` beside it. |

```bash
npx tsx harness.ts import    --from examples/synthetic-corpus --corpus synthetic-corpus \
                             [--source synthetic|demo|qa] [--prune]
npx tsx harness.ts represent --corpus synthetic-corpus --variants default,minimal
npx tsx harness.ts plan      --corpus synthetic-corpus --experiment experiments/text-baselines.json
npx tsx harness.ts run       --corpus synthetic-corpus --experiment experiments/text-baselines.json \
                             --max-cost 0.50 [--output <file>] [--no-cache | --refresh-cache]
npx tsx harness.ts report    --results data/results/text-baselines.jsonl
```

Flags are plain `--name value` pairs. An unknown flag is an error, not a warning.

`plan` on the committed synthetic corpus projects a worst case of about **$0.11** for both text
baselines across all 24 documents.

## Data safety

- **One artifact root.** Everything derived from a document — corpora, representations, the response
  cache, results, reports — is written under `scripts/ai-harness/data/`, and nothing derived from a
  document is written anywhere else. That whole tree is gitignored (see the root `.gitignore`).
- Committed example corpora live in `examples/`, *outside* the ignored tree, so there are no
  allowlist exceptions inside an ignored directory.
- `import` will not set the `production` source; only the (not yet built, and gated) `pull` command
  may, and it will require an explicit sign-off flag.
- **Production student work is sensitive everywhere it flows**, not just at import. When production
  corpora arrive: delete them when the experiment concludes, keep document ids and Firestore paths
  out of anything that leaves the team, and remember that injected related-summaries data contains
  *other* students' work.
- Milestone 1 touches no production data, no credentials, and no `firebase-admin`.

## Concepts

### Corpus

A corpus is a directory under `data/corpus/<name>/` with a `manifest.json` and a `documents/`
directory. `import` generates the manifest; it is never committed. Manifest rules worth knowing:

- The document id is the source filename without its extension and must match `[a-z0-9-]+`.
- `computedModality` (`text-only` / `visual-only` / `mixed` / `empty`) is recomputed from the current
  content on every import. `modalityOverride` is only ever set by a human and tooling never touches
  it. Reports use the override when present.
- A source file that disappears leaves its manifest entry in place with a warning. `--prune` removes
  the entry **and deletes the document's copied content and every representation envelope generated
  from it** — it is destructive by design, so that once production corpora exist no unreachable copy
  of a student's document lingers in `data/`.
- `historical` holds a production `done`-queue record (milestone 6). It describes an analysis of
  whatever the document looked like *then*, so it is never lined up against a fresh run unless the
  content hash proves the input is identical — see `historicalIsComparable` in `src/report.ts`.

### Representations

`represent` writes an envelope per (document, variant):

```json
{ "schemaVersion": 1, "docId": "…", "variantId": "default", "variantVersion": 1,
  "sourceContentSha256": "…", "generatedAt": "…", "markdown": "…" }
```

Staleness is decided by the envelope, not by the file existing: a representation is reused only when
`sourceContentSha256` and `variantVersion` both still match. Each variant in `src/represent-text.ts`
exports a `variantVersion` that is bumped whenever its output would change for the same input.

Variants: `default` and `minimal`. The `svg-drawings` variant
(`documentSummarizerWithDrawings`) is **not** included — it imports `src/plugins/drawing`, which
imports `.svg` assets that only a bundler can load, so it does not run under `tsx` without build
gymnastics. It is a candidate for a later milestone.

### Capability registry

`src/capability.ts` records, per tile type, three separate things: whether students can author text
in it, how well the current text summarizer carries it (`full` / `partial` / `stub` / `fallback`),
and whether an image adds information text cannot. Unlisted tile types are treated conservatively as
needing an image, so nothing silently drops.

The authoritative tile-type list is `shared/tile-types.ts`. `test/tile-types.test.ts` parses
`src/register-tile-types.ts` as text and fails if the two drift apart, so registering a new tile type
also forces a capability record for it.

Classification of a real document adds instance-level checks: a Text tile counts as text only when
its content is non-empty after trimming, and a Drawing tile counts as containing student text only
when it has text objects with content. Question tiles are traversed into: the authored prompt is not
student work, response tiles classify by their own types, missing references are skipped with a
warning, a tile referenced twice counts once, and nesting is capped at 8 levels.

### Prompts

`prompts/<name>.json` holds an `aiPrompt` plus provenance, including `aiPromptSha256`. Reports
identify a prompt by hash, not only by name. `test/prompt.test.ts` asserts the committed
`categorize-design-default` still hashes identically to `defaultAiPrompt` in
`shared/ai-analysis-messages.ts`, so the copy cannot drift from production unnoticed.

### Experiments

Milestone 1 supports an explicit run list only (no matrix expansion). `message` must be `text-only`,
`textVariant` must be a variant this build knows, `prompt` must name an existing prompt file, and run
ids must be unique.

### Cache

Key = `sha256Canonical({ model, messages, responseFormat, generationSettings })`, stored at
`data/cache/<first-2>/<key>.json`.

- Successes **and refusals** are cached. A refusal is a real API response that cost real money;
  re-running it would just spend the money again.
- Errors are never cached. That includes a response carrying neither a parsed object nor a refusal
  (usually a truncated completion): it becomes an `error` row with `type: "unparsed"` and the
  response's `finish_reason` in the message, matching how production treats a missing `parsed`. The
  call still cost money, so it is still charged against the ceiling, but a rerun re-requests it.
- `--no-cache` disables reads *and* writes. `--refresh-cache` bypasses reads but still writes fresh
  results. The two cannot be combined.

On a cache hit the row records `usage.source: "cache"`, `cost.incurredThisRunUsd: 0`, this run's
`runMeta`, and the **originating** call's `responseOriginMeta`.

### Resume

`run` writes to `--output`, defaulting to `data/results/<corpus>-<experiment>.jsonl` — a stable path
with no timestamp in it, naming the corpus so the same experiment run against two corpora does not
append into one file. `--output` is resolved against the data root and refused if it escapes.

Re-running against the same file resumes it. A (document, run) pair is skipped only when an existing
row matches on **corpus, experiment hash and `requestKey`**, so a changed document, prompt,
representation, experiment definition or generation setting re-runs automatically. Error rows never
block a retry, and `report` refuses a file that mixes corpora or experiment definitions rather than
summing across them.

Because resume runs before the cache is consulted, `--no-cache` and `--refresh-cache` would be
no-ops against a file that already holds completed rows. Rather than silently skipping the requests
you asked to re-execute, `run` fails and tells you to pass a fresh `--output`.

All completions flow through a single JSONL writer queue, one flushed line per write, so concurrent
tasks cannot interleave and a crash leaves whole rows or nothing.

### Cost control

`--max-cost` is required; there is no unlimited mode. It is an **enforced bound**, not a mathematical
guarantee — see the two edges at the end of this section.

- Every request sets `max_completion_tokens` to the pricing config's `maxOutputTokens` (1024).
  **This is a deliberate deviation from production**, which sets no cap: without it the reservation
  bounds nothing at all, only guesses. Production should probably adopt the same cap — feedback
  comments are short and 1024 is generous.
- Input estimate: ASCII characters ÷ 3 plus one token per non-ASCII character, over the messages and
  the canonical response schema. Non-ASCII is counted whole because CJK text and emoji routinely cost
  about a token each, and dividing them by three would under-reserve.
- Worst case per call = (input estimate + `maxOutputTokens`) priced, × (1 + retries). `plan` and
  `run` call the same function, so a plan's projected maximum is never lower than what a run can
  reserve.
- Before dispatch the run reserves the worst case. A reservation that would cross the ceiling is
  refused, in-flight work finishes, and the run stops with a message. Cache hits reserve nothing. On
  completion the reservation is replaced by the actual cost. If actuals ever push the committed total
  past the ceiling, the run stops scheduling immediately and reports the overshoot.
- The SDK's own retries are disabled (`maxRetries: 0`), so the only attempts are the ones the
  reservation paid for.

**The two edges, and why they are accepted.** The input estimate is a character heuristic, not the
model's tokenizer, so a pathological input could tokenize worse than estimated and settle above its
reservation; the ledger detects that after the fact and halts rather than preventing it. And a
dispatched request that fails before returning usage may or may not have been billed — the harness
charges its single-attempt share, which is a guess in the honest direction rather than a known
figure. Both are accepted for a tool whose runs cost cents: the synthetic corpus plans at about
$0.11. If the harness ever runs matrices costing real money, replace the heuristic with a tokenizer
before trusting the ceiling to the last cent.

Prices live in `src/pricing.json` with an `effectiveDate`. Check them when they look stale;
API-reported usage is authoritative for final numbers.

### Results and reports

Result rows are a discriminated union on `status` (`success`, `refusal`, `error`, `skipped`), all
sharing the same identifying fields. `skipped` ships now but is unused: skip-empty *execution*
arrives in milestone 3. `report` handles all four statuses exhaustively and writes `summary.json`
next to the results file, grouped per run configuration × modality plus an overall row.

Every on-disk format has `schemaVersion: 1`, is described as a TypeScript type in
[`src/schemas.ts`](src/schemas.ts), and is validated on every read; a bad file fails with a message
naming the file and the field.

### Version lockstep

`shared/` has its own pinned `openai` and `zod` so the harness can import
`shared/ai-analysis-messages.ts` in place, while the deployed function resolves both from
`functions-v2/node_modules`. Behaviour parity requires identical versions, so
`test/versions.test.ts` reads all three lockfiles and fails if they drift. Use `npm ci`, and commit
lockfile changes.

## Layout

```
harness.ts                 CLI: argv parsing and command dispatch
src/schemas.ts             types, validators, canonicalJson / sha256Canonical
src/corpus.ts              corpus layout, import, manifest read/write
src/capability.ts          tile capability registry, document classification
src/represent-text.ts      text representation variants
src/messages.ts            request construction via shared/ai-analysis-messages
src/cache.ts               response cache
src/cost.ts                pricing, estimation, reservation ledger
src/execute.ts             run expansion, OpenAI calls, concurrency, retries, JSONL writer
src/report.ts              summary tables from result JSONL
prompts/                   prompt files with provenance
experiments/               experiment definitions
examples/synthetic-corpus/ committed fixtures + expectations.json (no manifest — import makes it)
test/                      jest suite
data/                      generated at runtime; never committed
```

## DEVIATIONS

Where the implementation departs from
[docs/plans/CLUE-371-harness-implementation-1.md](../../docs/plans/CLUE-371-harness-implementation-1.md),
and why.

1. **`moduleResolution` is `bundler`, not `nodenext`.** The spec prescribes
   `module: "nodenext"` / `moduleResolution: "nodenext"`. That configuration cannot type-check this
   repository: `shared/package.json` declares `"type": "module"`, so every `shared/**` file is ESM,
   and every relative import in `shared/ai-summarizer/**` (which `represent-text.ts` must import) is
   extensionless. NodeNext rejects extensionless relative imports in ESM with TS2835, which then
   cascades into dozens of downstream `implicit any` errors. Adding extensions across `shared/`
   would be a large change to production code and is well out of milestone 1's scope. `bundler`
   resolution keeps everything else the spec asked for — `strict`, `target: es2022`, `.js` suffixes
   on the harness's own relative imports, `npm run typecheck` covering the shared files the harness
   imports, `tsx` for the CLI and the ts-jest ESM preset for tests.
2. **`functions-v2/jest.config.js` maps `openai` and `zod` to its own copies.** Once `shared/` has
   its own `node_modules`, jest would otherwise load two copies of zod, and the `expect.any(ZodEnum)`
   assertions in `test/on-analysis-document-imaged.test.ts` and
   `test/ai-analysis-messages-integration.test.ts` would fail on cross-copy `instanceof`. The mapping
   uses the same mechanism the config already uses for `firebase-admin`, and it matches deployment,
   where `shared/node_modules` does not exist and both packages resolve from
   `functions-v2/node_modules`.
3. **The "no Firebase in the module graph" check is static.** Jest exposes no ESM module registry, so
   `test/shared-module.test.ts` walks the import graph out from `shared/ai-analysis-messages.ts` and
   asserts no reachable bare specifier is a Firebase or `@google-cloud` package, alongside actually
   importing the module and running each builder. The static walk also catches a Firebase import
   added to a transitive dependency rather than only one that happens to execute.
4. **The authored prompt inside a Question tile contributes nothing to modality.** The spec says the
   prompt "does not count as student text" and is silent on whether it can make a document need an
   image. It is authored content rather than student work, and modality exists to describe a
   student's work style, so the prompt contributes neither text nor a visual requirement. Its
   classification is still recorded, with `role: "prompt"`.
5. **`retrievedAt` is `null` for synthetic documents and the import time otherwise.** The spec's
   manifest example shows `null` for a synthetic document but does not say what to write for `demo`
   or `qa`. A synthetic document was authored in the repository rather than retrieved from anywhere.
6. **`expectations.json` carries an explicit `expectDistinctiveInDefaultSummary` flag.** The spec
   derives that requirement from the handler tier (`full` or `partial`), but two fixtures have no
   place to put a marker the handler would emit: the placeholder handler returns an empty string, and
   the empty document is intentionally contentless. The flag defaults to the tier rule and is set
   explicitly (with a `notes` line) where it cannot hold.
7. **`historical` gained an optional `contentSha256`.** The spec fixes the historical record's shape
   without a hash of the input it ran against, which makes the "never compare unless the content hash
   matches" rule unenforceable. `historicalIsComparable` requires that field, so a record without it
   is never treated as comparable — the safe answer, and the only one available today since nothing
   writes historical records until milestone 6.
8. **`main(argv, deps)` accepts an injectable `dataRoot` and `createCompletion`.** The smoke test
   drives the real CLI, argv parsing included, with a mocked backend and its own corpus, cache and
   results — still inside `data/`, so the one-artifact-root rule holds.
9. **`plan`'s per-run line shows worst case per run** in addition to the required total.
10. **Estimation counts canonical-JSON length, not just visible text.** "Messages text length ÷ 3"
    is implemented as `canonicalJson(messages).length / 3`, which includes structural overhead. That
    is deterministic and conservative in the right direction.

### Verified against a real API call?

No. Acceptance criterion 13 (one real `text-baselines` run under $0.50) needs `OPENAI_API_KEY` and is
verified by a human. Everything else, including the full mocked end-to-end path, is covered by
`npm test`.
