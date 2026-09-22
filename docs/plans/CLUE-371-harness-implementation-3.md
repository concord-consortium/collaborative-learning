# CLUE-371 Harness — Milestone 3 Implementation

*Historical work order, written before implementation and kept as ordered; the git history and the milestone PRs record what was actually built.*

A work order for implementing milestone 3 of the
[harness plan](./CLUE-371-harness-plan.md): **mixed-mode messages and the variant dimensions**
(extras, image detail, image sets, accurate height, two new text variants), plus skip-empty
execution and the two operational gaps carried from milestone 2. Written against the as-built state
of `CLUE-371-harness-m3` after the milestone-2 review follow-up commits — read
`scripts/ai-harness/README.md` **first**, including its DEVIATIONS section; it is the accurate map
of what exists, and several things this milestone extends (multi-image envelopes, the
`RepresentationDescriptor`, the `skipped` result status, `ImagePurpose: "tile"`) were built in
earlier milestones precisely so this one is additive.

Branch: this work continues on `CLUE-371-harness-m3` (already cut from the updated
`CLUE-371-harness-m2` and carrying the review follow-ups as its opening commits). Its PR targets
`CLUE-371-harness-m2` and is retargeted to `CLUE-371` when the m2 PR merges — the stacked-branch
process recorded in the harness plan's branch-strategy section.

## Why this shape

Milestone 2 ended with both single-representation baselines runnable and honest. Milestone 3 builds
the thing the story is actually about — the mixed text+image message — and the knobs the experiments
need to turn around it. The spike (finding/decision list in
[CLUE-371-spike.md](./CLUE-371-spike.md)) already made the two design calls that shape this
milestone: the mixed builder **grows out of `buildSummaryMessages`** (prompt + summary + related
summaries) with the image part added, not out of `buildImageMessages`; and mixed mode sends
text+image always, with skip-empty as the recorded exception, not a silent one.

## Three traps to respect

1. **`shared/` is production code.** `buildSummaryMessages` and `buildImageMessages` are called by
   the deployed functions; `documentSummarizer` is the deployed summarizer. Every change there must
   leave the output for existing call shapes **byte-identical** — the existing parity snapshots and
   the `prompt.test.ts` hash pin are the tripwires, and new options must default to today's
   behavior. New capability (`buildMixedMessages`, a `detail` option, multi-image support, new
   summarizer options) is added; existing behavior is never edited in passing. Production adopting
   any of it is a separate, later PR — not this milestone.
2. **Request identity is the cache and the resume key.** New experiment dimensions (extras, detail,
   image set) change the built messages, so they change `requestKey` naturally — do not add any of
   them to `requestKeyFor` separately. What must NOT change is the key for a request that is
   configured exactly as before: an existing text-only or image-only run must produce the same
   `requestKey` on this branch as on m2, or every cache entry and resume row silently invalidates.
   A test should pin one of each.
3. **Skip decisions are results, not absences.** The `skipped` result-row status (`requestKey:
   null`, `skipReasons`) has existed since milestone 1 and nothing writes it yet. Every document a
   run declines to send must land as one of these rows, with reasons a reader can act on. A skipped
   document that simply doesn't appear in the results file is indistinguishable from a bug.

## Work items

### A. Shared builders (`shared/ai-analysis-messages.ts`) — production-adjacent

1. **`buildMixedMessages(aiPrompt, summary, relatedSummaries, images)`** — new export. Structure:
   exactly what `buildSummaryMessages` produces (same system message, same main-prompt part, same
   summary part, same related-summary parts in the same order and wording), with one `image_url`
   content part appended per image. `images` is an array of `{ url, detail? }`; an absent `detail`
   sends `"auto"`, matching `buildImageMessages`. `summary` may be omitted/null for the no-text
   skip case, in which case the summary part (and the related-summary parts — extras are a
   text-path feature) are absent and the image parts remain. Do not invent new prose for the image
   part; the message contains the prompt parts and the images, nothing extra.
