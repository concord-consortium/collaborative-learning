# CLUE-371 Harness Plan

Status: implementation plan for the local evaluation harness — the first buildable piece of the CLUE-371 spike. Revised after an external (Codex) review; see "Review disposition" at the end.
Parent doc: [CLUE-371-spike.md](./CLUE-371-spike.md) (step 1 of the investigation sketch)

## Purpose

A checked-in tool that runs (representation × prompt × message-shape) experiments against a corpus of CLUE documents and reports quality inputs and token/cost numbers — so text-only vs. image-only vs. mixed-mode claims are backed by measurements instead of intuition. Per the spike decisions: it lives in the repo as a reusable tool and all runs target `gpt-4o-mini`.

"Local" means *outside the deployed Firebase pipeline*, not disconnected: depending on the command, the harness needs an OpenAI key, a local CLUE server (puppeteer rendering), the Shutterbug service (production-parity rendering), or production Firebase credentials (corpus pull). The README must state per command which of these are required.

**What it waits on:** only the production-corpus pull (data-agreements sign-off) and rubric-based scoring (team question 1 — ground truth). The config question is settled (text+image always); everything else is buildable now.

## Key design principles

1. **Corpus is pluggable.** A corpus is a directory with a manifest; membership is swappable. Build now with synthetic/fixture/demo documents; swap in production documents when the sign-off and example docs arrive.
2. **Production parity through shared code, not reimplementation.** The harness must never re-create message construction, schema building, or model invocation — a variant could otherwise "win" because the harness formats requests differently than production ever would. The pure builders get extracted once and consumed by both sides (see milestone 1).
3. **Production data is sensitive everywhere it flows,** not just at import: corpora, representation caches, response caches, run results, and reports all carry student work. See "Data safety."

## Branch and review strategy

This is spike work: promising, but not yet a mandated feature, and the plan may still change meaningfully as experiments run. Nothing merges to `master` until the results justify committing to it. Instead:

- **`CLUE-371`** is a long-running integration branch off `master`. All harness work lands there, never directly on `master`.
- Each milestone is its own short-lived branch off `CLUE-371`, reviewed as a normal PR *into* `CLUE-371`. Stacked branches within a milestone (like `CLUE-371-shared-builders` → `CLUE-371-harness-m1`) open stacked PRs: the first targets `CLUE-371`, the second targets the first's branch and is retargeted when it merges. Reviews stay small and happen once, while the code is fresh.
- The shared message-builder extraction stays on this branch too — its shape exists to serve the harness, so it shouldn't be committed to `master` until the harness's needs are confirmed.
- Merge `master` into `CLUE-371` before starting each new milestone branch, so the branch never drifts far and the eventual promotion diff is against something recent.
- End states, both clean: if the work proves out, `CLUE-371` merges to `master` with every piece already reviewed (the final review is a sanity pass, not a re-litigation); if the investigation says the harness should look different or shouldn't exist, the branch is deleted and `master` never knew.
- The eventual production pipeline switch (text+image always) is separate from this branch strategy: it's a small change made only when the harness evidence is in, and it should get its own rollout consideration (staging deploy first).

## Prior art in the repo — build on it, don't duplicate it

- `scripts/ai/download-documents.ts` — pulls documents from Firebase into local files (`firebase-admin` + `serviceAccountKey.json`). The corpus-pull command adapts this, with selection driven by `done`-queue records.
- `scripts/ai/document-screenshots.ts` — puppeteer screenshots of documents rendered in the standalone doc editor against a local CLUE server. Second image backend.
- `scripts/shutterbug.ts` — posts a document to Shutterbug using the same `generateHtml` iframe approach as production. **Not production parity as-is** (correction, 2026-08-13): it sends `height: 500, fullPage: true` where production sends `height: 1500` with no `fullPage`. Implementation doc 2 defines three named render modes so the true production baseline stays separate from improved variants.
- `scripts/lib/` + `scripts/README.md` conventions (`npx tsx`, `scripts/.env`, `serviceAccountKey.json`) — the harness follows them.
- `src/components/doc-editor/doc-editor-app.tsx` — proves `documentSummarizerWithDrawings` (SVG drawing handler) runs anywhere React is importable, including a node script here. The harness can prototype SVG-in-markdown drawings today even though the deployed function can't use that handler yet.

