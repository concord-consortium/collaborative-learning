# CLUE-371 Harness — Milestone 4 Implementation

A work order for milestone 4 of the [harness plan](./CLUE-371-harness-plan.md): the **side-by-side
HTML review report** — the document a human judge reads to compare what each experiment said about
each document — with escaping throughout, a `--shareable` mode, and a `--blind` mode that the
milestone-5 judging workflow needs. Written against the as-built state of `CLUE-371-extras-settings`
(extras renamed to `all`/`none`, `extras-production-current` removed), which is expected to be the
state of `CLUE-371` when this work starts.

Read `scripts/ai-harness/README.md` first, as always — particularly "Results and reports", "Which
documents a run declines to send", and the DEVIATIONS section. Everything this milestone displays
already exists in the result rows, the experiment file, and the corpus tree; this milestone is a
*renderer* over data milestones 1–3 already record, and it should not need to touch `execute.ts`,
the schemas' meaning, or anything a run writes. If it does, stop and record why.

Branch: `CLUE-371-harness-m4` off `CLUE-371` (after the extras PR merges), PR into `CLUE-371` — the
same process as the previous milestones.

## Why this shape

The stdout table and `summary.json` answer aggregate questions (tokens, cost, category counts per
group). They cannot answer the question milestone 5 puts to a human: *for this document, which
output is better?* That takes seeing the document the way the model saw it — the screenshot(s) and
the text summary — beside every run's actual feedback. The project team has named a judge and a
backup; this report is the artifact they will work from, so the blind mode is not a nice-to-have,
it is how the judging stays honest.

## The traps

1. **Student-authored content is untrusted input, everywhere it appears.** Document text reaches
   this report through summaries, through model outputs that quote it, through refusal strings, and
   through error messages. All of it is HTML-escaped at the point of interpolation — one escape
   function, used everywhere, no exceptions for "safe-looking" fields. The `adversarial-text`
   fixture (student text containing `</script>`) exists for exactly this test. No student-derived
   SVG or HTML is ever inlined as markup: the only non-text content in the report is PNG bytes as
   `data:` URLs.
2. **Show the input that was sent, or a notice — never a stand-in.** A result row records the exact
   provenance of what the model saw (`imageSha256s`; the text descriptor's `variantId`,
   `variantVersion` and `sourceContentSha256`). The corpus's representation files may have been
   regenerated since. One consistent rule: a representation is displayed as this run's input only
   when its **full** descriptor matches — for text, variant id, variant version and source hash;
   for images, the envelope's mode/backend/version/source hash (reuse
   `imageRepresentationIsUsable`) *and* each file's actual bytes hashing to the row's recorded
   `imageSha256s`. Anything less produces a clearly marked "input no longer available / no longer
   matches this run" notice, and the current file is **not** shown in its place. A review report
   that pairs new inputs with old outputs — even flagged — invites judgments about the wrong thing.
3. **The blind key is the whole point of blind mode.** If the mapping from presentation label to
   run id is wrong, reconstructible without the key, or lost, the judging round is wasted. A
   mapping derived purely from data in the results file (doc ids, run ids, the experiment hash) is
   reconstructible by anyone who reads the algorithm, so the ordering must depend on a secret: a
   random seed generated at report time and stored **only** in the key file. It gets its own file,
   its own tests, and explicit overwrite rules (section D).

## Work items

### A. The `review` command (`harness.ts` + new `src/review.ts`)

1. `npx tsx harness.ts review --results <file>.jsonl --experiment <file>.json [--out <file>.html]
   [--shareable] [--blind] [--reuse-key]`. New command rather than a flag on `report`: `report` is
   "reports as data", this is a document for humans. `shareable`, `blind` and `reuse-key` are
   value-less flags and must be registered in the CLI parser's boolean set (like `--prune` and
   `--refresh`), or a following flag would be swallowed as their value. Add the command to the
   README command table (`Network: no`, `OpenAI key: no` — it reads the results file, the
   experiment file, and the corpus tree, nothing else).
