# CLUE AI evaluation harness

A checked-in tool that runs (representation × prompt × message-shape) experiments against a corpus of
CLUE documents and reports quality inputs plus token and cost numbers — so text-only vs. image-only
vs. mixed-mode claims are backed by measurements instead of intuition.

This is **milestone 2** of [CLUE-371](../../docs/plans/CLUE-371-harness-plan.md). Milestone 1 built
the shared message builders, the harness skeleton, a synthetic corpus, text-only runs, the response
cache, the spend ceiling, and reports as data. Milestone 2 adds the other production representation
— the screenshot — so image-only baselines can run against the same corpus. Mixed mode (milestone 3),
the HTML review report (milestone 4), rubric scoring (milestone 5) and the production corpus pull
(milestone 6) are not here yet.

All runs target `gpt-4o-mini`. That is deliberately the rolling alias, not a pinned snapshot:
production calls the alias, and a harness that pinned a snapshot would stop measuring what production
actually does. Reproducibility is handled instead by recording the returned model id and
`system_fingerprint` in every result row's `responseOriginMeta`, so runs months apart can be told
apart after the fact.

## Setup

```bash
npm ci                 # in the repository root first — see below
cd scripts/ai-harness
npm ci                 # not `npm install` — the lockfile is the contract (see "Version lockstep")
npm run typecheck
npm run lint           # the root `npm run lint` glob does not reach this directory
npm test
```

**The root install has to come first.** This package declares no eslint of its own: `lint` runs
`eslint -c ../../.eslintrc.js`, and that config brings its own plugins — `@typescript-eslint`,
`json`, `react`, `react-hooks`, `unused-imports`, `mocha`, `eslint-comments` — all of which resolve
from the root's `node_modules`. Declaring eslint here would not make the directory standalone; it
would need every one of those pinned to the root's versions, and `typecheck` covers files under
`shared/`, which has its own install again. On a fresh clone that installs only this package, `lint`
reports `eslint: not found`.

`lint` runs with `--max-warnings 0` and `--report-unused-disable-directives`, so a warning fails and
so does an `eslint-disable` comment that is no longer suppressing anything. It uses the default
config rather than `.eslintrc.build.js`, which the repository root uses before merging:
that one adds `no-console`, aimed at the React app, and this is a command-line tool whose job is
writing to the console.

`npm run test:render` is a separate, scripted check that drives the local render backend against a
running CLUE dev server and a real headless Chromium, for a subset of fixtures. It needs
`npm start` in the repository root and so is excluded from `npm test` by filename. **Run it after
touching anything in `src/backends/`**: every other render test drives a *fake* browser, which cannot
have an opaque origin, does not run CLUE, and answers whatever selector it is asked. Backend version
1 passed the entire jest suite and rendered nothing at all against a real server.

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
| `render` (puppeteer) | **local** | no | Screenshots each document. Needs a CLUE dev server (`npm start`) and headless Chromium. |
| `render` (shutterbug) | **yes** | no | Posts documents to the Shutterbug service and downloads the result. |
| `plan` | no | no | Validates everything and prints the expanded run list and worst-case cost. |
| `run` | **yes** | **yes** | The only command that calls OpenAI. `--max-cost` is required. |
| `report` | no | no | Reads a results JSONL file and writes `<basename>.summary.json` beside it. |

```bash
npx tsx harness.ts import    --from examples/synthetic-corpus --corpus synthetic-corpus \
                             [--source synthetic|demo|qa] [--prune]
npx tsx harness.ts represent --corpus synthetic-corpus --variants default,minimal
npx tsx harness.ts render    --corpus synthetic-corpus \
                             --mode puppeteer-full-height|shutterbug-production-current|shutterbug-parameterized \
                             [--clue-url <url>] [--unit <unit>] [--shutterbug-url <url>] \
                             [--capture-height <px>] [--refresh]
npx tsx harness.ts plan      --corpus synthetic-corpus --experiment experiments/image-vs-text.json
npx tsx harness.ts run       --corpus synthetic-corpus --experiment experiments/text-baselines.json \
                             --max-cost 0.50 [--output <file>] [--no-cache | --refresh-cache]
npx tsx harness.ts report    --results data/results/synthetic-corpus__text-baselines.jsonl
```