## Known production bug the baselines must account for

`findRelatedSummaries()` in `functions-v2/lib/src/ai-categorize-document.ts` pushes the *current document's* `summary` argument into every result instead of each related Firestore doc's own summary (`doc.data().summary`). Production has therefore been injecting up to five copies of the student's own summary into the prompt, not related students' summaries. (Caught in external review; verified in code.)

Consequently the extras experiments need three named variants, so the baseline can't silently drift into an improved implementation:

- `extras-production-current` — reproduces today's behavior exactly, bug included
- `extras-fixed` — each related document's actual summary
- `no-extras`

The bug itself gets fixed in production as part of this story (or CLUE-607), but the harness must be able to reproduce the buggy baseline for honest before/after comparison.

## Architecture

Five layers, each independently exercisable from the CLI.

### 1. Corpus layer

```
scripts/ai-harness/
  examples/synthetic-corpus/   # committed: synthetic docs only, one per registered tile type
  data/                        # gitignored entirely: corpora, caches, results, reports
    corpus/<name>/
      manifest.json
      documents/<id>.json
```

- Committed examples live *outside* the ignored data tree — no allowlist exceptions inside an ignored directory.
- The synthetic corpus covering **every registered tile type** is a requirement, not a nice-to-have: it is the regression suite for summarizer changes, capability-flag classification, and the harness smoke test.
- Manifest entry fields: doc id, source (`synthetic` | `demo` | `qa` | `production`), unit/investigation/problem, **content hash and retrieval timestamp**, labels (empty until ground truth arrives), optional injected related-summaries data, and — for production docs — the historical `done`-queue metadata (summarizer used, tokens, response) recorded as *historical* fields.
- **Historical vs. regenerated is an explicit distinction.** A `done` record describes an old analysis whose input may not match the document's current content. Historical stats inform aggregate cost baselines; they are never presented as paired comparisons against new runs unless the content hash establishes input identity.
- `harness import` (fixtures/demo docs — works today) and `harness pull` (production — **gated**; see Data safety).

### 2. Representation layer

Given document content JSON, produce representations, cached on disk per (doc content hash, variant):

- **Text:** `documentSummarizer(content, options)` variants: default, `minimal: true`, alternate tile-handler sets (SVG drawings via `documentSummarizerWithDrawings`, new serializers from spike step 3). **`no-dataset-tables` does not exist today** — it's new summarizer work, and its semantics are themselves variants worth separating: omit case data entirely / schema + row count only / fixed sample / aggregate stats.
- **Image: zero-to-many images, arrays from the start.** A representation is `images: [{dataOrUrl, mimeType, detail, tileId?, purpose?}]` — never a single URL — so full-document, per-tile, and visual-tiles-only experiments share one interface instead of forcing a milestone-3 rewrite. Puppeteer output (local PNGs) reaches OpenAI as base64 data URLs — exactly what production's `categorizeDocument()` already does; Shutterbug output stays a hosted URL.
  - Backends: `shutterbug` (production parity; parameterized render target, prototyping the in-scope hardcoding fix) and `puppeteer` (local doc editor; offline-friendly; supports accurate-height and per-tile capture more easily).
- **Skip-empty classification** lives here, with the dependency made explicit rather than "as it lands": the harness ships the **initial capability registry** — per-tile-type `hasVisualContent` and `hasMeaningfulText` flags (two separate concepts), seeded from the spike's finding-2 audit, with **unknown tile types conservatively classified as needing an image**. "Empty text" means no student-authored semantic content, not an empty Markdown string. Every skip decision and its reason is recorded in the run result. Classification is unit-tested against the synthetic corpus (every registered tile type).

### 3. Message layer

- **Milestone-1 requirement (promoted from "open question"):** extract the pure builders — `buildSummaryMessages`, `buildImageMessages`, `buildZodResponseSchema`, and the new `buildMixedMessages` — out of `ai-categorize-document.ts` (which mixes them with `firebase-functions` and Firestore imports) into `shared/`, consumed by both production and the harness. The harness configures variants; it never forks message construction.
- Related-summaries extras come from the manifest (injected data), not live Firestore, in the three named variants above.
- Prompts are data: `prompts/<name>.json` in `aiPrompt` shape, each with **provenance**: source (unit config path / built-in constant), retrieval commit or timestamp, and content hash. Reports identify prompts by hash, not just friendly name. Seed set: the built-in `categorize-design` default (as-is *and* the mixed-mode rewording from the config decision) and the authored MODS/cas prompts.