2. **`detail` reaches `buildImageMessages`** via a new optional final options argument
   (`{ detail?: "low" | "high" | "auto" }`, default `"auto"`). Existing call sites (production's,
   and the harness's image-only path) pass nothing and must produce byte-identical messages — the
   existing image parity snapshot must not change.
3. **Multi-image support in `buildImageMessages`**: accept `string | Array<{url, detail?}>` for the
   image argument (or an equivalent additive shape — keep the single-string call byte-identical).
   One `image_url` part per image, in array order.
4. No dependency changes. `shared/package.json` stays pinned; the three-way lockfile lockstep test
   must still pass untouched.

### B. Harness message layer (`src/messages.ts`)

5. **`buildMixedRequest`** — the mixed analogue of the two existing builders: takes the markdown
   (or `null` for the no-text case), the related summaries actually being sent, and an array of
   image inputs (`{ imageUrl, accounting }`), calls `buildMixedMessages`, and returns a
   `HarnessRequest` whose `inputAccounting.images` matches the message's image parts one-for-one.
6. **Generalize the detail read-back.** `detailOfSingleImage` becomes (or is joined by)
   `detailsOfImages(messages)`: returns the `detail` of every image part in order, still refusing
   an unrecognized value. Accounting pairs each image's file facts with the detail read back from
   the message at the same position — the count mismatching is a hard error, same reasoning as
   today. The `"detail" in accounting` refusal and its "milestone 3" error text are replaced by the
   real parameter (see item 24).
7. `buildImageRequest` accepts the run's requested `detail` and multiple images, passing them
   through to the shared builder — the builder remains the only place a detail is attached to a
   message.

### C. Experiment schema (`src/schemas.ts`, `src/execute.ts`, `harness.ts`)

8. **`messageShapes` gains `"mixed"`.** A mixed run requires **both** `textVariant` and
   `imageMode` (each validated against the known lists exactly as today), and the existing
   "refused rather than ignored" stance extends to the new fields:
   - `detail` (`"low" | "high"`; absent means the builder's `"auto"`): valid on `image-only` and
     `mixed` runs; refused on `text-only`.
   - `imageSet` (`"full-document"` default | `"per-tile"` | `"visual-tiles-only"`): valid on
     `image-only` and `mixed`; refused on `text-only`.
   - `extras` (`"extras-fixed"` default | `"extras-production-current"` | `"no-extras"`): valid on
     `text-only` and `mixed` (extras ride the summary); refused on `image-only`. The default is
     `extras-fixed` because that is what the harness already does today — `execute.ts` has injected
     manifest `relatedSummaries` into text requests since milestone 1 — so existing experiment
     files keep their meaning and their request keys.
9. While in there: the comment above `validateRelatedSummary` claims related summaries "are not yet
   injected into request construction". That has been false since milestone 1 — fix it to say they
   are injected (and keep the point it is actually making: the manifest is hand-edited, so the
   entries are validated).

### D. Extras variants (`src/execute.ts`)

10. Apply the run's `extras` setting where `relatedSummaries` is passed today:
    - `extras-fixed` — the manifest entries as-is (each related document's actual summary; today's
      behavior).
    - `extras-production-current` — reproduce production's `findRelatedSummaries` bug (spike
      finding 6a, CLUE-630): every entry's `summary` is replaced by the **analyzed document's own
      summary** — the markdown this request is sending — while the entries' `agreements` stay
      as-is. This is a named baseline so before/after comparisons stay honest; do not "improve" it.
    - `no-extras` — an empty array.
11. The synthetic corpus has no `relatedSummaries` today, so the extras dimension is untestable
    against it. Add hand-written `relatedSummaries` (two or three entries with agreement data) to
    at least two documents' manifest entries in a test fixture — note that `import` preserves
    hand-edited `relatedSummaries` across re-imports (`corpus.ts` merges from the previous
    manifest), so the mechanism exists; the committed `examples/synthetic-corpus/expectations.json`
    flow cannot carry them (the manifest is generated), which means tests inject them at the
    manifest level. Record where you land in the README's corpus section.

### E. Skip-empty execution (`src/execute.ts` + `src/capability.ts`)

12. At task-build time, classify each document's **content** (`classifyDocument` — this means
    reading `data/corpus/<name>/documents/<id>.json`, which no run path currently does) and decide
    per (run, document):
    - `text-only` run, classification finds no student text → **skipped row** (the summary would
      carry no student content).
    - `image-only` run, classification is `empty` → **skipped row**.
    - `mixed` run: classification `empty` → skipped row; no student text → send the mixed message
      **without** the summary/extras parts (the spike's "rare no-text skip case"), and record that
      omission on the result row; otherwise send both parts.
    - Skip decisions use `computedModality`/the classification, never `modalityOverride` — the
      override is a reporting judgment, not a change to what the document contains.
13. Every skipped (run, document) writes a `SkippedResultRow` with concrete `skipReasons` (e.g.
    `"text-only run: no tile carries student-authored text"`). Skipped rows reserve nothing and
    build no request; resume must not re-skip-append duplicates on a rerun (treat an existing
    skipped row for the pair as current unless the document content hash changed — the row needs
    enough provenance to tell; give it the representation descriptor or content hash it was decided
    from).
14. The partial omission in the mixed case (text part dropped) is not a `skipped` row — the request
    was sent. Record it on the row (a small field beside `representation`; naming latitude), so the
    report can count it.

### F. Per-tile capture and image-set selection

15. **Render side (`src/backends/puppeteer.ts`):** a new mode `puppeteer-per-tile` (same backend
    id, its own mode id, filed under its own mode directory like every mode) that, after the same
    sizing/readiness protocol as `puppeteer-full-height`, captures **each top-level tile's**
    bounding box as its own PNG — `images[]` entries with `tileId` set and `purpose: "tile"`,
    which the envelope schema already supports. The existing bounds (max pixels, bytes, height)
    apply per image. A document with no tiles is a render failure, not an empty envelope (an
    envelope with zero images is already treated as damaged). Shutterbug modes do not get per-tile
    capture — they post one page to a remote service.
16. **Selection side (`src/execute.ts`):** `imageSet` picks images out of the envelope the run's
    `imageMode` names:
    - `full-document` — exactly one `purpose: "full-document"` image (today's rule, now scoped to
      this set instead of the whole envelope).
    - `per-tile` — every `purpose: "tile"` image, in envelope order; requires an envelope that has
      them (i.e. a per-tile mode), refused with a "render with --mode puppeteer-per-tile" message
      otherwise.
    - `visual-tiles-only` — the `per-tile` images filtered to tiles the capability classification
      marks `requiresVisualRepresentation` (match by `tileId` against `classifyDocument`'s output).
      Zero matching tiles on an image-carrying run → skipped row with that reason. Note the known
      asymmetry: classification traverses into Question tiles but per-tile capture shoots top-level
      tiles only, so a visual tile nested in a Question has a classification entry and no capture —
      match on the images that exist, and record the mismatch as a row-level warning rather than
      failing.
    The single-image restriction and both of its "milestone 3" error messages
    (`src/represent-image.ts`, and the tests that match them) are retired by this item — see 24.
17. `plan` prints per-run image counts and the image-token estimate per image set, since per-tile
    multiplies the base image charge (the spike's cost note) and the projection is the place to see
    it before paying it.

### G. Accurate-height Shutterbug mode (`src/backends/`)

18. A new mode `shutterbug-accurate-height`: posts the same request envelope as
    `shutterbug-parameterized` except the height is **per document** — taken from an existing local
    measurement rather than a fixed 1500. Source of the measurement: the document's
    `puppeteer-full-height` envelope (its image height is the measured full-document height);
    require it to exist and be fresh, and refuse with a "render locally first" message when it
    isn't. Record `captureMode: "fixed-height"` with the per-document `captureHeightPx` in each
    envelope's `renderTarget` (the schema already allows per-envelope targets). This is the
    prototype for the production fix the spike proposes (send the real height instead of 1500) —
    say so in the mode's doc comment.

### H. `no-dataset-tables` text variant (`shared/ai-summarizer/` + `src/represent-text.ts`)

19. New summarizer capability, then a harness variant on top:
    - `AiSummarizerOptions` gains `dataSetTables?: "full" | "schema-only"` (default `"full"`, which
      must leave today's output byte-identical — assert it). `"schema-only"` emits the data-set
      heading, the attributes table, formulas and the case count, but **not** the case-data
      markdown table (the `generateMarkdownTable(...)` block in `documentSummary`).
    - Harness variant `no-dataset-tables` (`variantVersion: 1`) = `documentSummarizer(content,
      { dataSetTables: "schema-only" })`.
    The plan names two further semantics (fixed sample, aggregate stats) — out of scope; note them
    in the variant's comment.

### I. Drawing-text serializer prototype (`shared/ai-summarizer/tile-summarizers/` + variant)

20. The first spike-step-3 drawing serializer that can actually run everywhere: a **pure** tile
    handler (no React, no `src/plugins` imports — the `svg-drawings` variant is excluded for
    exactly that dependency, see the README) that reads the Drawing tile's content snapshot and
    emits a compact text description: object count by type, each object's type, position/size, and
    any text objects' text. Deterministic ordering; no interpretation ("a robot arm") — geometry
    and text only, the model does the interpreting. Wire it as harness variant `drawing-text`
    (default handlers plus this one, the way `documentSummarizerWithDrawings` composes). This is a
    measurement prototype: the work item is honest serialization plus tests on drawing fixtures,
    not a good description — variants exist so better ones can beat it.

### J. Carried operational gaps (`harness.ts`, corpus)

21. `render` gains `--concurrency <n>` (default the current 4) and `--timeout-ms <n>` (default the
    current 30000), wired to the already-injectable `deps.renderConcurrency` and the backends'
    `timeoutMs`. Both validated as positive integers; both recorded in the run's log line. Update
    the README's cold-dev-server section, which currently says re-running is the only lever.
22. A **new** synthetic fixture (`tall`, or similar) whose rendered height comfortably exceeds the
    500px initial frame (`kInitialFrameHeightPx`), so the frame-resize path is exercised against a
    real browser by more than `dataflow` and `iframe-interactive`. A new fixture rather than
    editing an existing one: editing changes that document's content hash and invalidates its
    renders and results. Add it to `expectations.json` and the real-render integration subset.

### K. Reporting and result schema (`src/report.ts`, `src/schemas.ts`)

23. `RepresentationDescriptor` gains a `"mixed"` kind carrying both sides (the text variant fields
    and the image provenance fields — reuse the two existing shapes as members rather than
    duplicating field lists). Additive union member; result rows stay `schemaVersion: 2` unless you
    find a concrete reason a bump is safer — record either way in DEVIATIONS. Report groups handle
    `message: "mixed"` (the grouping key already includes message shape), count skipped rows (the
    column exists), and count the mixed no-text-part omissions from item 14. The `img tok est`
    column applies to mixed groups the same way it does to image groups.

### L. Retire the milestone-3 signposts, update the docs

24. Every error string and comment that defers to "milestone 3" now either does the thing or
    describes real behavior: `src/messages.ts` (detail refusal), `src/represent-image.ts`
    (single-image selection), the README lines that say detail/mixed/per-tile "arrive in milestone
    3", and the tests that pin those messages (`test/represent-image.test.ts`,
    `test/smoke-image.test.ts`). The comment standard from the review follow-ups applies: describe
    behavior, not milestone history.
25. README: the intro's "this is milestone 2" framing, the mode table (+2 modes), variants list
    (+2), experiments section (new fields and their validation), skip-empty semantics, extras
    variants (with a sentence on why `extras-production-current` exists, linking the spike's 6a),
    per-tile cost implications, and the new flags. A new committed experiment file
    (`experiments/mixed-vs-baselines.json`) runs the milestone's headline comparison — text
    default, image puppeteer, mixed — plus one run each for detail-low, per-tile,
    visual-tiles-only, and the three extras settings, all against the same prompt.
26. A second committed prompt, `categorize-design-mixed.json`: the default prompt with its
    `mainPrompt` reworded for a summary-plus-picture message ("This is a picture of a student
    document" mis-describes a mixed message). Provenance marks it authored-for-harness with its own
    hash. Keep the rewording minimal and flag it in the PR description for Ethan's review — prompt
    wording is a team decision, and this file is the vehicle for measuring it, not for settling it.

## Suggested order

A → B → C are the spine and everything else hangs off them. Then D + E (both are `execute.ts`
dimensions over the new schema), F, G (render side, independent of D/E), H + I (summarizer side,
independent of everything after A), J and K whenever, L last. Commit in coherent slices (shared
builders; mixed execution; image sets; variants; carried gaps; docs) rather than one blob.

## Acceptance criteria (milestone 3 is done when…)

1. `npm run typecheck`, `npm run lint`, `npm test` pass in `scripts/ai-harness`; root `npm test`
   still passes (the shared-module and tile-registry tripwires cover the `shared/` changes).
2. **Byte-identical guards hold:** existing text-only and image-only parity snapshots unchanged;
   `documentSummarizer` with default options unchanged on every fixture; the
   `categorize-design-default` prompt hash pin unchanged; a new test pins that an m2-shape run's
   `requestKey` is unchanged on this branch.
3. Mixed parity snapshot: `buildMixedRequest`'s messages equal `buildMixedMessages` called
   directly with the same inputs (the same guarantee the other two shapes have).
4. `npm run test:render` passes against a real dev server, including the per-tile mode and the
   `tall` fixture (its capture must be taller than 500px).
5. A real run of `experiments/mixed-vs-baselines.json` on the synthetic corpus completes within a
   small `--max-cost` (plan first; it should still be cents), produces mixed/skipped rows that
   `report` groups correctly, and a second invocation resumes with zero new API calls.
6. Skip-empty: on the synthetic corpus, `empty` is skipped by every shape, visual-only fixtures
   are skipped by text-only runs, and every skip is a row with reasons — counts asserted in tests.
7. `render --concurrency 1 --timeout-ms 60000` demonstrably changes behavior (asserted through the
   fake browser tests, not by timing).
8. README claims spot-checked against behavior; DEVIATIONS records every departure from this doc
   with a reason; `git status` clean outside `data/`.

## Out of scope (do not build, even if tempting)

The HTML review report (M4); rubric scoring and any quality conclusion (M5); the production corpus
`pull` and anything touching production data or credentials (M6, gated); production adopting
`buildMixedMessages` or the detail option in `functions-v2` (separate PR, after the harness has
numbers); fixing production's `generateHtml` injection or the `updateHeight`-0 risk (spike 6b/6c —
separate production PRs); the React-rendering `svg-drawings` variant (bundler dependency, unchanged
story); `no-dataset-tables`' fixed-sample and aggregate-stats semantics; redaction/anonymization
tooling (arrives with the production corpus work).

## DEVIATIONS protocol

Same as milestones 1 and 2: where reality contradicts this doc, prefer reality, record the
departure and the reason in the README's DEVIATIONS section, and do not silently resolve conflicts
in either direction. Anything discovered that is production's problem rather than the harness's
goes under "Findings for elsewhere" instead.