Flags are plain `--name value` pairs. An unknown flag is an error, not a warning.

`plan` on the committed synthetic corpus projects a worst case of about **$0.11** for both text
baselines across all 25 documents, and roughly **$0.22** more for the image-only run — a full worst
case of about **$0.33** for all three, which is the figure the recorded `image-vs-text` run below
reports. Image tokens dominate, and the reservation assumes every retry is used.

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
- Milestones 1 and 2 touch no production data, no credentials, and no `firebase-admin`.

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

### Image representations

`render` writes an envelope per (document, mode) under
`data/corpus/<name>/representations/image-<modeId>/`, with the PNG beside it:

```json
{ "schemaVersion": 1, "docId": "drawing", "kind": "image", "modeId": "puppeteer-full-height",
  "backendId": "puppeteer", "backendVersion": 2,
  "renderTarget": { "clueUrl": "http://localhost:8080", "unit": "harness-render",
    "clueRevision": "9b53df828 (dirty)", "shutterbugUrl": null, "viewportWidthPx": 960,
    "captureMode": "full-document", "captureHeightPx": null },
  "sourceContentSha256": "…", "generatedAt": "…",
  "images": [{ "file": "drawing-1.png", "sha256": "…", "mimeType": "image/png",
    "widthPx": 960, "heightPx": 1420, "bytes": 512345, "url": null, "tileId": null,
    "purpose": "full-document" }] }
```

`images` is an array from the start so milestone 3's per-tile capture is additive, but **request
construction requires exactly one**: zero and many both fail, and the first is never silently
selected.

Freshness checks the files, not just the envelope. A stored render is reused only when the content
hash, mode, backend and backend version all match **and** every PNG it names still exists, still
decodes as a PNG, and still has the recorded byte count, hash and dimensions. Without that, a
deleted, truncated, replaced or resized picture would pass as fresh. `--refresh` re-renders
regardless. `import --prune` deletes image envelopes, their PNGs, and any render errors.

### The three render modes

The three places that already screenshot a CLUE document disagree about what a screenshot is, so the
modes are named and separate, and an improvement never gets folded into the baseline.

| Mode | Network | CLUE URL | unit | Capture |
|---|---|---|---|---|
| `puppeteer-full-height` (default) | local | `--clue-url`, default `http://localhost:8080` | harness's own | full document, 960px wide |
| `shutterbug-production-current` | yes | production's `branch/shutterbug-support` | `mods` | `height: 1500`, no `fullPage` |
| `shutterbug-parameterized` | yes | `--clue-url`, default production's `branch/shutterbug-support` | `--unit`, default `mods` | `--capture-height`, default 1500; `--shutterbug-url`, default **staging** |

**`shutterbug-production-current` is the parity baseline.** It matches production's request envelope
— the production endpoint, the `branch/shutterbug-support` CLUE URL, `unit=mods`, `height: 1500`, no
`fullPage`, and a bare string body with no `content-type`. A snapshot test pins what this mode posts
so it cannot drift while the other modes evolve, and it has been verified by hand against the real
service.

**Deliberate differences from production's HTML**, all from sharing one hardened generator across
all three modes rather than keeping a third near-copy. The page is the `content` field of that
request body, so these are differences in what gets rendered, not in the request around it:

- The document is escaped before it goes into the `<script>` element. Production does not escape it,
  which is the injection bug reported under "Findings for elsewhere". Reproducing a vulnerability in
  the harness's own code is not a baseline worth having. The escaped form parses back to an
  identical object, so this changes the render only for a document that would have triggered the
  bug.
- The height message is applied only when it is a positive number; production assigns it
  unconditionally, so a `height: 0` message collapses production's iframe to `0px` and leaves the
  harness's at its initial height. Against the deployment production actually renders through this
  is unobservable — it posts 650 then 190 — but it would diverge on a target that reports 0, which
  is the scenario "Findings for elsewhere" describes. If reproducing that collapse ever becomes the
  point, the guard is the one line to make mode-specific.