### 4. Execution layer

- `openai.chat.completions.parse` with the schema from the shared builder — identical call shape to production.
- **Run metadata recorded on every result:** run date, requested model alias and the response's returned model id and `system_fingerprint`, SDK version, git commit + dirty-worktree flag, and the full normalized request configuration. (`gpt-4o-mini` is an alias; runs months apart aren't comparable without this.)
- **Response cache:** key = canonical serialization of (model, messages, response schema, generation settings). Failures, refusals, and incomplete responses are never cached as successes. `--no-cache` forces fresh calls.
- **Spend ceiling is required, not optional** (`--max-cost` must be provided): each request reserves a conservative upper-bound cost (retries included) before dispatch, scheduling stops when reservations reach the ceiling (so parallel requests can't collectively overshoot), and the report shows actual vs. estimated. Pricing lives in a versioned config file with an effective date; API-reported usage is authoritative for final numbers.
- Bounded concurrency; retry on transient errors; JSONL results support append/resume so an interrupted matrix continues rather than restarts.

### 5. Reporting layer

- Raw results: one JSONL row per (doc × run): representations used, message shape, response (parsed + full), tokens, cost, skip decisions, run metadata.
- Summary per experiment: docs run, token/cost stats, category distribution, refusal/failure/degradation counts.
- **Side-by-side human review report** (HTML): per doc — rendered image(s), text summary, each experiment's feedback. **Student-authored content is untrusted input:** all text is HTML-escaped and student SVG is neutralized (no script execution in a generated report). A `--shareable` mode strips document ids, Firestore paths, and source metadata for reports that leave the team.
- Scoring hooks stubbed until ground truth lands (`harness score` compares outputs against manifest labels).

## Evaluation methodology (define before the expensive matrix)

Counters and token stats are diagnostics, not quality measures. Before running the full production matrix (not before milestones 1–3, which are cheap and synthetic):

- Write the **decision rule** for "mixed wins": primary quality measures (category correctness, visual-content recognition, *written-content recognition* — the image path's predicted blind spot, specificity, unsupported claims), how quality/cost ties break, and minimum corpus size/composition for a conclusion.
- **Stratify by document work style — this is the primary comparison, not an afterthought.** The story's hypothesis is that single-representation modes are unfair across work styles (image mode degrades written work; text mode erases drawn work). So every document gets a modality classification in the manifest (mostly-drawn / mostly-written / mixed, derivable from the per-tile capability flags), the corpus must contain enough of each, and results are reported per group. The success criterion is per-group: mixed mode at least matches today's quality for drawn work and beats it for written work, at acceptable cost. An overall average could show a small win while hiding exactly the gap the story exists to close.
- Keep **category labels and feedback-quality judgments separate** — they can disagree.
- **Blind the review workflow:** reviewers label documents (or rank outputs) without knowing which experiment produced which output; randomize presentation order; define how reviewer disagreements resolve. Ground truth must not be created by reviewers anchored on model outputs they're grading.
- Treat teacher `aiAgreements` as *candidate* signal — confirm what an agreement actually asserts before using it as category ground truth.

This section becomes the concrete version of spike step 2 once team question 1's answers arrive.

## Data safety (enforced, not just procedural)

- One canonical artifact root — `scripts/ai-harness/data/` — holds everything derived from documents: corpora, representation caches, response caches, results, reports. The whole tree is gitignored; nothing derived from student work is written outside it.
- `harness pull` refuses to run without `--production-data-approved` (the flag names the sign-off) and refuses to write outside the data root. Production corpora and reports are flagged in their manifests so downstream commands can warn.
- The data-agreements sign-off covers **local extraction and storage** as well as re-sending to OpenAI. Related-summaries data contains *other* students' information — call that out explicitly in the sign-off request rather than assuming it's covered.
- Retention guidance in the README: delete production corpora when the experiment concludes; document ids/paths appear only in non-shareable reports.

## CLI shape

```
cd scripts/ai-harness
npx tsx harness.ts import --from <dir> --corpus demo1
npx tsx harness.ts pull --corpus mods-prod --unit mods --limit 50 --production-data-approved   # gated
npx tsx harness.ts represent --corpus demo1 --variants default,minimal,svg-drawings
npx tsx harness.ts plan --experiment experiments/mixed-vs-baselines.json                       # dry run
npx tsx harness.ts run --corpus demo1 --experiment experiments/mixed-vs-baselines.json --max-cost 5.00
npx tsx harness.ts report --corpus demo1 --runs <run-ids> [--shareable]
```

- The **experiment schema supports conditional dimensions or explicit run definitions** — not a blind Cartesian product. Invalid/meaningless combinations are validation errors (image detail on text-only runs, text variants on image-only runs, extras without a text summary, per-tile image sets with a single-image message shape, prompts whose response schemas aren't comparable across runs).
- `harness plan` prints the expanded run list, run count, and projected maximum cost before anything executes.
- Corpus/manifest/experiment/result schemas all carry version fields and are validated at runtime.

## Verification plan (the harness is code; it gets tests)

Against the committed synthetic corpus with mocked OpenAI responses: manifest/experiment schema validation; deterministic cache keys (canonical serialization); production-parity message snapshots (harness output vs. the shared builders as production calls them); single- and multi-image encoding; skip-empty classification for every registered tile type; cost-ceiling behavior under concurrency; retry and partial-run resume; JSONL append/resume; corrupt/unsupported document handling; HTML/SVG escaping in reports. An end-to-end smoke run (synthetic corpus, mocked API) is the acceptance test for milestones 1–3.

## Milestones

1. **Shared builders + skeleton.** Extract the pure message/schema builders to `shared/` (production consumes them from there too — this is a small production PR). Corpus/experiment/result schemas with validation. Synthetic corpus covering every tile type. `import`, text representations, text-only runs via the shared builders, JSONL results, cache, required spend ceiling, run metadata.
2. **Images.** Multi-image representation model; puppeteer backend (base64 data URLs), then parameterized Shutterbug backend. Image-only production-parity baseline.
3. **Mixed + variants.** `buildMixedMessages` (in `shared/`), skip-empty with the initial capability registry, extras in all three variants (including the reproduced production bug), detail low/high, accurate-height, per-tile and visual-tiles-only image sets, `no-dataset-tables` (new summarizer work). Smoke matrix on synthetic corpus; verify caching, ceiling, resume, reports.
4. **Review report.** Side-by-side HTML with escaping and `--shareable` mode.
5. **Evaluation definition.** Decision rule + blinded review workflow written down (needs team question 1's examples; becomes spike step 2).
6. **Production corpus (gated).** Safeguards from "Data safety," then `pull`, then the approved full matrix.

Milestones 1–4 need nothing from the project team. Drawing-serializer prototypes (spike step 3) plug into milestone 1's variant mechanism as soon as they exist.

## Review disposition

An external review (Codex, 2026-08-11) of the first draft raised 16 findings; this revision adopts nearly all of them: shared-builder extraction promoted to milestone 1 (was an open question); the `findRelatedSummaries` production bug documented with three named extras variants (the review's standout catch — verified in code); multi-image representation from the start with base64 transport for local files; evaluation-methodology section added (right-sized: required before the production matrix, not before the cheap synthetic milestones); data-safety enforcement expanded well beyond "gitignore the corpus"; cache identity strengthened with run metadata and canonical serialization; historical/regenerated baseline separation via content hashes; `no-dataset-tables` named as new work with explicit semantic options; the skip-empty capability registry specified with conservative defaults; experiment-matrix validation and dry-run planning; reservation-based spend ceiling, now required; "offline" renamed to "local" with per-command prerequisites; stale references to the settled config question removed; committed examples moved outside the ignored data tree; prompt provenance fields; and a verification plan including report XSS hardening. No findings were rejected; two were right-sized as noted (evaluation timing, and treating teacher agreements as candidate rather than automatic ground truth — which the review itself also cautioned).
