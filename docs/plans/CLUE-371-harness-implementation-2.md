# CLUE-371 Harness — Milestone 2 Implementation

Status: implementation spec for milestone 2 of [CLUE-371-harness-plan.md](./CLUE-371-harness-plan.md), following the pattern of [CLUE-371-harness-implementation-1.md](./CLUE-371-harness-implementation-1.md). Written to be handed to a coding agent as a self-contained work order. Revision 2 addresses an external (Codex) review — see "Review disposition" at the end.
Branch: `CLUE-371-harness-m2` off `CLUE-371-harness-m1` (stacked; rebase onto m1 as review changes land there; do not open this PR until m1 merges).
Scope: image representations — the multi-image representation model, a puppeteer render backend, a parameterized Shutterbug backend, and image-only experiment runs at production parity. Nothing else — see "Out of scope."

## Why this shape

Milestone 1 proved the text path end to end and produced the first finding: text-only summaries leave most visual-only documents categorized "unknown." Milestone 2 adds the other production representation — the screenshot — so image-only baselines can run against the same corpus, completing the pair that milestone 3's mixed mode will be judged against. Parity rule unchanged: requests are built by the shared production builders; the harness only decides what goes into them.

## The first trap: images are not text in the cost model

`estimateInputTokens` currently counts `canonicalJson(messages).length / 3`. A base64 data URL for one screenshot is ~500 KB, which that formula prices as ~170k input tokens — every reservation would exceed any sane `--max-cost` before a single call went out. Images are billed by their own formula, not by characters:

- Extend `src/pricing.json` per model with `imageTokens: { detailLowFlat, base, perTile, tileSize, maxShortSide, maxLongSide }`. For `gpt-4o-mini` seed with the documented accounting — flat ~2833 tokens at `detail: "low"`; at auto/high, ~2833 base + ~5667 per 512px tile after the image is scaled to fit 768 on the short side / 2048 on the long side. These figures were confirmed against [OpenAI's images-and-vision guide](https://developers.openai.com/api/docs/guides/images-vision#calculating-costs) on 2026-08-13; re-verify when implementing and record the check date in `effectiveDate`.
- `estimateInputTokens` splits message content: text parts keep the character heuristic; each image part contributes its image-token estimate computed from the stored dimensions. Since production's builder uses `detail: "auto"` and OpenAI publishes an exact formula only for explicit low and high, **reserve `auto` at the high-detail rate** — a deliberate conservative assumption, stated in the README alongside M1's other ceiling caveats.
- **The estimator cannot get dimensions from the request.** For the shutterbug backend the message contains a bare hosted URL; width and height exist only in the envelope and are unrecoverable without a network fetch. Split the two concerns so the accounting data travels beside the payload rather than inside it:

  ```ts
  interface HarnessRequest {
    apiRequest: { model, messages, responseFormat, generationSettings };  // the only thing sent
    inputAccounting: { images: Array<{ sha256, widthPx, heightPx, detail }> };
  }
  ```

  A test asserts `inputAccounting` never appears in the serialized API request.
- Validator updates in `schemas.ts` for the new pricing fields (positive integers, same style as A8/C-series checks).
- Tests: a synthetic request with one image part reserves image tokens plus prompt-text tokens, NOT base64-length/3; the reservation for a full-document screenshot lands in the tens-of-thousands of tokens, not hundreds of thousands.

## The second trap: the fixtures do not render without the right unit

Tile types are not registered globally. `stores.ts` builds `unitTileTypes` from the loaded unit's `toolbar`, `authorTools` and `tools`, and calls `registerTileTypes` with exactly those. Omit the `unit` parameter and CLUE loads `defaultUnit`, which `src/clue/curriculum-config.json` sets to `"sas"` — a CMP math unit whose toolbar covers a fraction of what the synthetic corpus uses. The renderer will still write a perfectly valid PNG of unregistered tiles.

Checked against the corpus: the **QA unit** (`src/public/demo/units/qa/content.json`) registers 18 of the 20 registered tile types the fixtures use. Missing: **`AI`** and **`ErrorTest`**.

So every render passes a unit, defaulting to the QA unit, and those two gaps are handled deliberately — either a harness-owned rendering unit extending the QA toolbar, or an explicit "not renderable under this unit" entry per fixture in `expectations.json`. Preference is the harness-owned unit: the synthetic corpus is the regression suite for exactly this, and a fixture that silently renders as an unknown tile is a hole in it. One mechanic to settle at implementation: the `unit` parameter must be a URL/path the rendering page can actually load — either serve a harness-owned `content.json` (committed under `scripts/ai-harness/`, served by a tiny static handler or the dev server) and pass its absolute URL, or fall back to the QA unit plus `expectations.json` entries for the two gaps if URL-loading a unit proves awkward. Do not add harness files under `src/public/` for this. `Placeholder` and `Unknown` need nothing — they are statically registered, and `Unknown` is *supposed* to render as an unknown tile.

The unit is part of the render target, so it participates in freshness.

## Image representation model (`src/represent-image.ts` + schema changes)

A new envelope kind, stored under `data/corpus/<name>/representations/image-<backendId>/<docId>.json`, with the PNG(s) beside it:

```json
{
  "schemaVersion": 1,
  "docId": "drawing-only",
  "kind": "image",
  "backendId": "puppeteer",
  "backendVersion": 1,
  "renderTarget": {
    "clueUrl": "http://localhost:8080",
    "unit": "./demo/units/qa/content.json",
    "clueRevision": "9b53df828 (dirty)",
    "shutterbugUrl": null,
    "viewportWidthPx": 960,
    "captureMode": "full-document",
    "captureHeightPx": null
  },
  "sourceContentSha256": "…",
  "generatedAt": "…",
  "images": [
    {
      "file": "drawing-only-1.png",
      "sha256": "…",
      "mimeType": "image/png",
      "widthPx": 960,
      "heightPx": 1420,
      "bytes": 512345,
      "url": null,
      "tileId": null,
      "purpose": "full-document"
    }
  ]
}
```

- **Arrays from the start** (per the harness plan): milestone 2 always produces exactly one full-document image, but the model, validators, and freshness checks handle N so milestone 3's per-tile capture is additive. Request construction, however, **requires `images.length === 1`** and fails with an error naming milestone 3 — zero and many both fail, and the first image is never silently selected.
- `file` is a bare filename resolved against the envelope's directory, containment-checked with the same `path.relative` pattern `resolveCorpusFile` and `resolveDataPath` already use.
- `sha256` is of the file bytes ("file bytes" rule from implementation 1). Width and height come from reading the PNG's IHDR chunk directly — magic bytes then width/height at a fixed offset, about fifteen lines — which validates PNG-ness at the same time and avoids adding a dependency to a package that pins exact versions and runs a three-way lockstep test.
- **`renderTarget` is structured, not a description string**, because it is compared for freshness. `clueRevision` records what was actually rendered against: the CLUE git commit plus dirty flag for a local target, a build identifier for a hosted one. `http://localhost:8080` serves different code tomorrow, and a mutable branch deployment does too; `backendVersion` covers the harness's renderer, not the application being rendered. When the revision cannot be established, record `null` and **warn**; `--refresh` forces re-rendering regardless of freshness.
- **Freshness validates the files, not just the envelope.** Mirroring C8 but going further: an image representation is fresh only when `sourceContentSha256`, `backendId`, `backendVersion`, `docId` and every `renderTarget` field match expectations **and** each `images[]` entry resolves inside the envelope directory, exists, decodes as PNG, and matches its recorded `sha256`, `bytes`, `mimeType` and dimensions. Without the file-level half, a deleted, truncated, replaced or resized PNG passes as fresh. Bump `backendVersion` whenever a backend's output would change for the same input.
- `--prune` (C9) deletes image envelopes and their PNGs along with everything else.

## The render modes

The three existing sources disagree about what a screenshot is, which is the trap this section exists to avoid:

| | CLUE URL | unit | capture |
|---|---|---|---|
| `on-analysis-document-pending.ts` (production) | `.../branch/shutterbug-support` | `mods` | `{content, height: 1500}` — **no `fullPage`** |
| `scripts/shutterbug.ts` (prior art) | same branch, hardcoded | none | `{content, height: 500, fullPage: true}` |
| `scripts/ai/document-screenshots.ts` (prior art) | `localhost:8080/editor/` | `example` | `page.screenshot({fullPage: true})` |

`scripts/shutterbug.ts` is therefore **not** a production baseline — it renders a different height and adds `fullPage`. Ship three named modes and never fold an improvement into the baseline:

**`shutterbug-production-current` (parity baseline; network).** Reproduces today's production request exactly: the production Shutterbug endpoint, the `branch/shutterbug-support` CLUE URL, `unit=mods`, `height: 1500`, no `fullPage`. Bug-for-bug, clipping included. Pinned by a snapshot test (criterion 12) so it cannot drift while the other modes evolve.

**`shutterbug-parameterized` (network).** The same transport with `--clue-url`, `--unit`, `--shutterbug-url` and capture height all configurable. This is the shape the eventual production fix will take, and what proves the parameterization works.

**`puppeteer-full-height` (default; local).** Build the same HTML production sends to Shutterbug — a `<script>` with the document JSON plus an iframe loading `<clueUrl>/iframe.html?unit=<unit>&unwrapped&readOnly`, posting `initialValue` on load — `page.setContent` it in headless puppeteer, and screenshot the iframe element. This renders through the *same* iframe pathway production's screenshots use, differing only in who captures. Viewport width 960; full content height (no 1500px clip — the harness captures reality; production's clipping is a separate production concern). Prerequisite: a running local CLUE server (`npm start`). Add `puppeteer` to the harness `package.json`, pinned exact, matching `scripts/package.json`'s major.