2. **`--experiment` is required, and hash-checked.** Result rows deliberately do not carry the full
   run configuration — `detail`, `imageSet` and `extras` live only in the experiment file, skipped
   rows carry no representation descriptor at all, and the header needs experiment-file run order.
   Load the experiment through the same loader `plan`/`run` use (it already returns
   `sha256Canonical` of the raw file) and **refuse** unless that hash equals every row's
   `experimentSha256` — a name match is not enough, since an experiment file can be edited after
   the run. This is what preserves the "no result-schema changes" constraint while still showing
   authoritative configurations and order.
3. Row handling reuses what `report.ts` already exports: `partitionSuperseded` (render only current
   outcomes; note the superseded count in the header), `assertSingleCorpusAndExperiment`. The
   corpus named in the rows must exist locally — the report needs the manifest and the
   representation files; refuse with a clear message when it doesn't.
4. Default output path: `<results-basename>.review.html` beside the results file (the
   `summaryPathFor` convention), routed through the same data-root containment as every other
   output path. `--shareable` and `--blind` change the default name (`.review-shareable.html`,
   `.review-blind.html`, `.review-blind-shareable.html`) so variants never overwrite each other or
   the team-internal report. **Every sidecar file (sections C and D) derives its name from the
   actual output HTML path** — the resolved `--out` included — never from the results basename
   alone, so no two variants (or two `--out` targets) can collide on a key or template. All outputs
   go through `writeFileAtomically`.

### B. The document (`src/review.ts`)

5. **Structure: one section per document**, grouped by effective modality (the same
   modality/override rules the report uses — flag overridden documents the way the `overridden`
   column does), documents in manifest order within a group. Per document:
   - The inputs: every distinct image the document's rows actually sent (dedupe by sha256; label
     with mode and image set; per-tile sets show each tile image with its `tileId`), and every
     distinct text summary sent (label with variant id; render as escaped preformatted text, NOT
     as interpreted markdown — markdown rendering of student text is markup injection with extra
     steps). Provenance rule from trap 2 throughout.
   - The outputs: one card per run, in experiment-file order. A success shows the recognized parsed
     fields when present — category, key indicators, discussion are all **optional** in the prompt
     schema, so render whichever exist and fall back to the escaped canonical JSON of any remaining
     parsed object rather than assuming the shape. A refusal shows the refusal text, an error its
     type/message/attempts. Tokens, modeled cost, and cache/fresh on every card. Mixed rows that
     dropped their text half show the `textPartOmitted` marker prominently — the judge must know
     that row saw half the input.
   - Skipped outcomes render in their own clearly separated strip below the output cards (with
     their `skipReasons`), not among them — a skipped run produced no feedback to judge, and blind
     mode (section D) needs the judgeable set and the skipped set to be visibly different things.
6. **Header block:** corpus name, experiment name and sha (short), the run list in experiment-file
   order with each run's configuration (shape, variant/mode, detail, image set, extras, prompt name
   + hash short — from the verified experiment file, per item 2), generation date, row counts by
   status, superseded count. This is the provenance a reader needs to know what they are looking
   at — and most of it is exactly what `--blind` hides (section D).
7. **Self-contained and inert.** One HTML file: inline CSS, **zero JavaScript**, images embedded as
   `data:` URLs, no external references of any kind. Add
   `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:;
   style-src 'unsafe-inline'">` as defense in depth — with no script and no external loads, the CSP
   should be redundant; it exists so a bug in escaping still cannot phone out.
8. Embedded images make the file large (the synthetic corpus's PNGs run 2.5–17 KB, but real
   captures reach hundreds of KB). Acceptable for now; if a real corpus produces an unusable file,
   record the size in DEVIATIONS and raise it rather than silently downscaling — image legibility
   is one of the things under judgment (the per-tile experiment exists because full-document
   screenshots downscale hard).

