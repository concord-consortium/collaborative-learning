# CLUE AI evaluation harness

A checked-in tool that runs (representation × prompt × message-shape) experiments against a corpus of
CLUE documents and reports quality inputs plus token and cost numbers — so text-only vs. image-only
vs. mixed-mode claims are backed by measurements instead of intuition.

This is **milestone 3** of [CLUE-371](../../docs/plans/CLUE-371-harness-plan.md). Milestone 1 built
the shared message builders, the harness skeleton, a synthetic corpus, text-only runs, the response
cache, the spend ceiling, and reports as data. Milestone 2 added the other production representation
— the screenshot — so image-only baselines could run against the same corpus. Milestone 3 adds the
message the whole question is about, text **and** picture together, plus the dimensions an
experiment needs to turn around it: image detail, per-tile and visual-tiles-only image sets, the
extras settings, two new text variants, and skip-empty execution. The HTML review report
(milestone 4), rubric scoring (milestone 5) and the production corpus pull (milestone 6) are not
here yet.

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
npx tsx harness.ts render    --corpus synthetic-corpus --mode <mode> \
                             [--clue-url <url>] [--unit <unit>] [--shutterbug-url <url>] \
                             [--capture-height <px>] [--refresh] \
                             [--concurrency <n>] [--timeout-ms <n>]
npx tsx harness.ts plan      --corpus synthetic-corpus --experiment experiments/image-vs-text.json
npx tsx harness.ts run       --corpus synthetic-corpus --experiment experiments/text-baselines.json \
                             --max-cost 0.50 [--output <file>] [--no-cache | --refresh-cache]
npx tsx harness.ts report    --results data/results/synthetic-corpus__text-baselines.jsonl
```

Flags are plain `--name value` pairs. An unknown flag is an error, not a warning.

`plan` on the committed synthetic corpus projects a worst case of about **$0.03** for both text
baselines — 14 calls, because skip-empty sends a text run only the documents that carry
student-authored text (7 of 26), and records the other 19 as skipped rows. Image runs send every
document that has any content at all, so they are both larger and dominated by image tokens; run
`plan` after rendering to see the figure for a particular mode and image set, since a per-tile set
multiplies the count. The reservation assumes every retry is used.

The recorded run further down is a real `mixed-vs-baselines` run against this corpus as it now
stands.

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

| Variant | What it sends |
|---|---|
| `default` | `documentSummarizer(content, {})` — what production produces. |
| `minimal` | No boilerplate, headers or row/column structure: the text content and nothing else. |
| `no-dataset-tables` | `default`, with each data set's *case data* left out. The heading, attributes table, formulas and case count stay, so the shape of the data is still described. A large table can be most of a document's summary, and whether a model needs the rows to categorize a design is worth measuring rather than assuming. |
| `drawing-text` | `default`, with drawings **described** instead of merely mentioned: each object's type, position and size, and any text object's own text. The default handler says "This tile contains a drawing" and stops, so a text run otherwise learns nothing about what was drawn — including text a student typed *inside* a drawing, which no other text variant carries. |

`drawing-text` is a measurement prototype, not a good description: it reports geometry and does not
interpret it, because interpreting the picture is what the model is being measured on. Beating it is
the point, and a new variant is how someone shows they have.

**A text run reaches it only on a document that carries student text elsewhere**, which today means
the geometry half is barely exercised. Skip-empty asks the classifier whether any tile holds
student-authored text, and a Drawing tile counts only when it has a text object with something in it
(`drawingTileHasText` in `src/capability.ts`) — so the `drawing` fixture, two shapes and no text, is
skipped by a text-only run before the variant is consulted. Of the two fixtures with Drawing tiles,
only `mixed` is sent, and that one has a Text tile as well. The variant's own summary of a drawing
*is* student content, so the skip is asking the wrong question for this combination; the decision is
made from the classifier alone and knows nothing about which variant is about to run.

Two further ways to shrink a data set — sending a fixed sample of cases, and sending aggregate
statistics — are named in the plan and not built. Both are variants of their own when someone wants
to measure them.

The `svg-drawings` variant (`documentSummarizerWithDrawings`) is **not** included — it imports
`src/plugins/drawing`, which imports `.svg` assets that only a bundler can load, so it does not run
under `tsx` without build gymnastics. `drawing-text` exists because that limitation is not going
away soon.

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

`images` was an array from the start, which is what made per-tile capture additive. **Which** of an
envelope's images a run sends is chosen by its `imageSet`, never inferred: a `full-document` run
takes the one full-document picture and refuses an envelope that has none, rather than sending
whatever happened to be first.

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
| `puppeteer-per-tile` | local | `--clue-url`, default `http://localhost:8080` | harness's own | one image per top-level tile |
| `shutterbug-accurate-height` | yes | `--clue-url`, default production's branch | `--unit`, default `mods` | each document's **own measured height** — needs a `puppeteer-full-height` render of the same corpus first |

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
time by default, and the 30-second budget is *per document, covering load, readiness and the capture
together*. Against a `npm start` server that is still compiling chunks on demand, the first batch
pays that compile cost and the capture is what runs out of budget — the failure reads `capturing the
iframe did not finish within the 30000ms budget`, with a clean console and a page screenshot showing
a perfectly rendered document.