Call puppeteer a **local** backend, not an offline one: the rendered unit may pull fonts, images or other assets from elsewhere. If offline operation ever becomes a guarantee, the backend must intercept and reject non-localhost requests, and a test must assert it.

**Transport into messages:** production parity again — `buildImageMessages(aiPrompt, url)` from `shared/`, unmodified (detail stays the hardcoded `"auto"`). For the shutterbug modes, pass the hosted URL (exactly what production sends). For puppeteer, pass a base64 data URL of the PNG (exactly what production's `categorizeDocument()` does with a local file). The envelope's `purpose`/`tileId` fields do not affect milestone-2 messages.

## Rendering: safety, readiness, bounds

**Safe HTML generation.** `generateHtml()` interpolates the document straight into a script element — `` `<script>const initialValue=${JSON.stringify(doc)}</script>` `` — so student text containing `</script>` terminates the element and injects markup into the render page. Both prior-art copies have this, and so does production (see "Findings for elsewhere"). Milestone 2 writes **one** tested generator in `src/backends/render-html.ts`, shared by all three modes rather than becoming a third subtly different copy, escaping `<`, `>`, `&`, U+2028 and U+2029 in the serialized document and HTML-escaping every interpolated attribute. A committed adversarial fixture — text containing `</script>`, quotes, ampersands and Unicode separators — is rendered as part of acceptance, with a unit test asserting the generator's output.

**Readiness.** Neither `networkidle0` nor a single `updateHeight` proves rendering finished: the iframe can report height before fonts, dynamic tile modules or async tile content settle, and some pages never go network-idle. Wait for the iframe to load and post the document; wait for at least one valid `updateHeight`; wait until the height is stable for a short interval (start at 500ms); wait for `document.fonts.ready`; fail on any page error, unhandled rejection, failed dynamic import, or console error naming an unregistered tile type; apply a per-document timeout (start at 30s) reporting the doc id, URL and last known height. An explicit "document rendered" message in the iframe pathway would be more robust, but that is a production change — noted in "Out of scope" as an M3+ candidate.

**Failure and bounds.** On failure write no envelope, keep an error screenshot and captured console output under `data/corpus/<name>/render-errors/<backendId>/<docId>/`, continue with the remaining documents, and exit non-zero. One browser for the whole run, a page per document with concurrency capped at 4, pages closed in `finally`, no retry — a render failure is a bug to look at, not a transient. `render` reports rendered / reused / failed counts.

**Shutterbug network contract.** POST HTML, receive `{url}`, download the image — with every step given a defined failure: a configured endpoint (production or staging, never inferred); request timeout and at most two retries on 5xx/network; `response.ok` checked; the JSON validated as `{url: string}`; the URL required to be `https:`; download timeout, redirect limit and maximum download size; content type checked; bytes decoded as PNG before anything is committed; envelope and image written atomically (temp file plus rename, as `cache.ts` already does); partial files cleaned up. A `.png` suffix is not evidence of PNG bytes. Keep the hosted `url` in the envelope alongside the downloaded copy.

**Limits.** Long documents can exceed Chromium's screenshot limits or produce unreasonable payloads. Set explicit guardrails per mode — maximum capture height, maximum pixel count, maximum encoded bytes (well under OpenAI's 512MB per-request allowance; start at 20MB) — and **fail the document** on exceeding any of them. A clipped capture must never be recorded as `captureMode: "full-document"`.