### C. `--shareable`

9. Strips what identifies people and places, keeps what the reader judges:
   - Document ids replaced by stable per-report pseudonyms (`doc-01`…, in presentation order);
     unit, investigation, problem, `contextId`, source, and file paths omitted; render-target URLs
     and git commit omitted; run configurations and prompt name/hash kept.
   - The pseudonym mapping goes into the report's **single key file** (item 12 — one key file per
     output HTML, one writer, never two sidecars targeting one path), never into the HTML.
   - Document *content* (images, summaries, outputs) is not redacted — sharing scope is a human
     decision made when sending the file. State it precisely, in the doc and the README's
     data-safety section: **the flag removes harness metadata identifiers; it does not anonymize or
     redact document content**, which can itself contain identifying information (a student typing
     their name into a text tile).

### D. `--blind` (what milestone 5's judging consumes), the key file, and sidecar lifecycle

10. Per document, the judgeable output cards (success, refusal, error — everything that produced an
    outcome from a real request) are presented in shuffled order labeled `A`, `B`, `C`… with
    everything that identifies the producing run hidden: run id, representation labels, detail /
    image set / extras / variant, tokens, cost, cache status — and the header's run list (item 6)
    is reduced to run *count*, since a list of configurations beside labeled cards is a decoding
    aid. Status stays visible (a refusal is an outcome the judge rates). Skipped outcomes stay in
    their separate strip (item 5), unlabeled and outside the key and the ratings template — there
    is nothing to rate. The inputs block still shows all images and summaries the document's runs
    used — the judge needs the document; what's hidden is which output came from which
    configuration. Note the known leak honestly in the README: an output's own wording can betray
    its mode ("the picture shows…"); blinding removes labels, not language.
11. **Ordering is seeded, and the seed is secret.** Generate a fresh seed with
    `crypto.randomBytes`, store it only in the key file, and derive each card's sort key as
    `HMAC(seed, docId + runId)` (or equivalent keyed construction). Without the key file the
    mapping is not reconstructible from the HTML plus the repository; with it, regeneration is
    deterministic. No `Math.random()` ordering, and no seedless hash of row data — that is
    reconstructible by anyone who reads the code.
12. **One key file per report, written atomically:** `<output-html-basename>.key.json`. This is the
    single sidecar for *any* mode that needs a mapping — shareable-only reports write it too (for
    the pseudonyms), and blind+shareable writes one combined key, never a shareable key and a blind
    key targeting the same path. A plain report (no flags) writes no sidecars at all. Contents:
    `schemaVersion`, corpus name, `experimentSha256`, which flags produced it, the exact judgeable
    `(document, run)` set it was generated over, the pseudonym mapping (when shareable), and the
    seed plus the per-document label→run mapping (when blind). Validated on read like every other
    on-disk format.
13. **Ratings capture, minimal seam:** alongside the blind HTML (blind modes only), write
    `<output-html-basename>.ratings-template.csv` — one row per (document, label) over the
    judgeable cards only, columns `document,label,rating,notes`, values empty; `document` uses the
    pseudonym when `--shareable` is on. Milestone 5 defines the rubric and the `score` command that
    reads the filled file; this milestone only guarantees the judge has a place to write answers
    that a program can later read. Do not invent rubric columns.
14. `--blind` composes with `--shareable` (blind alone can still name documents; a shared judging
    file likely wants both). The combined mode has its own output name (item 4), and therefore its
    own single combined key and template.
15. **Overwrite and reuse rules for the sidecars, exactly these** (they apply to every mode that
    writes a key, shareable-only included):
    - Every collision (HTML, key, ratings template) is checked **before any output is written** —
      a refused run writes nothing.
    - An existing key file is never overwritten. Without `--reuse-key`, its existence is an error
      (use a different `--out`, or opt into reuse). A silently rotated key orphans every rating
      already written against the old labels.
    - `--reuse-key` **reads and validates** the existing key and never rewrites it. Reuse is
      refused if the key's corpus, experiment hash, mode flags, document set, or judgeable run set
      differs from the current invocation — same inputs, same labels and pseudonyms, or nothing.
    - Under `--reuse-key`, an existing ratings template is **preserved byte-for-byte** — never
      regenerated, never cleared; it may contain a judge's half-entered ratings. The template is
      written only when absent.