Re-running is usually enough: it re-attempts only what failed, against a server that is now warm.
When it is not, `--concurrency 1` and `--timeout-ms 60000` turn the two knobs directly. Both are
validated as positive whole numbers, and both are named in the run's own log line, so a run that
needed them says so in its output rather than only in the shell history of whoever typed it.

`--timeout-ms` belongs to the local modes only, and the Shutterbug modes refuse it rather than drop
it. A per-document budget is a thing the local backend has — one deadline covering load, readiness
and capture — and a hosted mode has no equivalent: it bounds its request and its download separately,
with retries around them, so there is nothing for a whole-document budget to bound. Their log line
names the concurrency alone, rather than a limit nothing enforces. `--concurrency` works everywhere.

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
defaults to the `"auto"` the shared builder has always sent; a run asks for `low` or `high` with its
`detail` setting, and the builder remains the only place a detail is attached to a message.

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

An explicit run list only (no matrix expansion). `prompt` must name an existing prompt file, and run
ids must be unique. `message` is one of:

| Shape | Names | Sends |
|---|---|---|
| `text-only` | `textVariant` | The summary, plus its related-summary parts. |
| `image-only` | `imageMode` | The pictures. |
| `mixed` | **both** | The summary *and* the pictures, in one request. |

A run may only carry the dimensions its shape can use, and a spare one is refused rather than
ignored — ignoring it produces a result table that looks fine and answers a different question from
the one the file describes:

| Field | Valid on | Default | Values |
|---|---|---|---|
| `detail` | image-carrying runs | the builder's `auto` | `low`, `high` |
| `imageSet` | image-carrying runs | `full-document` | `per-tile`, `visual-tiles-only` |
| `extras` | text-carrying runs | `all` | `none` |

`extras` is what a run puts in the related-summary parts. `all` — the default — sends every related
summary the manifest carries, each one that document's own, which is what the harness has always
sent; an experiment file written before this dimension existed therefore keeps its meaning *and its
request key*. `none` sends the parts empty. A setting that sends *some* of them would belong here
too, and the names leave room for it.

**The open question is whether they help at all**, and neither setting answers it on its own. The
feature has never run for real: production's `summaries` collection holds one document, so the
search that feeds it has always returned nothing (spike finding 6a). If `all` beats `none` on a
corpus that has them, the next question is whether that is the *content* of the
related summaries or simply more text in the prompt — and answering that needs a third setting whose
extras carry the same volume and no useful information. That is a control worth designing for
CLUE-607's experiments rather than inheriting.

A setting reproducing CLUE-630's `findRelatedSummaries` bug — every entry given the analyzed
document's own summary — was here and has been removed. It was built to keep a before-and-after
honest, but there is no meaningful "before": the bug never fired in production, for the same reason
the feature never ran. `master` now guards the fix with a unit test, which is the right tool for
"do not reintroduce this". As a content control it was also confounded, varying volume as well as
content. The 642-token figure it produced is kept in the recorded run below.

`experiments/mixed-vs-baselines.json` runs this milestone's headline comparison from one file: ten
runs over the same corpus. Text, image and mixed are the comparison itself; the other seven turn one
dimension each around it — detail-low, per-tile and visual-tiles-only on the image side, the two
extras settings and the two new text variants on the text side. Every dimension this milestone adds
has a run, so none of them ships only exercised by a unit test.