## CLI and experiment changes

- New command: `npx tsx harness.ts render --corpus <name> --mode puppeteer-full-height|shutterbug-production-current|shutterbug-parameterized [--clue-url <url>] [--unit <unit>] [--shutterbug-url <url>] [--refresh]` — the image analogue of `represent`, with the same reuse-if-fresh behavior and summary line.
- Experiment runs may now be `{ "message": "image-only", "imageMode": "puppeteer-full-height", "prompt": … }`. Validation: `image-only` runs require `imageMode` and reject `textVariant`; `text-only` runs reject `imageMode` (the C-series conditional-validation pattern). `buildTasks` loads the image envelope, checks freshness, and builds the request via the shared image builder.
- **Result rows do need a structural change.** `ResultRowCommon.textVariant` is a required `string`, so an image-only row has nothing honest to put there, and `runId` alone loses the image provenance. Replace it with a descriptor that both kinds populate:

  ```ts
  type RepresentationDescriptor =
    | { kind: "text";  variantId: string; variantVersion: number; sourceContentSha256: string }
    | { kind: "image"; modeId: string; backendId: string; backendVersion: number;
        renderTarget: RenderTarget; sourceContentSha256: string; imageSha256s: string[] };
  ```

  `ExperimentRun` and `ResultRow` both discriminate on it. This breaks the M1 result schema: bump result `schemaVersion` to 2 and have the validator reject version-1 rows with a message saying to re-run, rather than silently mis-reading them. It is also the extension point M3's mixed rows need.