### E. Tests

16. Escaping: a results fixture whose summary, discussion, refusal and error strings carry
    `</script>`, `<img onerror=…>`, and markdown link syntax; assert the output contains the
    escaped forms and a DOM-free parse finds no elements beyond the report's own. Reuse the
    `adversarial-text` fixture where a real corpus is needed. Also assert no `<script` and no
    `http://`/`https://` outside escaped student content, and the CSP meta tag's presence.
17. Provenance: image-hash mismatch, stale summary (wrong source hash), wrong variant version, and
    missing files each render the trap-2 notice and never the current representation's content; a
    missing envelope degrades to a notice, not a crash.
18. Blind: **key confidentiality** — generate the same report twice with different seeds and assert
    the HTML differs only in card order while the mapping differs, i.e. nothing in the HTML
    determines the mapping without the key; **complete decoding** — every (document, judgeable
    run) appears in the key exactly once, skipped pairs never; **deterministic regeneration** —
    `--reuse-key` reproduces byte-identical HTML under a fixed clock; **refusal** — an existing key
    without `--reuse-key` is an error, reuse against a key whose corpus/experiment/mode/document
    set/judgeable set differs is an error, and a refused run has written nothing; **template
    preservation** — a filled ratings template survives `--reuse-key` byte-for-byte; **combined
    key** — blind+shareable writes exactly one key file containing both mappings; and
    **hidden-field coverage** — no run id, variant, mode, detail, image-set, extras or cost string
    appears in the blind HTML (use unique sentinel values in fixtures, and assert against parsed
    structure rather than raw substrings where student text could legitimately contain the same
    characters).
19. Shareable: metadata fields are absent — tested with unique sentinel ids/units/paths in the
    fixture (a raw substring test against realistic values can false-fail on student content that
    happens to contain them); the key file round-trips.
20. Structure: every status renders (success incl. partial/absent parsed fields with the JSON
    fallback, refusal, error, skipped-with-reasons in its strip, `textPartOmitted`); superseded
    rows are excluded and counted; the experiment-hash mismatch refusal (item 2).
21. Determinism is always asserted under an injected clock (the `summarizeResults(rows, file, now)`
    pattern) — the generation date is real output, so byte-identical claims hold only with the
    clock fixed.
22. One snapshot maximum, and only for the report's own chrome — not a byte-identical pin of a
    whole document (the m2 review's lesson about giant snapshots: targeted assertions beat byte
    pins for anything that evolves).

### F. Documentation

23. README: `review` in the command table and examples; a "Review report" section covering the
    escaping stance, the provenance-notice rule, `--shareable` (and its key file), `--blind` (the
    seed-in-key design, `--reuse-key`, the ratings template, the skipped-cards separation, and the
    wording-leak caveat); data-safety section gains the shareable-content sentence from item 9.
24. While in that file: the "Results and reports" paragraph has a mangled sentence left over from
    the milestone-3 edit — "`skipped` ships now but is unused: skip-empty *execution* is written by
    skip-empty execution" (README lines ~618–620). Rewrite it to say what is now true: skipped rows
    are written by skip-empty execution, per "Which documents a run declines to send".
25. DEVIATIONS: the plan's CLI sketch shows `report --runs <run-ids> [--shareable]`; as built,
    review is its own command over a results file plus the experiment file. Record it (the plan
    predates the results-file conventions) unless an entry already covers it.

## Suggested order