`text-extras-all` is deliberately a duplicate of `text-default`: `extras` defaults to `all`, so the
two build the same request and the second one costs nothing. It is there so the default is measured
rather than assumed — if it ever stopped matching, the run would say so.
`experiments/image-vs-text.json` is milestone 2's narrower comparison, kept as it was.

### Which documents a run declines to send

A run does not send every document, and it says so rather than leaving gaps. The decision comes from
classifying the document's own content — never from a `modalityOverride`, which is a reporting
judgement about how to group a result, not a claim about what the document contains.

- **Any shape** skips a document classified `empty`: no tile carries text, and none needs a picture.
- **`text-only`** skips a document with no student-authored text — the summary would carry no
  student content, which is the thing a text run measures. On the synthetic corpus that is most of
  it: 7 of 26 documents carry student text.
- **`mixed`** sends a document with no student text *without* its summary and related summaries, and
  records `textPartOmitted` on the row. The picture still has something to say, so skipping it would
  throw away the answer this shape exists to get.
- **`visual-tiles-only`** skips a document where no captured tile is one the classification marks as
  needing a picture.

Every skipped pair becomes a `skipped` result row carrying its reasons and the content hash the
decision was made from, written before anything is dispatched. A document that simply did not appear
in the results would be indistinguishable from a bug. On a rerun, an unchanged document keeps its
existing skipped row; an edited one is decided again.

Worth knowing: a mixed message with its text half dropped is byte-for-byte an image-only message, so
those rows share the image-only run's request key and are served from the cache rather than paid for
twice.

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
is written by skip-empty execution. `report` handles all four statuses exhaustively and writes
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
twice. It is also the extension point the `mixed` descriptor kind uses.

The report's `img tok est` column is the harness's pre-flight image-token estimate, shown beside the
`tok in` the API actually billed. It is `-` for a text group rather than `0`, so the two cases cannot
be confused; a mixed group carries it the same way an image group does.

The `no text` column counts the mixed rows that went without their text half. Those rows carry half
the input a mixed row usually does, so a reader comparing mixed against text-only needs the count
before drawing a conclusion. Like `overridden`, it reads `-` where it never happened rather than
`0`.

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
src/backends/index.ts      the named render modes
src/backends/render-html.ts  the render page, with safe interpolation — shared by all modes
src/backends/puppeteer.ts  local capture through CLUE's iframe pathway
src/backends/shutterbug.ts the three hosted modes and the network contract
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

Where the implementation departs from its specification, and why. Each milestone's entries are
listed under the spec they depart from, and entries are never renumbered or removed — a deviation
that a later milestone changed is rewritten in place, so a number cited elsewhere keeps pointing at
the same subject.

Milestone 1 (against
[docs/plans/CLUE-371-harness-implementation-1.md](../../docs/plans/CLUE-371-harness-implementation-1.md)):

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
15. **An envelope with zero images reports "it records no images" rather than a selection error.**
    The milestone-2 spec asked for one message on both zero and many. Zero images is a damaged
    envelope; many is a per-tile render meeting a run that asked for a page. Milestone 3 replaced
    the "many" half with `imageSet` selection, and this entry now covers only the damaged case.
16. **The render target's `unit` is a stable identifier, not the URL CLUE fetches.** The harness's
    own rendering unit is served on an ephemeral loopback port; recording that URL would make every
    stored render look stale the moment the server restarted. It is recorded as `harness-render`,
    with the served URL passed to CLUE separately.
17. **A run may ask for an image `detail`; the accounting still records the one actually sent.**
    Milestone 2 had `buildImageRequest` derive `detail` from the message it built and refuse a
    caller-supplied one. Milestone 3's `image-detail-low` run has to be able to ask, so
    `buildImageRequest` and `buildMixedRequest` now take a `detail` and hand it to the shared
    builder. What did not change is where the cost model reads it back from: `accountingForImages`
    re-reads every `image_url` part out of the finished message, and a `detail` passed in the
    accounting is refused outright. The caller states facts about the file; the message states what
    was asked of the provider. So a run can choose a detail, and nothing can describe an image as
    having cost something other than what was sent — including if the shared builder's own default
    ever changes.
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
    the DOM count above, since nothing is logged for it. Milestone 3 added a third fatal condition,
    and it is also not a console check: if CLUE draws its own `.document-error` page instead of the
    document, the render fails before the capture. CLUE logs nothing useful there either — it draws a
    screen — and without the check the harness had been storing a picture of that error screen as a
    valid render of the `graph` fixture since milestone 2.
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