- The page sets `window.__clueRender = { initialValuePosted: false }` and flips it to `true` once
  the document has been handed to the iframe. Production has no equivalent; `puppeteer.ts` waits on
  it, because whether the parent posted the document is the one thing a local capture cannot see
  from outside. Shutterbug ignores it.
- Smaller hardening in the same generator, none of which changes what a working page draws: the
  missing-`contentWindow` branch returns instead of falling through to post to nothing; the message
  listener guards `event.data` before reading `.type`; `console.warn` is used where production
  writes `console.warning` (not a function, so production's warning throws instead of printing); and
  the iframe `src` is HTML-escaped inside double quotes where production writes a raw `&` inside
  single quotes.

So the mode is parity of the *request envelope* (endpoint, headers, height, `fullPage`) and of the
render target, not of the page body. It is not a recommendation; it is what production does today. Nothing about it is configurable, and passing `--clue-url` or
`--unit` to it is an error rather than a silently ignored flag.

**The endpoint has to be the final address.** Both Shutterbug modes post with `redirect: "manual"`,
and a 3xx answer fails the render naming the `Location` rather than being followed. That request
carries the document, and on a 307 or 308 `fetch` re-sends the body verbatim — so following a
redirect would deliver a student's work to the new address before anything could check where it
went, and the envelope would still record the endpoint that was configured. If the service moves,
point `--shutterbug-url` at the new address. The download that follows *does* follow redirects,
because it is a plain GET for a hosted image and the URL it lands on is checked instead.

**`puppeteer-full-height` renders through the same iframe pathway** production's screenshots use —
the same HTML, the same `iframe.html?unwrapped&readOnly` entry point, the same `initialValue`
message. Only two things differ: who takes the picture, and that it captures the whole document
rather than production's first 1500 pixels. The harness captures reality; production's clipping is a
production concern.

Three details of *how* it does that were established by running it against a real CLUE server, and
each one is load-bearing:

- **The page is served over loopback HTTP and navigated to**, not injected with `page.setContent`.
  `setContent` leaves the document on an opaque origin, so Chromium denies storage access to the
  embedded iframe and CLUE throws reading `localStorage` before it finishes booting — no render, no
  messages, nothing. Shutterbug serves its page from a real origin by construction, which is why
  production never meets this.
- **Readiness is measured inside the CLUE frame**, not taken from the `updateHeight` message. CLUE
  posts `document.body.scrollHeight` (`src/iframe/iframe.tsx`), and in this build the body has no
  scroll height — the content lives in `#app` — so that message reports 0 for a fully rendered
  document. The harness can measure in-frame because it drives the browser; production cannot, which
  is why an explicit "document rendered" message remains the right production-side fix.
- **The frame is sized from the document's own tile rows** before the capture. CLUE lays out to fill
  its viewport rather than its content, so at the default 500px a longer document is simply absent
  from the picture, with nothing in the DOM reporting that it was cut off. The capture is then
  checked against the measured content, which is what keeps `captureMode: "full-document"` honest.

It is a **local** backend, not an offline one. The CLUE page it loads may still pull fonts, images
or other assets from elsewhere. If offline operation ever has to be a guarantee, the backend must
intercept and reject non-localhost requests, and a test must assert it.

**A cold dev server can time out the first documents in a run.** `render` drives four pages at a
time, and the 30-second budget is *per document, covering load, readiness and the capture together*.
Against a `npm start` server that is still compiling chunks on demand, the first batch pays that
compile cost and the capture is what runs out of budget — the failure reads `capturing the iframe
did not finish within the 30000ms budget`, with a clean console and a page screenshot showing a
perfectly rendered document. Re-run the command: it re-attempts only what failed, against a server
that is now warm.

Neither the concurrency nor the per-document timeout is reachable from the command line today —
both are injectable for tests only, so re-running is the only lever. Flags for them are noted
against milestone 3 in [the plan](../../docs/plans/CLUE-371-harness-plan.md).

`npm ci` in this directory now installs puppeteer, which downloads a Chromium build on first
install. If your environment blocks that download, set `PUPPETEER_SKIP_DOWNLOAD=true` to skip it and
`PUPPETEER_EXECUTABLE_PATH` to an existing Chromium — the browser is only needed for the local
render mode, so every other command works without either.

### The rendering unit, and why it matters

Tile types are **not** registered globally. `stores.ts` builds the tile-type list from the loaded
unit's `toolbar`, `authorTools` and `tools`, and registers exactly those. A render that passes no
unit loads CLUE's `defaultUnit` (`sas`, a CMP maths unit), every tile type outside that toolbar
becomes an `Unknown` content model drawn by the placeholder component, **nothing is logged**, and
the renderer writes a perfectly valid PNG of the wrong thing.

The QA unit covers 18 of the 20 registered tile types the synthetic corpus uses; `AI` and
`ErrorTest` are missing. So `render` serves its own unit — the QA unit plus those two, with section
paths rewritten to absolute URLs — on a loopback port, and passes its URL to CLUE. It is recorded in
the render target under the stable name `harness-render` rather than that URL, because the port
changes on every run and recording it would make every stored render look stale immediately. Pass
`--unit` to use a different one.

Because CLUE logs nothing for an unregistered tile type, the local backend counts the tiles that
drew as placeholders and `render` warns when a document has any. The `Unknown` and `Placeholder`
fixtures are *supposed* to draw that way; for anything else the warning means the unit did not
register what the document uses.

### Image costs

Images are not billed by the characters of their data URL. A base64 screenshot runs to about half a
megabyte, which the text heuristic would price at ~170k input tokens — enough to refuse every run
before it started. `src/pricing.json` therefore carries an `imageTokens` block per model, and the
estimator prices image parts by the provider's own formula: flat at `detail: "low"`, otherwise a base
plus a per-tile rate after the image is scaled down to fit the long side and then the short side.

**`auto` is reserved at the high rate.** The shared builder sends `detail: "auto"` and the provider
publishes an exact formula only for explicit low and high, so the harness assumes the expensive
branch. Deliberately conservative, in the same spirit as the other ceiling caveats above. `detail`
is fixed at `"auto"` by the shared builder; detail variants arrive with milestone 3.

The accounting data that makes this possible travels *beside* the request, not inside it:

```ts
interface HarnessRequest {
  apiRequest: { model, messages, responseFormat, generationSettings };  // the only thing sent
  inputAccounting: { images: Array<{ sha256, widthPx, heightPx, detail }> };
}
```

For the Shutterbug modes the message holds nothing but a hosted URL, so width and height are
unrecoverable from the request without a network fetch — and they are needed before a single call
goes out. Keeping them beside the payload also lets the cache key cover the actual pixels: the same
URL could serve different bytes tomorrow, so `requestKeyFor` folds in the image hashes. Text-only
keys are unchanged from milestone 1, so existing cache entries keep working.

### Hosted URLs expire

Reuse-if-fresh skips the Shutterbug call entirely, so a stored URL never rotates on its own. What
happens instead is that it quietly stops resolving while the envelope still looks perfectly valid,
and the run fails partway through after money has been spent. `run` therefore checks every hosted
image **before dispatching anything**, and fails with an instruction to re-render.

The check downloads the image rather than just asking whether the URL answers. Reachability was never
the guarantee: the request key, the cache entry and the row's provenance all use the sha256 captured
when the image was rendered, so a URL that still answers 200 with *different* pixels would have the
model analyse one picture while the results recorded another. The download is bounded by the same
encoded-size limit renders use, the bytes are decoded as PNG, and the hash must match. `plan` stays
network-free and says instead that hosted images were not verified.

Regeneration is a cost event: new pixels mean new request keys and a full re-spend. `render` reports
rendered / reused / failed counts and says so.

### Render failures and limits

A failed document writes no envelope, leaves an `error.txt`, a `screenshot.png` of what the page
looked like when it failed, and the captured console output where there is any, under
`data/corpus/<name>/render-errors/<modeId>/<docId>/`. It does not stop the other documents, and the
command exits non-zero. The screenshot matters most for a visual failure, where the console is empty
and the page is half drawn. There is no retry — a render failure is a bug to look at, not a
transient. One browser for the whole run, a page per document, four at a time, pages closed in a
`finally`.

The per-document timeout (30s) is **one budget for the whole render** — load, every readiness wait,
and the capture — not one per phase. Each phase is given the time that is left.

Every mode enforces the same bounds: maximum capture height, pixel count and encoded bytes. A
document that exceeds any of them **fails** rather than being clipped, and a clipped capture is never
recorded as `captureMode: "full-document"`. The local backend checks the page before capturing; the
Shutterbug modes check the configured height before uploading and the decoded image's dimensions
after downloading, because a tall flat screenshot compresses to almost nothing and the byte limit
alone would never fire.

### What the synthetic corpus cannot show you yet

Two fixture-level problems surfaced when the corpus was first rendered for real. Both are deferred —
they are corpus changes, and editing a fixture changes its content hash, forcing a re-render and a
re-run — but they bound what an image-mode result on this corpus means.

- **Text tiles authored with `format: "markdown"` render blank.** `src/models/tiles/text/text-content.ts`
  returns `[]` for that format, behind an explicit `// TODO: figure out what to do about markdown`.
  Most fixtures use it, so the text summarizer sees full content where image mode sees an empty
  tile. `text` and `adversarial-text` render byte-identically as a result, which also means the
  adversarial fixture's whole point — that student text containing `</script>` must not break the
  render — cannot be observed through the image path. The generated HTML is still covered by unit
  tests and a snapshot.
- **An unregistered tile renders invisibly.** `empty` and `unknown` produce byte-identical PNGs, so
  image mode cannot tell an empty document from one containing an unregistered tile — even though
  the render diagnostics correctly count `unknownTiles: 1` for the latter.

### Data leaving the machine

The Shutterbug modes **upload document content to a third-party service**. Before any production
corpus is rendered through them, that has to be checked against the data agreement — this is part of
the milestone-6 gate, not something to decide in passing. The local mode sends documents nowhere
except the CLUE server you point it at.

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

An explicit run list only (no matrix expansion). `message` is `text-only` or `image-only`, `prompt`
must name an existing prompt file, and run ids must be unique. A run names the representation its
message shape uses, and only that one: a `text-only` run needs a `textVariant` and is refused if it
also sets `imageMode`; an `image-only` run needs an `imageMode` and is refused if it also sets
`textVariant`. Ignoring the spare field would produce a result table that looks fine and answers a
different question from the one the file describes.

`experiments/image-vs-text.json` runs the milestone's headline comparison — `text-default`,
`text-minimal` and `image-puppeteer` against the same prompt — from one file.

### Cache

Key = `sha256Canonical({ model, messages, responseFormat, generationSettings, imageSha256s })`,
stored at `data/cache/<first-2>/<key>.json`.

`imageSha256s` is the hash of every image file the request carries, and it is **omitted entirely**
when there are none — so text-only keys are byte-identical to the ones written before images
existed, and existing cache entries keep working. It is folded in because for a Shutterbug render
the message holds only a hosted URL, and the same URL can serve different pixels tomorrow: API
payload identity and evaluation identity are related, but they are not the same thing.

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

`run` writes to `--output`, defaulting to `data/results/<corpus>__<experiment>.jsonl` — a stable path
with no timestamp in it, naming the corpus so the same experiment run against two corpora does not
append into one file. The separator is `__` rather than `-` because both names match `[a-z0-9-]+`, so
a hyphen let corpus `a-b` + experiment `c` collide with corpus `a` + experiment `b-c`.

A relative `--output` is resolved against `scripts/ai-harness` — the same base as `--from` and
`--experiment` — and only *then* checked for containment in the data root, which is why
`--output results/x.jsonl` is refused rather than read as `data/results/x.jsonl`. Containment is
checked through symlinks, not lexically: a `data/` that is a symlink out of the repository would
otherwise pass a purely textual check while the files landed outside the `.gitignore` entry
protecting them.

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
charges one attempt's share of the reservation per attempt dispatched — so a request that burns all
three attempts is charged the **whole** reservation, not a third of it. A guess in the honest
direction rather than a known figure. Both are accepted for a tool whose runs cost cents: the synthetic corpus plans at about
$0.11. If the harness ever runs matrices costing real money, replace the heuristic with a tokenizer
before trusting the ceiling to the last cent.

Prices live in `src/pricing.json` with an `effectiveDate`. Check them when they look stale;
API-reported usage is authoritative for final numbers.

### Results and reports

Result rows are a discriminated union on `status` (`success`, `refusal`, `error`, `skipped`), all
sharing the same identifying fields. `skipped` ships now but is unused: skip-empty *execution*
arrives in milestone 3. `report` handles all four statuses exhaustively and writes
`<results-basename>.summary.json` next to the results file — named after it, because a single
`summary.json` per directory meant every experiment in `data/results/` shared one path and reporting
on one silently overwrote another's. Groups are per run configuration × message shape × modality,
plus a per-shape aggregate across runs and an overall row.

The `overridden` column counts documents grouped under a human's `modalityOverride` rather than the
classifier's answer. Rows carry both `modality` (the effective one, used for grouping) and
`computedModality`, so a hand-set override cannot silently regroup a document with no trace that a
person rather than the classifier put it there.

**Result rows are `schemaVersion: 2`.** Milestone 1 recorded a required `textVariant` string, which
an image-only row has nothing honest to put in. It is replaced by a `representation` descriptor that
both kinds populate — the text side carries the variant and its version, the image side carries the
mode, backend, version, whole render target and image hashes, because that is what a screenshot's
provenance is. Version-1 rows are **refused** with an instruction to re-run into a fresh `--output`
rather than being silently mis-read; the response cache means unchanged requests are not paid for
twice. This is also the extension point milestone 3's mixed rows need.

The report's `img tok est` column is the harness's pre-flight image-token estimate, shown beside the
`tok in` the API actually billed. It is `-` for a text group rather than `0`, so the two cases cannot
be confused.

Every on-disk format carries a `schemaVersion`, is described as a TypeScript type in
[`src/schemas.ts`](src/schemas.ts), and is validated on every read; a bad file fails with a message
naming the file and the field. The versions are not all the same number:

| Format | Version |
|---|---|
| Result rows (`data/results/*.jsonl`) | **2** — see above |
| Corpus manifest, text representation envelopes, image envelopes | 1 |
| Prompt files, experiment files, report summaries, cache entries | 1 |

### Version lockstep

`shared/` has its own pinned `openai` and `zod` so the harness can import
`shared/ai-analysis-messages.ts` in place, while the deployed function resolves both from
`functions-v2/node_modules`. Matching behaviour requires identical versions, so
`test/versions.test.ts` reads all three lockfiles and fails if they drift. Use `npm ci`, and commit
lockfile changes.

## Layout

```
harness.ts                 CLI: argv parsing and command dispatch
src/schemas.ts             types, validators, canonicalJson / sha256Canonical
src/corpus.ts              corpus layout, import, manifest read/write
src/capability.ts          tile capability registry, document classification
src/represent-text.ts      text representation variants
src/represent-image.ts     image envelopes: paths, writing, freshness (files included)
src/png.ts                 PNG header reader (dimensions + "is this really a PNG?")
src/files.ts               atomic writes, path containment, JSON reads, git
src/backends/types.ts      what a render backend is, and the limits every one is held to
src/backends/index.ts      the three named render modes
src/backends/render-html.ts  the render page, with safe interpolation — shared by all modes
src/backends/puppeteer.ts  local capture through CLUE's iframe pathway
src/backends/shutterbug.ts the two hosted modes and the network contract
src/backends/render-unit.ts  the harness's rendering unit and the server that hands it over
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

## Findings for elsewhere

Things this milestone surfaced that are not the harness's to fix.

- **`updateHeight` reports 0 on current CLUE code, and production will inherit that.** Production
  (`functions-v2/src/on-analysis-document-pending.ts`) sizes its screenshot iframe from the
  `updateHeight` message, which carries `document.body.scrollHeight`. On the current codebase that is
  **0** — the content lives inside `#app` and the body has no scroll height — which is what stopped
  this milestone's local render mode producing anything at all.

  Production is not broken today: it renders against the deployed
  `branch/shutterbug-support` build, and that build still reports real heights. Measured directly
  against the deployment, it posts `updateHeight: 650` then `190`, and the iframe is sized to 190px,
  which is the behaviour the code intends. A hand-verified parity render came back correct (see
  "Verified against a real API call…" below).

  The risk is therefore latent rather than live: **the first time production's render target is
  rebuilt from current CLUE code, every screenshot collapses to a 0px iframe.** That makes it worth
  fixing before the branch is refreshed, not after — and an explicit "document rendered" message
  would remove the dependency on `scrollHeight` altogether.
- **The `generateHtml()` script injection exists in production.** That same file interpolates
  `JSON.stringify(content)` into a `<script>` element with real student work. Text containing
  `</script>` can inject markup into the render page. The harness fixed its own copy
  (`src/backends/render-html.ts`, with a snapshot test); production needs a small PR of its own, and
  it becomes more pressing with the text+image-always rollout.
- **`scripts/shutterbug.ts` is not production parity**, despite the harness plan describing it that
  way. It posts `height: 500, fullPage: true` against production's `height: 1500` and no `fullPage`.

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
    is deterministic and conservative in the right direction. Image parts are excluded from that
    count entirely and priced by the image formula instead.
11. **`estimateTokensForText` is not a flat `length / 3`.** The spec prescribes that; the
    implementation counts ASCII at three characters per token but every non-ASCII character as a
    whole token, because CJK text and emoji routinely cost about one token each and dividing them by
    three would under-reserve. This changes the arithmetic `--max-cost` depends on, so it is called
    out rather than left as an implementation detail.
12. **The default output path names the corpus.** The spec says
    `data/results/<experiment>.jsonl`; the implementation writes
    `data/results/<corpus>__<experiment>.jsonl`, so the same experiment run against two corpora does
    not append into one file — which `report` would then refuse for mixing corpora.

Milestone 2 (against
[docs/plans/CLUE-371-harness-implementation-2.md](../../docs/plans/CLUE-371-harness-implementation-2.md)):

13. **Image envelopes are filed under the *mode* id, not the backend id.** The spec says
    `representations/image-<backendId>/`, but `shutterbug-production-current` and
    `shutterbug-parameterized` share the backend id `shutterbug` and would overwrite each other,
    each looking stale to the other — so you could never hold a parity render and a parameterized
    render side by side, which is exactly the comparison this milestone wants. The envelope records
    both `modeId` and `backendId`; the directory uses `modeId`.
14. **`run` and `plan` do not compare the render target; `render` does.** The spec applies the full
    freshness check everywhere. Splitting it avoids duplicating `--clue-url` / `--unit` /
    `--shutterbug-url` onto `plan` and `run` purely so they can reconstruct a target — and the
    distinction is real: which CLUE build a picture was taken against decides whether `render`
    should take it again, but it does not make the stored pixels the wrong pixels to send. `run`
    still checks the document hash, mode, backend, backend version and every file-level property,
    and the row records the whole render target either way, so provenance is kept.
15. **An envelope with zero images reports "it records no images", not a milestone-3 error.** The
    spec asks for the milestone-3 message on both zero and many. Zero images is a damaged envelope
    rather than an unbuilt feature, and pointing the reader at milestone 3 would misdescribe it.
    Two or more images does say milestone 3. Both fail, and the first image is never selected.
16. **The render target's `unit` is a stable identifier, not the URL CLUE fetches.** The harness's
    own rendering unit is served on an ephemeral loopback port; recording that URL would make every
    stored render look stale the moment the server restarted. It is recorded as `harness-render`,
    with the served URL passed to CLUE separately.
17. **`buildImageRequest` derives `detail` from the message it builds** rather than accepting one
    from the caller, and refuses a caller-supplied `detail` outright. The caller knows facts about
    the file; the builder knows what it just sent. This also means the cost model follows the shared
    builder if its `detail` ever changes, instead of confidently pricing the old value.
18. **Render diagnostics are a DOM count, not a console check.** CLUE logs nothing when a tile type
    is not registered — it substitutes an `Unknown` content model drawn by the placeholder
    component. The local backend therefore counts tiles inside the CLUE frame (`.tool-tile`, with
    `.placeholder-tile` alongside it for an unknown one), which is the only way a render can notice
    it drew the wrong thing.
19. **The readiness protocol does not wait for `updateHeight`.** The spec prescribes waiting for at
    least one valid height message and then for the height to hold still. CLUE posts
    `document.body.scrollHeight`, which is 0 in this build for a fully rendered document, so that
    wait can never be satisfied — it is why backend version 1 rendered nothing. Readiness is measured
    inside the frame instead: content present, tile count and height unchanged across polls, fonts
    loaded, held for the same stability interval.
20. **The fatal-error set is narrower than "any console error".** The spec lists page errors,
    unhandled rejections, failed dynamic imports, and console errors naming an unregistered tile
    type. A real CLUE server logs React key warnings at *error* level and probes for an optional
    `teacher-guide/content.json` that legitimately 404s, so failing on every console error or failed
    request failed every document. Page errors and failed script loads are fatal; everything else is
    recorded in the evidence file without failing the render. The unregistered-tile case is caught by
    the DOM count above, since nothing is logged for it.
21. **"Not clipped" is guaranteed by construction, not by an overflow check.** The frame is sized
    from the document's measured tile rows and the capture is then checked to cover them. A DOM
    overflow signal would be the obvious check and is not trustworthy here: `.document-content`
    reports zero overflow at every frame height when measured directly, yet the same selector read
    during a settle reports a constant ~75px for documents whose content is a third of the frame.
22. **The render page is served over loopback HTTP and navigated to, not injected with
    `page.setContent`.** The spec prescribes `setContent`. That is why version 1 rendered nothing:
    it leaves the document on an opaque origin, so Chromium denies storage access to the embedded
    iframe and CLUE throws reading `localStorage` before it finishes booting. The reasoning is under
    "`puppeteer-full-height` renders through the same iframe pathway" above; it is repeated here
    because a spec-versus-reality conflict belongs in this list.
23. **Render errors are filed under `<modeId>`, not `<backendId>`.** The spec says
    `render-errors/<backendId>/<docId>/`. For the same reason as entry 13 — two Shutterbug modes
    share one backend id — evidence from a parity render would overwrite evidence from a
    parameterized one.
24. **`render` accepts a `--capture-height` flag.** The spec's CLI list does not include it. The
    parameterized Shutterbug mode has to be able to set the height it clips at, or it is not
    parameterized; the local mode refuses the flag rather than silently dropping it.

### Verified against a real API call, a real browser, a real service?

All of it, by hand. A local render of all 25 fixtures against a real dev server and a real headless Chromium,
followed by a real `image-vs-text` run:

```
run    75 calls: 50 from cache, 25 API calls. Spent $0.0539 against a $0.3282 worst case.
```

- **The image cost model checks out.** `plan` predicted 376,843 image tokens; the API billed 382,643
  prompt tokens across those rows, so the estimate accounts for 98.5% of them, the rest being prompt
  text. The median actual, 14,399, is exactly the formula for a 944×500 capture: 2833 + 2 tiles ×
  5667, plus prompt.
- **The cache did real work.** Every text request except two was served from milestone 1's cache;
  the two were both `adversarial-text`, the fixture this milestone added.
- **Observation, not a conclusion.** Image-only returned `unknown` for 21 of 25 documents against
  text-default's 12; on visual-only documents specifically, 15/17 against 9/17. That is the opposite
  of the hypothesis, and it is heavily confounded: these are one- and two-tile synthetic documents,
  several render blank (see "What the synthetic corpus cannot show you yet"), and two pairs render
  byte-identically. The model is being shown very little. **This establishes that the pipeline works
  and what it costs — not that image mode is worse.** That comparison needs milestone 5's rubric and
  a corpus of real documents.

**The parity mode was verified by hand against the real service**, with the `drawing` fixture:

```
POST https://api.concord.org/shutterbug-production
  -> https://ccshutterbug.s3.us-east-1.amazonaws.com/1787003194685-381980.png
```

The envelope recorded `clueUrl: ".../branch/shutterbug-support"`, `unit: "mods"`,
`captureMode: "fixed-height"`, `captureHeightPx: 1500` — the last two being the honest record that
production clips. The hosted image matched the locally downloaded copy exactly, and showed the
document as it should look: the tile-title chip, the outlined rectangle, and the blue-filled oval
beside it. Nothing was collapsed or blank.

Everything else, including the full mocked end-to-end path through an `image-only` run, is covered
by `npm test`.