A (command plumbing incl. the experiment hash check, empty page end to end) → B (real content,
unblinded) → E16/E17 as B lands → C → D (seed, key rules, template) → the rest of E → F. The first
real `review` against the recorded `mixed-vs-baselines` results is worth generating as soon as B
renders, and eyeballing in a browser — layout judgments on paper are worthless.

## Acceptance criteria (milestone 4 is done when…)

1. `npm run typecheck`, `npm run lint`, `npm test` pass in `scripts/ai-harness`; root `npm test`
   still passes. No changes under `shared/` or to `execute.ts`/result schemas (or a DEVIATIONS
   entry says why).
2. `review` against the recorded `mixed-vs-baselines` results renders every document and every
   status correctly, viewed by hand in a browser; the adversarial fixture displays as text.
3. All **four** output combinations (plain, `--shareable`, `--blind`, blind+shareable) generate
   distinct files with correctly named key/template sidecars; the blind key passes the
   confidentiality and regeneration tests; an existing key is never silently overwritten.
4. The generated files live in `data/` and nothing derived from a document is written outside it;
   `git status` clean outside `data/`.
5. README updated per F, including the item-24 sentence fix.

## Out of scope (do not build, even if tempting)

Rubric definition, the `score` command, and any scoring/statistics (M5 — the ratings template's
columns are deliberately minimal); the production corpus pull and anything touching production data
(M6); multi-results-file or cross-corpus comparison in one report (one results file per report;
M5 can decide if it needs more); serving the report over HTTP, PDF export, or any interactivity
(zero JavaScript is a feature); image downscaling or recompression (item 8); changes to what runs
record.

## DEVIATIONS protocol

Same as every milestone: where reality contradicts this doc, prefer reality, record the departure
and the reason in the README's DEVIATIONS section under a milestone-4 heading, and put anything
that is production's problem under "Findings for elsewhere".

## Review disposition

An external (Codex) review of revision 1 raised seven findings; all were verified against the code
and all are adopted. The three it called blockers reshaped the design: blind ordering now depends
on a `crypto.randomBytes` seed stored only in the key file (revision 1's seedless
`sha256(docId + runId + experimentSha)` was reconstructible from the results file alone, and its
swapped-ids test could not work as written — replaced by the confidentiality/decoding/regeneration
tests in item 18); `--experiment` is now a required, hash-verified input (revision 1 claimed result
rows carried everything displayed, but `detail`/`imageSet`/`extras` and run order live only in the
experiment file, and skipped rows have no representation descriptor); and every sidecar derives its
name from the resolved output HTML path with atomic writes and a no-silent-overwrite rule for keys
and templates (revision 1's fixed sidecar names collided across blind and blind+shareable). Also
adopted: one consistent never-show-mismatched-input provenance rule with full-descriptor matching
(revision 1 said "warn" in one place and "never render" in another); skipped outcomes moved outside
the judgeable label space, key and CSV; the parsed-response fields treated as optional with a JSON
fallback; determinism claims scoped to an injected clock; sentinel-based rather than raw-substring
metadata tests; and "three variants" corrected to four combinations. The review's finding 6 — the
parent harness plan still describes the removed `extras-production-current` as a required baseline
— is fixed in the harness plan itself alongside this revision rather than papered over here.

A second review pass accepted six of the seven and asked for one clarification, adopted in full as
items 12, 13 and 15: blind+shareable writes exactly one combined key file (revision 2 had shareable
and blind both writing `<basename>.key.json` — two writers, one path) with its contents enumerated
(schema version, corpus, experiment hash, mode flags, judgeable set, pseudonym map, seed, label
map); all collisions are checked before anything is written; `--reuse-key` reads and validates but
never rewrites, and is refused when the key's corpus/experiment/mode/document set/judgeable set
differs; and an existing ratings template is preserved byte-for-byte under `--reuse-key` — the
revision-2 wording could be read as allowing a judge's half-filled template to be regenerated
blank. The same pass corrected the shareable claim from "carries no identifiers" to the accurate
"removes harness metadata identifiers; does not anonymize or redact document content".