Milestone 3 (against
[docs/plans/CLUE-371-harness-implementation-3.md](../../docs/plans/CLUE-371-harness-implementation-3.md)):

25. **`shutterbug-accurate-height` is a two-step render.** The spec says to take each document's
    height from its `puppeteer-full-height` envelope and refuse when there is not one, which is what
    it does — but that makes it the only mode that depends on another mode having run first, against
    the same corpus, recently enough to still be fresh. `render` reads every document's height
    before posting anything and refuses the whole corpus at once, naming the documents and the fix:
    a half-rendered corpus plus a bill for the part that worked is the outcome worth avoiding. The
    mode table carries the dependency.
26. **Result rows stay `schemaVersion: 2`.** The milestone-3 spec's item 23 asks for the decision
    to be recorded either way, which is why this is here at all. The three statuses that send a
    request are unchanged on disk; `skipped` rows are new in practice, since
    nothing ever wrote one, and the fields this milestone adds (`textPartOmitted`,
    `representationWarnings`, `imageSet`, the `mixed` descriptor kind) are all additive. A version
    bump would invalidate every milestone-2 results file to describe rows those files cannot
    contain.
27. **A skipped row carries no `representation`.** The spec has skipped rows recording "the
    representation descriptor or content hash it was decided from"; they record the hash. Nothing
    was represented, and a placeholder descriptor would put a variant or a render mode in the
    results for a request that never existed. `decidedFromContentSha256` is what resume compares.
28. **The per-tile capture photographs top-level tiles only.** Classification walks into Question
    tiles, so a visual tile nested in one has a classification entry and no picture of its own — it
    is drawn inside its parent's. `visual-tiles-only` matches on the images that exist and records
    the difference in the row's `representationWarnings`, per the spec's own instruction, rather
    than failing.
29. **A corpus can mark a document as expected not to render.** The spec has no such notion: a
    document either renders or the render fails. But `error-test` exists precisely to be
    unrenderable — it is how the local backend's failure path gets exercised — so every render of
    the example corpus reported a failure that was really the fixture doing its job, and a genuine
    failure looked no different. `expectedRenderFailure` on a manifest entry carries the reason.
    `render` counts those documents apart from real failures so its exit code keeps meaning
    something, and writes their evidence either way, since a document expected to fail one way and
    failing another is exactly what the screenshot is for. A document that renders despite the
    marker gets a warning telling you to clear it: a stale expectation is worse than none, because
    it would go on hiding a real failure the day that document breaks again. Example corpora seed
    the marker from `expectations.json`; a value already in the manifest wins, because a human put
    it there on purpose.
30. **A per-tile render of a document with no tiles is neither a success nor a failure.** The
    `empty` fixture declares no tiles, so a per-tile capture has nothing to photograph. Calling it a
    failure would make a correct corpus exit non-zero; writing an envelope with zero images would
    make it indistinguishable from a damaged one, which entry 15 exists to keep separate. `render`
    reports it as "nothing to capture" and writes no envelope. Nothing downstream needs the
    envelope, because skip-empty declines to send a contentless document in any case.

### Verified against a real API call, a real browser, a real service?

All of it, by hand. The 26 fixtures were rendered against a real dev server and a real headless
Chromium in both capture modes — 25 full-height envelopes and 24 per-tile ones, the missing entries
being `error-test`, which is marked `expectedRenderFailure`, and `empty`, which has no tile for a
per-tile capture to photograph. Then a real `mixed-vs-baselines` run, assembled over several
sittings as review turned up fixes:

```
run     260 row(s): 146 sent, 114 skipped.
        10 run(s) × 26 document(s) = 260 pair(s).
report  260 current, 0 superseded.
```

Three things were repaired between the first run and this one, and each is worth knowing before
reading the numbers. A per-tile capture was photographing tiles nested inside a Question, so
`question` produced three overlapping pictures instead of one. The mixed prompt told the model it
had been given a summary on documents where the summary was dropped. And `drawing-text` had no
experiment run at all.