- `plan` prints image-token estimates per run using the pricing model above, and each mode's prerequisites.
- `report` groups by message shape as well as modality, so image-only and text-only totals sit side by side instead of summed, and adds an image-token column.
- Add `experiments/image-vs-text.json`: text-default, text-minimal, image-puppeteer (and image-shutterbug, commented out or present — author's choice) so one file runs the milestone's headline comparison.

## Caching and results notes

- Cache entries and result rows already store the full raw response; nothing changes there. Cache files for image runs are larger; that's fine, `data/` is disposable.
- **Cache identity must cover the pixels, not just the URL.** For puppeteer the message contains a base64 data URL, so the request key already identifies the image. For the shutterbug modes it contains only a hosted URL, and the same URL could serve different bytes. The harness's cache and resume identity therefore hashes the API request **plus** `inputAccounting.images[].sha256` — API payload identity and evaluation identity are related but not the same thing.
- **Hosted URLs expire, and a fresh envelope will not re-render.** Because reuse-if-fresh skips the Shutterbug call entirely, a stored URL never rotates on its own; what happens instead is that it eventually stops resolving while the envelope still looks valid, and the run fails mid-flight after money has been spent. `run` verifies each hosted URL is retrievable before dispatching that task and fails with an instruction to re-render; `plan` stays network-free and says instead that hosted URLs were not verified.
- Regeneration is a cost event: new pixels mean new request keys and a full re-spend. `render` reports regenerated-versus-reused counts; the README says what that implies.

## README updates

Prerequisites table gains the `render` command rows (puppeteer: local CLUE server, **local** rather than offline, no key; shutterbug modes: network + service availability, no key). Document the three named modes and the parity trade (`shutterbug-production-current` = exactly production's pixels, clipping included; puppeteer = same render pathway, locally captured, full height). Note the image cost model, the `auto`-reserves-at-high assumption, the rendering unit and its two gaps, the render-error directory, that `detail` is fixed at `"auto"` by the shared builder (variants come with milestone 3), and — per the milestone-6 gate — that the Shutterbug modes upload document content to a third-party service, which needs confirmation against the data agreement before any production corpus is rendered.

## Carried over from the milestone-1 review

The final review of the milestone-1 PR raised issues in `src/execute.ts`, `src/cost.ts`, `harness.ts`,
`src/report.ts`, `src/schemas.ts` and `README.md`. Milestone 2 has already rewritten all six — between
42 and 330 changed lines each — so fixing them on `CLUE-371-harness-m1` would have guaranteed rebase
conflicts for no benefit. They land here instead. Everything the review raised in files milestone 2
does not touch was fixed on m1 (commits `9d00f5273`, `e269c1662`).

**Two real bugs, both verified against the installed `openai@6.45.0`.**

1. **Retries never fire on network failures.** `isTransientError` matches only a numeric `status` or a
   string `code`, but the SDK wraps every network-level failure — DNS, socket reset, and this file's
   own `timeout: 120_000` — in `APIConnectionError` / `APIConnectionTimeoutError`. Both report
   `name=Error`, `status=undefined`, `code=undefined`, so the function returns false. Since
   `openAiCompletion` sets `maxRetries: 0` precisely so the harness owns retries, a connection blip
   yields one attempt and an error row, contradicting the spec's "retry twice on transient errors
   (429/5xx/network)". Fix: return true for `error instanceof APIConnectionError` (exported from the
   package root) before the status check, and read the wrapped cause as well —
   `(error as any)?.code ?? (error as any)?.cause?.code`. Test with `new APIConnectionTimeoutError({})`.
   The `code` branch as written can only fire for a raw Node error this path never sees.

2. **A truncated completion never reaches the billing path.** `client.chat.completions.parse()` throws
   `LengthFinishReasonError` (and `ContentFilterFinishReasonError`) *before* returning whenever a
   choice's `finish_reason` is `length` or `content_filter` —
   `node_modules/openai/lib/parser.js:96-101`. Because every request sets
   `max_completion_tokens: 1024`, hitting the cap is the likeliest way to get an unusable response,
   and when it happens `openAiCompletion` never builds a `CompletionResult`: the throw lands in the
   retry loop's catch and the row written has no `usage`, no `cost` and no `finish_reason`. The
   `result.parsed == null && result.refusal == null` branch is unreachable for the length case.
   Fix: call `client.chat.completions.create()` with the same `response_format` and parse the
   response with the format's own `$parseRaw`, so `usage`, `finish_reason` and `raw` survive every
   outcome and the existing unparsed branch handles it. Production parity is preserved because parity
   is a property of the *request*, which is unchanged — `parse()` is `create()` plus a throwing
   parse step. Note the two error classes are exported from `openai/error`, not the package root.
   Relatedly, the unparsed test in `test/cache.test.ts` feeds a `finish_reason: "length"` completion
   straight to `runTasks`, simulating a response the real backend cannot deliver; route it through
   `openAiCompletion` once the wrapper no longer throws.

   One correction to the review on this point: the ledger still charges via `settleFailedAttempt`, so
   `--max-cost` is not breached — it over-charges if anything. What is lost is row fidelity and the
   report's token and cost totals.

**Documentation that describes the code wrongly.** These matter because the README is what a reader
consults to decide what `--max-cost` permits.

3. `src/execute.ts`, `src/cost.ts` and `README.md` all say a failed attempt is charged "its
   single-attempt share", but `failedAttemptShareUsd` charges
   `reservation.amountUsd * (failedAttempts / totalAttempts)` — so with `kRetries = 2` a request that
   burns all three attempts is charged the **whole** reservation, up to 3× what the docs imply.
   Reword all three to "one attempt's share of the reservation per attempt dispatched, up to the
   whole reservation".
4. `README.md`: "`--output` is resolved against the data root" is wrong. `resolveDataPath` resolves a
   relative value against `harnessRoot` and only then checks containment, which is why
   `--output results/x.jsonl` is refused rather than read as `data/results/x.jsonl`. Say it resolves
   against `scripts/ai-harness`, the same base as `--from` and `--experiment`.
5. `README.md` DEVIATIONS omits two real departures from implementation doc 1, and the m1 PR
   description points reviewers at that list as the diff against the spec: the default output path is
   `data/results/<corpus>-<experiment>.jsonl` where the spec says `<experiment>.jsonl`, and
   `estimateTokensForText` counts every non-ASCII character as a whole token where the spec says a
   flat `length / 3`. The second changes the arithmetic `--max-cost` depends on.

**Behavioral fixes, in rough priority order.**

6. `error.type` is `(lastError as any)?.name ?? "Error"`, but no SDK error class assigns `name`, so a
   429, a 400, a timeout and a truncation all record `"Error"` and the field distinguishes nothing.
   Use `constructor?.name`, and record the numeric `status` when present.
7. The overshoot message reports committed reservations as actual spend: `hasExceededCeiling` trips on
   `committedUsd` but the worker logs "Actual spend has passed the ceiling by $X". `summary.overshootUsd`
   can also end at 0 while `stoppedOnCeiling` is true. Keep tripping on `committedUsd`, word the
   message from `incurredUsd`, and consider a separate `committedOvershootUsd`.
8. "Stopped early" prints even when every task ran: the ceiling check precedes the
   `index >= pending.length` check, so the worker that wrote the final row can set `stoppedOnCeiling`
   on its next iteration. Gate the message on work actually skipped — a `notDispatched` count.
9. The `--no-cache` / `--refresh-cache` guard counts existing rows matching only `corpus` and
   `experimentSha256`, never comparing `requestKey`. Editing a prompt file changes every request key
   but not the experiment hash, so `--refresh-cache` refuses a rerun that resume would not have
   skipped at all. Build the same resume-key set `runTasks` uses and throw only on a real intersection.
10. `summaryPathFor` returns `<dirname>/summary.json`, so every results file in a directory shares one
    summary and reporting on one silently overwrites another's — the normal case, since the default
    output directory is `data/results/`. Use `<basename>.summary.json` and update the README.
11. `defaultOutputFile` joins corpus and experiment with a hyphen, and both permit hyphens under
    `[a-z0-9-]+`, so corpus `a-b` + experiment `c` and corpus `a` + experiment `b-c` both resolve to
    `a-b-c.jsonl` — and `report` then refuses the merged file outright. Naming the corpus exists to
    prevent exactly this. Use a separator the id pattern forbids (`__`) or nest by corpus.
12. `buildTasks` reserves with `options.retries` while `runTasks` independently reads
    `options.retries ?? kRetries`, with nothing tying them together: a caller passing `retries: 5` to
    one and not the other reserves for three attempts and dispatches six. The CLI passes neither today,
    so the invariant that makes `--max-cost` a bound is convention rather than code. Put `retries` on
    `RunTask` beside `worstCaseUsd` and read it per task, or assert the two agree.
13. The containment checks in `resolveDataPath` and `resolveCorpusFile` use `path.resolve` and
    `path.relative`, which are purely lexical: if `data/` or anything under it is a symlink out of the
    repo — a plausible way to put a scratch tree on another disk — every check passes and derived
    content lands outside the `.gitignore` entry protecting it. Resolve the data root and the
    candidate's existing parent with `fs.realpathSync` before comparing, and note the residual in the
    README's data-safety section. Worth closing before milestone 6 pulls real student work.
14. Reports never show computed versus overridden modality, though implementation doc 1 requires
    "reports use the override when present and show both". Only `effectiveModality` is carried and
    `ResultRowCommon.modality` is a single field, so a hand-set `modalityOverride` silently regroups a
    document with no trace that a human rather than the classifier put it there. Either add
    `computedModality` to the row and an overridden count to `GroupSummary`, or record the deferral in
    DEVIATIONS. **Couples to this milestone's `RepresentationDescriptor` work** — decide both together.

**Comment and wording cleanups, while the files are open.** `src/execute.ts` references a review label
("A1 turned that off") where the reason is that `openAiCompletion` sets `maxRetries: 0`, and narrates
a fixed bug rather than the invariant in the `apiCalls` comment; `test/smoke.test.ts` carries an
"Acceptance criterion 12" lead-in and a "(C1)" label; `harness.ts`'s module docstring carries the
ticket id; `README.md` has "Behaviour parity" and an "Acceptance criterion 13" cross-reference. None
of these survive the documents they point at.

**Couplings worth planning around.** Item 2's fix restructures `openAiCompletion`, which this milestone
already reshapes via the `apiRequest` / `inputAccounting` split — do them as one change rather than
twice. Item 12 touches `RunTask`, which gains image fields here. Item 14 touches `ResultRowCommon`,
which gains the representation descriptor here.

## Acceptance criteria (milestone 2 is done when…)

1. `npm ci`, `npm run typecheck`, `npm test` pass in `scripts/ai-harness`; `functions-v2` and root suites unaffected and passing.
2. Cost-model tests: image parts are estimated by the image-token formula, never by character count; `auto` reserves at the high rate; pricing validation rejects malformed `imageTokens`; `inputAccounting` never appears in the serialized API request.
3. `render --mode puppeteer-full-height` against the synthetic corpus produces an envelope + PNG per document; rerunning reuses fresh envelopes; a bumped `backendVersion` or `--refresh` regenerates.
4. **Renders are verified, not merely produced**: every image decodes; dimensions and hash match the file; no page error, failed import or unregistered-tile console error occurred; each fixture expected to render shows its distinctive marker through a render-aware check. A fixture that cannot render under the chosen unit is declared as such in `expectations.json`, not silently accepted.
5. Freshness tests cover the full matrix — content hash, backend id/version, docId, every `renderTarget` field including `clueRevision`, and the file-level checks (deleted, truncated, replaced, resized).
6. The mocked smoke test extends end-to-end through an `image-only` run with no browser and no network, using a committed fixture PNG; an envelope with 0 or 2 images fails with a milestone-3 error.
7. A **local renderer integration test** drives puppeteer against a running dev server for a subset of fixtures. It may be excluded from ordinary CI, but it is a required scripted step — a fixture PNG proves the wiring, not the rendering.
8. The adversarial fixture renders correctly and its generated HTML matches a snapshot; unit tests cover `</script>`, quotes, ampersands and U+2028/U+2029.
9. Documents exceeding the height, pixel or byte limits fail with a clear message and produce no envelope.
10. Experiment validation: the conditional rules for `image-only`/`text-only` runs each have a test; version-1 result rows are rejected with an actionable message.
11. Human-verified (the milestone-2 analogue of criterion 13): one real `image-vs-text` run against the synthetic corpus with `--max-cost 1.00` — expect roughly $0.10–$0.30, dominated by image tokens — followed by a report showing image-only rows alongside the text baselines, per modality. What this establishes is that the pipeline works, what it costs, and that the two representations can be inspected side by side; **it does not establish that image mode is better.** There is no ground truth or rubric yet, so record observations (for instance, how many visual-only fixtures stop coming back "unknown") as observations, not as a quality conclusion. That comparison waits for milestone 5.
12. The two carried-over bugs have tests: `isTransientError` returns true for a constructed
    `APIConnectionTimeoutError`, and a completion whose `finish_reason` is `length` produces an
    `unparsed` error row carrying `usage`, `cost` and the finish reason rather than a bare error.
13. **Production-parity snapshot test**: `shutterbug-production-current` generates exactly today's production request — CLUE URL, `unit=mods`, unwrapped/read-only flags, `height: 1500`, no `fullPage`, production endpoint.
14. One `shutterbug-production-current` render verified by hand against a real target, recorded in the README.
15. `git status` clean outside `data/` after a full run.
16. README updated per above; any spec-vs-reality conflicts recorded in DEVIATIONS with reasons.

## Out of scope (do not build, even if tempting)

Mixed-mode messages and `buildMixedMessages` (M3); detail low/high variants and any change to the shared builder's `"auto"` (M3); per-tile and visual-tiles-only capture, accurate-height experiments beyond the three named modes (M3); skip-empty execution (M3); HTML review report (M4) — though the PNGs this milestone stores are what M4 will display; rubric scoring and any quality conclusion (M5); production corpus pull (M6); fixing production's hardcoded Shutterbug render target (separate production change; the harness merely parameterizes its own copy); adding a "document rendered" message to the iframe pathway (production change; M3+ candidate).

## As built

Everything above is the work order as written *before* implementation, kept as the record of intent.
Four things were decided differently once the code met a real CLUE server, and the reasons are in
`scripts/ai-harness/README.md` under DEVIATIONS (entries 11-19). In brief:

- **Envelopes are filed under the mode id, not the backend id.** Both Shutterbug modes share the
  backend id `shutterbug` and would have overwritten each other, so a parity render and a
  parameterized one could never coexist — which is the comparison this milestone wants.
- **The readiness protocol does not wait for `updateHeight`.** That message carries
  `document.body.scrollHeight`, which is 0 on current CLUE code, so the wait this document
  prescribes can never be satisfied; it is why the first working version of the local backend
  rendered nothing at all. Readiness is measured inside the CLUE frame instead, and the frame is
  sized from the document's own tile rows before capture.
- **The render page is served over loopback HTTP rather than injected with `setContent`.** An
  injected page has an opaque origin, and Chromium then denies the CLUE iframe access to
  `localStorage`, so CLUE throws before it finishes booting. Shutterbug serves its page from a real
  origin by construction, which is why production never meets this.
- **The fatal-error set is narrower than "any console error or failed request".** A real CLUE server
  logs React key warnings at error level and probes for an optional `teacher-guide/content.json`
  that legitimately 404s; failing on those failed every document. Page errors and failed script
  loads are fatal, everything else is recorded as evidence.

`puppeteer-full-height` is therefore at `backendVersion: 2`; version 1 never produced a usable
render. All acceptance criteria below are met, including the human-verified ones — the parity render
against the real Shutterbug service is recorded in the README.

Two fixture-level problems are deferred rather than fixed, and they bound what an image-mode result
on this corpus means: text tiles authored with `format: "markdown"` render blank (an explicit TODO in
`src/models/tiles/text/text-content.ts`), and an unregistered tile renders invisibly, so `empty` and
`unknown` produce byte-identical PNGs.

## Findings for elsewhere

Things that surfaced here and are not milestone 2's to fix:

- **The `generateHtml()` script injection exists in production.** `on-analysis-document-pending.ts` interpolates `JSON.stringify(content)` into a `<script>` element and posts the result to Shutterbug, with real student work, today. A document whose text contains `</script>` can inject markup into the render page. The harness fixes its own copy; production needs a small PR of its own, and it becomes more pressing with the text+image-always rollout, which puts every unit on this path.
- **The harness plan mislabels `scripts/shutterbug.ts` as production parity.** It renders `height: 500, fullPage: true` against production's `height: 1500` and no `fullPage`. Correct the prior-art wording so the next reader does not inherit the assumption.
- **`updateHeight` reports 0 on current CLUE code, and production will inherit it.** Production sizes its screenshot iframe from that message, which carries `document.body.scrollHeight` — 0 on current code, because the content lives in `#app`. Production is *not* broken today: it renders against the deployed `branch/shutterbug-support` build, which still posts real heights (measured: 650, then 190, with the iframe sized to 190px), and a hand-verified parity render came back correct. The risk is latent with a known trigger — **the first rebuild of production's render target from current CLUE code collapses every screenshot to a 0px iframe.** Worth fixing before that rebuild, not after; an explicit "document rendered" message would remove the dependency on `scrollHeight` altogether.
- **Text tiles authored with `format: "markdown"` render nothing.** `src/models/tiles/text/text-content.ts` returns `[]` for that format behind an explicit `// TODO: figure out what to do about markdown`. The text summarizer reads `content.text` directly and is unaffected, so a document can summarize richly and render as an empty tile — which matters for any image-mode comparison, and for authoring guidance about which format to use.

## Review disposition

An external (Codex) review of revision 1 raised 20 findings; all were checked against the code and nearly all are adopted. Three materially changed the design. "Production parity" was an adjective rather than a tested mode, and the two prior-art scripts disagree with production and each other — now three named modes plus a snapshot test. Tile types register from the *unit's* config, so with no `unit` parameter CLUE loads `defaultUnit` (`sas`) and most fixture tiles never register while a valid PNG is still written — now a required unit, narrowed to the specific gap: the QA unit covers 18 of 20, missing only `AI` and `ErrorTest`. And revision 1's claim that result rows need no structural change was wrong: `ResultRowCommon.textVariant` is a required string, so image-only rows could not be represented — now a discriminated descriptor with a schema-version bump. Also adopted: file-level freshness, structured `renderTarget` with a revision, the `apiRequest`/`inputAccounting` split, hosted-URL expiry and content identity in the cache key, the Shutterbug network contract, size limits, the readiness protocol, safe HTML generation, bounded rendering, "local" rather than "offline", and the strengthened acceptance criteria including a required local-render integration step.

Two were right-sized rather than adopted as written. An explicit "document rendered" message in the iframe pathway is a production change, so it is recorded as an M3+ candidate behind a documented stability heuristic. And PNG dimensions do not need a new dependency: a ~15-line IHDR read validates PNG-ness at the same time, which suits a package that pins exact versions and runs a three-way lockstep test better than adding `image-size`.

The review also confirmed revision 1's `gpt-4o-mini` image-token constants against current OpenAI documentation, which is recorded above with the date.

Revision 3 (2026-08-17) adds "Carried over from the milestone-1 review": the issues that milestone 1's
final review raised in files this milestone has already rewritten, so they are fixed once, here,
rather than fought through a rebase.