Two of those cost money to correct and one did not. Re-rendering changed 18 rows, of which only
`question` changed because of the fix — the other 15 are `data-card`, `dataflow` and `graph`, which
do not render deterministically and produce different pixels every time. Worth knowing before
reaching for `--refresh`: new pixels are new request keys, and a re-spend on those documents
whatever prompted the re-render.

Adding the two variant runs edited the experiment file, and `experimentSha256` is part of resume
identity — deliberately, so an edited experiment cannot silently resume rows built under the old
definition. Every row therefore rebuilt, `report` refused a file holding two definitions, and
recovering meant re-running into a clean one. That cost nothing: the cache is keyed on the request
rather than the experiment, so all 153 rows came straight back out of it. The whole session's real
spend was about $0.25.

- **The image cost model checks out.** Estimated image tokens account for 98.6% of the prompt tokens
  the API actually billed in `image-puppeteer` (371,177 of 376,513), 98.9% in `image-per-tile`
  (467,511 of 472,847) and 98.4% in `image-visual-tiles-only`; the remainder is prompt text. The
  median actual, 14,399, is exactly the formula for a 944×500 capture: 2833 + 2 tiles × 5667, plus
  prompt. `image-detail-low` is the loosest at 92.4%, which is arithmetic rather than error: a
  low-detail image is a flat 2833 tokens, so the fixed prompt text is a much larger share of a much
  smaller total.
- **Every text dimension is priced, over the same 7 documents and the same prompt.** Named by run,
  because two dimensions are in play and the settings alone would not say which: `text-extras-none`
  sends 3,725 prompt tokens; `text-no-dataset-tables` 3,823; `text-default` and `text-extras-all`
  3,895; `text-drawing-text` 3,958. This run also carried an `extras-production-current` setting,
  since removed, which reproduced CLUE-630's bug and sent 4,537 — a 642-token premium for repeating the analyzed
  document's own summary in place of each related one. Kept here because it prices what redundant
  extras cost, which is the shape of the control CLUE-607 will want.
- **`drawing-text` is the only run that ever answered `form`.** Across all 146 rows the categories
  are 90 `unknown`, 41 `function`, 14 `user` and a single `form` — the `drawing` fixture, two shapes
  and no text, which every other run either skips or calls `unknown`. The model gave "drawing with 2
  objects", "rectangle and ellipse", "specified positions and sizes" as its indicators. One document
  is not evidence that describing geometry beats photographing it, but it is the variant doing
  exactly what it was built to do, on the document it was built for.
- **Per-tile cost scales with tile count, not document size.** Its median document billed the same
  14,399 prompt tokens as full-document, but `tall` — ten tiles, ten images — billed 141,902. The
  per-document average hides this; budget for the widest document, not the typical one. Tile count
  means *top-level* tiles: `question` draws two more inside itself, and photographing those as well
  gave one document three overlapping pictures of the same content until the selector was fixed.
- **The cache is keyed on the whole request, prompt included.** A mixed message whose text half is
  dropped is structurally identical to an image-only one, but this experiment gives the mixed run
  its own `categorize-design-mixed` prompt, so none of its 16 text-free rows matched the image-only
  cache. Two runs share cache entries only when they share the prompt as well as the payload —
  which is why `text-extras-all` matched `text-default` on all 7 rows and cost nothing.
- **Fixing the mixed prompt changed no answers.** It had told the model it was given "a written
  summary and a picture", on 16 of 23 rows where the summary was dropped. Rewording it to promise a
  summary only when there is one moved **0 of 23** categories. The fidelity problem was real and its
  measured effect here was nil; both halves are worth stating, because a fix reported without its
  measurement is just a claim.
- **Observation, not a conclusion.** Skip-empty means text and image runs no longer send the same
  documents, so the only fair comparison is the 7 documents both send. There, mixed reproduced
  text-only's category on all 7, while image-only lost 4 of them to `unknown` — the picture alone
  was worse, and adding the picture to the text cost nothing in agreement. Across everything each
  run did send, `unknown` came back 17/23 for image-only, 16/23 for mixed, 19/23 for per-tile, 1/7
  for text and 1/8 for `drawing-text`. This is heavily confounded: these are one- and two-tile
  synthetic documents, several render nearly blank (see "What the synthetic corpus cannot show you
  yet"), and n=7 on the paired comparison. **This establishes that the pipeline works and what it
  costs — not that any representation is better.** That comparison needs milestone 5's rubric and a
  corpus of real documents.

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
