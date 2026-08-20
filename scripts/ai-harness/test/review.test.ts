import fs from "node:fs";
import path from "node:path";
import {
  BuildReviewOptions, ReviewModel, ReviewModes, assertExperimentMatchesRows, blindLabelsFor,
  assertKeyIsReusable, buildReviewModel, compareLabels, escapeHtml, labelForIndex, ratingsTemplateCsv,
  renderReviewHtml, reviewKeyFactsOf, reviewKeyFileFor, reviewOutputPathFor, reviewSidecarPaths
} from "../src/review.js";
import { representationPath } from "../src/corpus.js";
import {
  imageRepresentationPath, readImageEnvelope, resolveImageFile
} from "../src/represent-image.js";
import { ResultRow, validateReviewKeyFile } from "../src/schemas.js";
import { ReviewFixture, buildReviewFixture, kAdversarial, kSentinels, tagNamesIn } from "./review-fixture.js";

const kSeed = "a".repeat(64);
const kOtherSeed = "b".repeat(64);
const kNow = new Date("2026-08-20T00:00:00.000Z");

function modelFor(
  fixture: ReviewFixture, modes: Partial<ReviewModes> = {}, overrides: Partial<BuildReviewOptions> = {}
): ReviewModel {
  return buildReviewModel({
    rows: fixture.rows,
    resultsFile: fixture.resultsFile,
    experiment: fixture.experiment,
    experimentSha256: fixture.experimentSha256,
    paths: fixture.paths,
    now: kNow,
    modes: { shareable: false, blind: false, ...modes },
    seed: kSeed,
    ...overrides
  });
}

/** The report's own tags. Anything else in the output came from a document. */
const kOwnTags = ["article", "body", "dd", "div", "dl", "dt", "h1", "h2", "h3", "h4", "head", "html",
  "img", "li", "meta", "p", "pre", "span", "strong", "style", "table", "tbody", "td", "th", "thead",
  "title", "tr", "ul"];

describe("escaping student-authored content", () => {
  const fixture = buildReviewFixture("review-escaping");
  const html = renderReviewHtml(modelFor(fixture));

  it("escapes at every path a document's text reaches the page by", () => {
    // The summary, a discussion, a key indicator, a refusal, an error message and a skip reason are
    // six different code paths, and each one carries the same adversarial string.
    expect(html.split(escapeHtml(kAdversarial)).length - 1).toBeGreaterThanOrEqual(6);
    expect(html).toContain("&lt;/script&gt;");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("never lets student content become markup", () => {
    expect(html).not.toContain("<script");
    // A DOM-free check that nothing beyond the report's own elements was produced: a `<b>`, an `<a>`
    // from the markdown link syntax, or a second `<img>` would each show up here.
    expect(tagNamesIn(html)).toEqual(kOwnTags);
  });

  it("renders markdown in the summary as text rather than interpreting it", () => {
    // Markdown rendering of student text is markup injection with extra steps, so the summary is
    // preformatted text and its `[link](…)` stays visible as characters.
    expect(html).toContain("[link](https://evil.example.com/x)");
    expect(tagNamesIn(html)).not.toContain("a");
  });

  it("loads nothing from anywhere: every image is inline PNG bytes", () => {
    const sources = [...html.matchAll(/<img[^>]*\ssrc="([^"]*)"/g)].map((match) => match[1]);
    expect(sources.length).toBeGreaterThan(0);
    expect(sources.every((source) => source.startsWith("data:image/png;base64,"))).toBe(true);
    // The only URL in the file is the one inside the escaped student text.
    expect([...html.matchAll(/https?:\/\//g)]).toHaveLength(html.split("evil.example.com").length - 1);
    expect(html).not.toMatch(/<(link|iframe|object|embed|svg)\b/);
  });

  it("writes no raw line or paragraph separator, which editors flag as a damaged file", () => {
    // Student text really does contain them — the `adversarial-text` fixture has one of each — and
    // they are ordinary characters in HTML, so they are escaped rather than dropped: a browser
    // decodes the reference back to the same character and renders the page identically.
    const separators = renderReviewHtml(modelFor(buildReviewFixture("review-separators")));
    expect(separators).not.toMatch(/[\u2028\u2029]/);
    expect(escapeHtml("a\u2028b\u2029c")).toBe("a&#8232;b&#8233;c");
    // The `&` of the reference is not itself re-escaped, which would print the reference as text.
    expect(escapeHtml("\u2028")).not.toContain("&amp;");
  });

  it("carries the content-security-policy meta tag as defence in depth", () => {
    expect(html).toContain(`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; ` +
      `img-src data:; style-src 'unsafe-inline'">`);
  });
});

describe("what the model was given", () => {
  const fixture = buildReviewFixture("review-inputs");
  const model = modelFor(fixture);
  const alpha = model.documents.find((document) => document.docId === "alpha")!;
  const beta = model.documents.find((document) => document.docId === "beta")!;

  it("shows the summary each run actually sent", () => {
    expect(alpha.texts).toHaveLength(1);
    expect(alpha.texts[0].markdown).toBe(fixture.alphaMarkdown);
  });

  it("shows one copy of a picture two runs both sent, labelled with both", () => {
    expect(beta.images).toHaveLength(1);
    expect(beta.images[0].sha256).toBe(fixture.imageSha256);
    expect(beta.images[0].labels).toEqual(["puppeteer-full-height, full-document"]);
  });

  it("does not claim a mixed row sent a summary when its text half was dropped", () => {
    // `beta`'s only text-carrying row is the mixed one, and it went without its summary.
    expect(beta.texts).toHaveLength(0);
    expect(beta.cards.find((card) => card.runId === kSentinels.mixedRun)!.textPartOmitted).toBe(true);
  });
});

describe("an input that no longer matches the run is never shown in its place", () => {
  const notices = (fixture: ReviewFixture, docId: string) => {
    const model = modelFor(fixture);
    return model.documents.find((document) => document.docId === docId)!;
  };

  it("refuses a summary regenerated from changed content", () => {
    const fixture = buildReviewFixture("review-stale-content");
    const file = representationPath(fixture.paths, "default", "alpha");
    const envelope = JSON.parse(fs.readFileSync(file, "utf8"));
    fs.writeFileSync(file, JSON.stringify({
      ...envelope, sourceContentSha256: "9".repeat(64), markdown: "REGENERATED-SUMMARY-MARKER"
    }));
    const alpha = notices(fixture, "alpha");
    expect(alpha.texts).toHaveLength(0);
    expect(alpha.inputNotices.join(" ")).toContain("the document has changed since this run");
    expect(renderReviewHtml(modelFor(fixture))).not.toContain("REGENERATED-SUMMARY-MARKER");
  });

  it("refuses a summary produced by a newer version of the variant", () => {
    const fixture = buildReviewFixture("review-variant-version");
    const file = representationPath(fixture.paths, "default", "alpha");
    const envelope = JSON.parse(fs.readFileSync(file, "utf8"));
    fs.writeFileSync(file, JSON.stringify({ ...envelope, variantVersion: 2 }));
    const alpha = notices(fixture, "alpha");
    expect(alpha.texts).toHaveLength(0);
    expect(alpha.inputNotices.join(" "))
      .toContain("regenerated by a newer version of its variant");
  });

  it("refuses a picture whose bytes are not the ones that were sent", () => {
    const fixture = buildReviewFixture("review-image-bytes");
    const envelopeFile = imageRepresentationPath(fixture.paths, "puppeteer-full-height", "beta");
    const image = readImageEnvelope(envelopeFile).images[0];
    const bytes = fs.readFileSync(resolveImageFile(envelopeFile, image));
    // Same length, different pixels: the byte count alone would still match.
    bytes[bytes.length - 20] = bytes[bytes.length - 20] === 0 ? 1 : 0;
    fs.writeFileSync(resolveImageFile(envelopeFile, image), bytes);
    const beta = notices(fixture, "beta");
    expect(beta.images).toHaveLength(0);
    // Damaged bytes trip the envelope's own hash check first, so the reason is the render no longer
    // matching rather than the narrower "these are not the bytes that were sent".
    expect(beta.inputNotices.join(" ")).toContain("no longer matches the one this run sent");
  });

  it("refuses a render of a document that has changed since", () => {
    const fixture = buildReviewFixture("review-image-content");
    const envelopeFile = imageRepresentationPath(fixture.paths, "puppeteer-full-height", "beta");
    const envelope = JSON.parse(fs.readFileSync(envelopeFile, "utf8"));
    fs.writeFileSync(envelopeFile,
      JSON.stringify({ ...envelope, sourceContentSha256: "9".repeat(64) }));
    expect(notices(fixture, "beta").images).toHaveLength(0);
  });

  it("degrades to a notice when the files are gone, rather than crashing", () => {
    const fixture = buildReviewFixture("review-missing-files");
    fs.rmSync(representationPath(fixture.paths, "default", "alpha"));
    fs.rmSync(imageRepresentationPath(fixture.paths, "puppeteer-full-height", "beta"),
      { recursive: true });
    const model = modelFor(fixture);
    const alpha = model.documents.find((document) => document.docId === "alpha")!;
    const beta = model.documents.find((document) => document.docId === "beta")!;
    expect(alpha.texts).toHaveLength(0);
    expect(alpha.inputNotices.join(" ")).toContain("no longer on disk");
    expect(beta.images).toHaveLength(0);
    expect(beta.inputNotices.join(" ")).toContain("no longer on disk");
    expect(() => renderReviewHtml(model)).not.toThrow();
  });

  it("degrades to a notice when an envelope is damaged", () => {
    const fixture = buildReviewFixture("review-damaged-envelope");
    fs.writeFileSync(imageRepresentationPath(fixture.paths, "puppeteer-full-height", "beta"),
      "{ not json");
    const beta = notices(fixture, "beta");
    expect(beta.images).toHaveLength(0);
    expect(beta.inputNotices.join(" ")).toContain("could not be read");
  });
});

describe("a provenance notice never leaks what its mode is hiding", () => {
  /** Damage every kind of input at once, so one report exercises every notice path. */
  const damaged = (name: string) => {
    const fixture = buildReviewFixture(name);
    fs.writeFileSync(representationPath(fixture.paths, "default", "alpha"), "{ not json");
    const envelopeFile = imageRepresentationPath(fixture.paths, "puppeteer-full-height", "beta");
    const envelope = JSON.parse(fs.readFileSync(envelopeFile, "utf8"));
    // A mode/backend mismatch, which is what puts a run configuration in a freshness reason.
    fs.writeFileSync(envelopeFile, JSON.stringify({ ...envelope, backendVersion: 99 }));
    return fixture;
  };

  it("keeps paths, filenames and document ids out of a shareable report", () => {
    const fixture = damaged("review-notice-shareable");
    const model = modelFor(fixture, { shareable: true });
    const notices = model.documents.flatMap((document) => document.inputNotices).join(" ");
    expect(notices).not.toBe("");
    // The reader's own error names the file it could not read, which is an absolute path holding
    // the corpus name and the document id.
    for (const leak of ["alpha", "beta", "gamma", "/", ".json", ".png", "review-corpus"]) {
      expect(notices).not.toContain(leak);
    }
    expect(renderReviewHtml(model)).not.toContain(fixture.dataRoot);
  });

  it("keeps run configurations out of a blinded report", () => {
    const fixture = damaged("review-notice-blind");
    const model = modelFor(fixture, { blind: true });
    const notices = model.documents.flatMap((document) => document.inputNotices).join(" ");
    expect(notices).not.toBe("");
    // A freshness reason names the backend and version it expected; a filename names the document.
    for (const leak of ["puppeteer", "backendVersion", "99", "default", "alpha", ".png"]) {
      expect(notices).not.toContain(leak);
    }
  });

  it("still tells the team-internal report exactly what went wrong", () => {
    // The detail is what makes a notice actionable, so the one report allowed to carry it does.
    const notices = modelFor(damaged("review-notice-plain"))
      .documents.flatMap((document) => document.inputNotices).join(" ");
    expect(notices).toContain("backendVersion");
    expect(notices).toContain("could not be read");
  });
});

describe("every outcome a row can hold is rendered", () => {
  const fixture = buildReviewFixture("review-structure");
  const model = modelFor(fixture);
  const html = renderReviewHtml(model);
  const alpha = model.documents.find((document) => document.docId === "alpha")!;
  const beta = model.documents.find((document) => document.docId === "beta")!;
  const gamma = model.documents.find((document) => document.docId === "gamma")!;

  it("counts each status once, over current rows only", () => {
    expect(model.counts).toEqual({ success: 3, refusal: 1, error: 1, skipped: 4 });
  });

  it("renders success, refusal and error as cards", () => {
    expect(alpha.cards.map((card) => card.status)).toEqual(["success", "refusal", "error"]);
    expect(html).toContain("badge-success");
    expect(html).toContain("badge-refusal");
    expect(html).toContain("badge-error");
  });

  it("renders whichever response fields exist, and keeps the ones it does not recognize", () => {
    const [full] = alpha.cards;
    expect(full.outcome).toMatchObject({ kind: "success", category: "form" });
    const partial = beta.cards.find((card) => card.runId === kSentinels.imageRun)!;
    expect(partial.outcome).toMatchObject({
      kind: "success", category: "function", keyIndicators: null, discussion: null,
      remainingJson: '{"zzUnknownField":"zz-extra-field-marker"}'
    });
    expect(html).toContain("zz-extra-field-marker");
  });

  it("says so plainly when a response parsed to nothing at all", () => {
    const empty = beta.cards.find((card) => card.runId === kSentinels.mixedRun)!;
    expect(empty.outcome)
      .toEqual({ kind: "success", category: null, keyIndicators: null, discussion: null, remainingJson: null });
    expect(html).toContain("The response parsed to an empty object.");
  });

  it("keeps skipped outcomes out of the cards and in their own strip, with reasons", () => {
    expect(gamma.cards).toHaveLength(0);
    expect(gamma.skipped).toHaveLength(3);
    expect(beta.skipped.map((entry) => entry.runId)).toEqual([kSentinels.textRun]);
    expect(html).toContain("declined to send this document");
    expect(html).toContain(escapeHtml(`text-only run: skipped ${kAdversarial}`));
  });

  it("flags the mixed row that went without its text half", () => {
    expect(html).toContain("no summary sent");
  });

  it("excludes superseded rows and counts them", () => {
    expect(model.supersededRows).toBe(1);
    expect(html).not.toContain("superseded-error-marker");
    expect(html).toContain("1 superseded row(s)");
  });

  it("groups documents by the modality their rows were filed under, flagging overrides", () => {
    expect(model.groups.map((group) => group.modality)).toEqual(["text-only", "visual-only", "empty"]);
    expect(beta.overridden).toBe(true);
    expect(html).toContain("modality overridden");
  });

  it("lists every run's configuration in experiment-file order", () => {
    expect(model.runs!.map((run) => run.runId))
      .toEqual([kSentinels.textRun, kSentinels.imageRun, kSentinels.mixedRun]);
    expect(model.runs![1]).toMatchObject({ imageMode: "puppeteer-full-height", detail: "low" });
    // Defaults are shown as what they are rather than left blank: `extras` is only absent from the
    // experiment file, not from the request.
    expect(model.runs![0].extras).toBe("all");
    expect(model.runs![2].extras).toBe("none");
  });

  it("is stamped with the injected clock rather than the wall clock", () => {
    expect(model.generatedAt).toBe(kNow.toISOString());
    expect(html).toContain(kNow.toISOString());
  });
});

describe("a run whose rows used two different prompts says so", () => {
  /**
   * A prompt file's content is not part of the experiment hash, but it *is* part of the request
   * key. So editing a prompt and re-running into the same results file re-runs every pair — and a
   * re-run that stops early leaves some pairs on the new prompt and some on the old, all current.
   */
  const mixed = (modes: Partial<ReviewModes> = {}) => {
    const fixture = buildReviewFixture(`review-prompt-${modes.blind ? "blind" : "plain"}`);
    // `alpha`'s image row is re-run under an edited prompt; `beta`'s is not reached before the run
    // stops. Both are current, and both produce a card.
    const original = fixture.rows.find(
      (row) => row.docId === "alpha" && row.runId === kSentinels.imageRun)!;
    const reRun = {
      ...original, requestKey: "alpha-image-new-prompt",
      prompt: { name: "categorize-design-default", sha256: "b".repeat(64) }
    } as ResultRow;
    const model = buildReviewModel({
      rows: [...fixture.rows, reRun], resultsFile: fixture.resultsFile,
      experiment: fixture.experiment, experimentSha256: fixture.experimentSha256,
      paths: fixture.paths, now: kNow, modes: { shareable: false, blind: false, ...modes },
      seed: kSeed
    });
    return { model, html: renderReviewHtml(model) };
  };

  it("refuses to name one prompt for the run in the header", () => {
    const { model, html } = mixed();
    const run = model.runs!.find((entry) => entry.runId === kSentinels.imageRun)!;
    // The last row's hash used to be reported as the run's, which was false for the other cards.
    expect(run.promptSha256).toBeNull();
    expect(run.promptVersions).toBe(2);
    expect(html).toContain("2 versions — see each card");
  });

  it("gives each card its own prompt instead", () => {
    const { model, html } = mixed();
    const cards = model.documents.flatMap((document) => document.cards)
      .filter((card) => card.runId === kSentinels.imageRun);
    expect(new Set(cards.map((card) => card.promptSha256))).toEqual(new Set(["b".repeat(64), "a".repeat(64)]));
    expect(html).toContain(`prompt ${"b".repeat(12)}`);
    expect(html).toContain(`prompt ${"a".repeat(12)}`);
  });

  it("leaves a run whose rows agree exactly as it was", () => {
    const { model, html } = mixed();
    const settled = model.runs!.find((entry) => entry.runId === kSentinels.mixedRun)!;
    expect(settled.promptVersions).toBe(1);
    expect(settled.promptSha256).toBe("a".repeat(64));
    // The hash appears once in the header, not once per card.
    expect(html.split(`prompt ${"a".repeat(12)}`).length - 1).toBe(1);
  });

  it("does not count a skipped row, which sent no prompt at all", () => {
    // A skipped row records the prompt its run would have used. Counting it flagged a run whose
    // every card came from one prompt, because a lagging skipped row disagreed with them.
    const fixture = buildReviewFixture("review-prompt-skipped");
    const rows = fixture.rows.map((row) => (row.status === "skipped"
      ? { ...row, prompt: { name: "categorize-design-default", sha256: "c".repeat(64) } }
      : row)) as ResultRow[];
    const model = buildReviewModel({
      rows, resultsFile: fixture.resultsFile, experiment: fixture.experiment,
      experimentSha256: fixture.experimentSha256, paths: fixture.paths, now: kNow,
      modes: { shareable: false, blind: false }, seed: kSeed
    });
    expect(model.runs!.every((run) => run.promptVersions <= 1)).toBe(true);
    expect(renderReviewHtml(model)).not.toContain("versions — see each card");
  });

  it("says none of it in a blinded report, where a prompt identifies the run", () => {
    const { model, html } = mixed({ blind: true });
    expect(model.documents.flatMap((document) => document.cards)
      .every((card) => card.promptSha256 === null)).toBe(true);
    expect(html).not.toContain("b".repeat(12));
    expect(html).not.toContain("versions — see each card");
  });
});

describe("the experiment file has to be the one the rows were produced with", () => {
  const fixture = buildReviewFixture("review-experiment-hash");

  it("refuses a file whose hash does not match the rows", () => {
    expect(() => assertExperimentMatchesRows(
      fixture.rows, "edited-hash", fixture.experimentFile, fixture.resultsFile))
      .toThrow(/has been edited since the run/);
  });

  it("accepts the matching one", () => {
    expect(() => assertExperimentMatchesRows(
      fixture.rows, fixture.experimentSha256, fixture.experimentFile, fixture.resultsFile))
      .not.toThrow();
  });
});

describe("--shareable", () => {
  const fixture = buildReviewFixture("review-shareable");
  const model = modelFor(fixture, { shareable: true });
  const html = renderReviewHtml(model);

  it("replaces document ids with stable per-report pseudonyms", () => {
    expect(model.documents.map((document) => document.displayName))
      .toEqual(["doc-01", "doc-02", "doc-03"]);
    expect(model.pseudonyms).toEqual({ alpha: "doc-01", beta: "doc-02", gamma: "doc-03" });
    for (const docId of ["alpha", "beta", "gamma"]) expect(html).not.toContain(docId);
  });

  it("omits every harness metadata identifier", () => {
    for (const sentinel of [kSentinels.unit, kSentinels.investigation, kSentinels.problem,
      kSentinels.contextId]) {
      expect(html).not.toContain(sentinel);
    }
    expect(html).not.toContain("documents/");
    expect(html).not.toContain(fixture.resultsFile);
    expect(model.gitCommit).toBeNull();
  });

  it("keeps the run configurations and prompt identity, which are what a reader judges", () => {
    expect(html).toContain(kSentinels.textRun);
    expect(html).toContain("categorize-design-default");
  });

  it("says plainly that document content is not redacted", () => {
    expect(html).toContain("Document content is not redacted");
    // And it really is not: the student's own text is still there, escaped.
    expect(html).toContain(escapeHtml(kAdversarial));
  });

  it("round-trips its key file", () => {
    const key = validateReviewKeyFile(
      JSON.parse(JSON.stringify(reviewKeyFileFor(model))), "key.json");
    expect(key.pseudonyms).toEqual(model.pseudonyms);
    expect(key.modes).toEqual({ shareable: true, blind: false });
    expect(key.seed).toBeNull();
    expect(key.labels).toBeNull();
  });
});

describe("--blind", () => {
  const fixture = buildReviewFixture("review-blind");
  const model = modelFor(fixture, { blind: true });
  const other = modelFor(fixture, { blind: true }, { seed: kOtherSeed });
  const html = renderReviewHtml(model);

  it("labels the judgeable cards and hides everything that identifies the run", () => {
    const alpha = model.documents.find((document) => document.docId === "alpha")!;
    expect(alpha.cards.map((card) => card.label)).toEqual(["A", "B", "C"]);
    for (const card of alpha.cards) {
      expect(card.runId).toBeNull();
      expect(card.configuration).toBeNull();
      expect(card.usage).toBeNull();
      expect(card.modeledUsd).toBeNull();
      expect(card.representationWarnings).toEqual([]);
    }
    // Status stays: a refusal is an outcome a judge rates.
    expect(alpha.cards.map((card) => card.status).sort())
      .toEqual(["error", "refusal", "success"]);
  });

  it("reduces the header's run list to a count", () => {
    expect(model.runs).toBeNull();
    expect(model.runCount).toBe(3);
    expect(html).toContain("3 run(s)");
  });

  it("leaves no run id, variant, mode, detail, image set, extras or cost anywhere in the page", () => {
    for (const sentinel of [kSentinels.textRun, kSentinels.imageRun, kSentinels.mixedRun]) {
      expect(html).not.toContain(sentinel);
    }
    // Asserted against the structure rather than by searching for "default" or "low", which a
    // student could legitimately write; the run ids above are sentinels precisely so they can be
    // searched for.
    expect(model.documents.flatMap((document) => document.cards)
      .every((card) => !card.configuration && !card.usage && card.modeledUsd === null)).toBe(true);
    expect(html).not.toContain("puppeteer-full-height");
    expect(html).not.toContain("modeled");
    expect(html).not.toContain("$");
  });

  it("still shows the document: every image and summary its runs used", () => {
    const alpha = model.documents.find((document) => document.docId === "alpha")!;
    const beta = model.documents.find((document) => document.docId === "beta")!;
    expect(alpha.texts.map((text) => text.markdown)).toEqual([fixture.alphaMarkdown]);
    expect(beta.images).toHaveLength(1);
    // Without the labels, which would name a configuration.
    expect(alpha.texts[0].labels).toEqual([]);
    expect(beta.images[0].labels).toEqual([]);
  });

  it("keeps skipped outcomes unlabelled, outside the key and outside the ratings template", () => {
    const gamma = model.documents.find((document) => document.docId === "gamma")!;
    expect(gamma.cards).toHaveLength(0);
    expect(gamma.skipped.every((entry) => entry.runId === null)).toBe(true);
    expect(model.judgeable.some((pair) => pair.docId === "gamma")).toBe(false);
    expect(ratingsTemplateCsv(model)).not.toContain("gamma");
  });

  it("gives a complete decoding: every judgeable pair appears in the key exactly once", () => {
    const key = reviewKeyFileFor(model);
    const mapped = Object.entries(key.labels!)
      .flatMap(([docId, byLabel]) => Object.values(byLabel).map((runId) => `${docId} ${runId}`));
    expect(mapped.sort())
      .toEqual(model.judgeable.map((pair) => `${pair.docId} ${pair.runId}`).sort());
    expect(new Set(mapped).size).toBe(mapped.length);
    for (const byLabel of Object.values(key.labels!)) {
      expect(new Set(Object.keys(byLabel)).size).toBe(Object.keys(byLabel).length);
    }
  });

  it("orders the cards from a secret seed, so the page alone does not decode them", () => {
    // Two reports over identical data, differing only in the seed. The pages hold the same cards in
    // a different order, and nothing in either page says which is which.
    expect(model.labels).not.toEqual(other.labels);
    const cardsOf = (source: string) =>
      [...source.matchAll(/<div class="card">([\s\S]*?)<\/div>\s*<\/div>/g)]
        .map((match) => match[1].replace(/<span class="card-title">[A-Z]+<\/span>/, "")).sort();
    expect(cardsOf(html)).toEqual(cardsOf(renderReviewHtml(other)));
    expect(html).not.toBe(renderReviewHtml(other));
  });

  it("regenerates the same order from the same seed", () => {
    expect(renderReviewHtml(modelFor(fixture, { blind: true }))).toBe(html);
  });

  it("writes one row per labelled outcome in the ratings template, and no rubric of its own", () => {
    const csv = ratingsTemplateCsv(model).trim().split("\n");
    expect(csv[0]).toBe("document,label,rating,notes");
    expect(csv).toHaveLength(model.judgeable.length + 1);
    expect(csv[1]).toBe('"alpha","A","",""');
  });

  it("uses the pseudonym in the template when the report is also shareable", () => {
    const both = modelFor(fixture, { blind: true, shareable: true });
    expect(ratingsTemplateCsv(both).split("\n")[1]).toBe('"doc-01","A","",""');
    const key = reviewKeyFileFor(both);
    expect(key.modes).toEqual({ shareable: true, blind: true });
    expect(key.pseudonyms).not.toBeNull();
    expect(key.labels).not.toBeNull();
    expect(key.seed).toBe(kSeed);
  });
});

describe("a response field the typed renderer cannot show is kept, not dropped", () => {
  const withParsed = (parsed: unknown) => {
    const fixture = buildReviewFixture(`review-parsed-${Math.abs(JSON.stringify(parsed).length)}`);
    const rows = fixture.rows.map((row) => (
      row.docId === "beta" && row.runId === kSentinels.imageRun && row.status === "success"
        ? { ...row, response: { parsed, raw: {} } }
        : row)) as ResultRow[];
    const model = buildReviewModel({
      rows, resultsFile: fixture.resultsFile, experiment: fixture.experiment,
      experimentSha256: fixture.experimentSha256, paths: fixture.paths, now: kNow,
      modes: { shareable: false, blind: false }, seed: kSeed
    });
    return model.documents.find((document) => document.docId === "beta")!
      .cards.find((card) => card.runId === kSentinels.imageRun)!;
  };

  it("puts a wrong-typed recognized field in the JSON fallback rather than losing it", () => {
    // Dropping these by name rendered "the response parsed to an empty object" — a card that says
    // something untrue about what came back.
    const card = withParsed({ category: 42, keyIndicators: "not a list", discussion: { a: 1 } });
    expect(card.outcome).toEqual({
      kind: "success", category: null, keyIndicators: null, discussion: null,
      remainingJson: '{"category":42,"discussion":{"a":1},"keyIndicators":"not a list"}'
    });
  });

  it("keeps the ones it can show out of the fallback, so nothing is printed twice", () => {
    const card = withParsed({ category: "form", discussion: 7, other: "kept" });
    expect(card.outcome).toMatchObject({
      category: "form", discussion: null, remainingJson: '{"discussion":7,"other":"kept"}'
    });
  });

  it("shows the whole value when the response is not an object at all", () => {
    expect(withParsed("just a string").outcome)
      .toMatchObject({ category: null, remainingJson: '"just a string"' });
  });
});

describe("blind labels", () => {
  it("counts past Z rather than running out", () => {
    expect([0, 1, 25, 26, 27, 51, 52].map(labelForIndex))
      .toEqual(["A", "B", "Z", "AA", "AB", "AZ", "BA"]);
  });

  it("sorts the way it issues, which plain lexicographic ordering does not", () => {
    const issued = Array.from({ length: 30 }, (_, index) => labelForIndex(index));
    expect([...issued].sort(compareLabels)).toEqual(issued);
    // What the report used to do: `AA` lands immediately after `A`.
    expect([...issued].sort((a, b) => a.localeCompare(b))).not.toEqual(issued);
    expect(["B", "AA", "A", "Z", "AB"].sort(compareLabels)).toEqual(["A", "B", "Z", "AA", "AB"]);
  });

  it("keeps a document with more than 26 outcomes in issued order, page and template alike", () => {
    // 27 runs over one document: the case where the ordering rule stops being academic.
    const fixture = buildReviewFixture("review-many-labels");
    const template = fixture.rows.find(
      (row) => row.docId === "alpha" && row.status === "success")!;
    const runIds = Array.from({ length: 27 }, (_, index) => `zz-run-${String(index).padStart(2, "0")}`);
    const experiment = {
      ...fixture.experiment,
      runs: runIds.map((id) => ({
        id, message: "text-only" as const, textVariant: "default", extras: "all" as const,
        prompt: "categorize-design-default"
      }))
    };
    const rows = runIds.map((runId) => ({
      ...template, runId, requestKey: `alpha-${runId}`
    })) as ResultRow[];
    const model = buildReviewModel({
      rows, resultsFile: fixture.resultsFile, experiment, experimentSha256: fixture.experimentSha256,
      paths: fixture.paths, now: kNow, modes: { shareable: false, blind: true }, seed: kSeed
    });

    const expected = Array.from({ length: 27 }, (_, index) => labelForIndex(index));
    expect(expected[26]).toBe("AA");
    expect(model.documents[0].cards.map((card) => card.label)).toEqual(expected);
    const rendered = [...renderReviewHtml(model)
      .matchAll(/<span class="card-title">([A-Z]+)<\/span>/g)].map((match) => match[1]);
    expect(rendered).toEqual(expected);
    expect(ratingsTemplateCsv(model).trim().split("\n").slice(1)
      .map((line) => line.split(",")[1].replace(/"/g, ""))).toEqual(expected);
  });

  it("depends on the seed, the document and the run", () => {
    const runs = ["one", "two", "three", "four"];
    const labels = (seed: string, docId: string) =>
      [...blindLabelsFor(seed, docId, runs).entries()].map(([runId, label]) => `${runId}=${label}`).sort();
    expect(labels(kSeed, "alpha")).not.toEqual(labels(kOtherSeed, "alpha"));
    expect(labels(kSeed, "alpha")).not.toEqual(labels(kSeed, "beta"));
    expect(labels(kSeed, "alpha")).toEqual(labels(kSeed, "alpha"));
    expect(new Set(blindLabelsFor(kSeed, "alpha", runs).values()).size).toBe(runs.length);
  });
});

describe("a key that would not decode the report is refused", () => {
  const fixture = buildReviewFixture("review-key-validation");
  const blind = modelFor(fixture, { blind: true, shareable: true });
  const key = reviewKeyFileFor(blind);
  const facts = reviewKeyFactsOf(blind);

  it("accepts the key it just wrote", () => {
    expect(() => assertKeyIsReusable(key, facts, "k.json")).not.toThrow();
  });

  it("refuses pseudonyms that are not the ones the report renders", () => {
    // Nothing else compares the two: the report always numbers documents from the presentation
    // order, so a key naming `doc-99` decodes nothing however well formed it is.
    expect(() => assertKeyIsReusable(
      { ...key, pseudonyms: { alpha: "doc-99", beta: "doc-02", gamma: "doc-03" } }, facts, "k.json"))
      .toThrow(/pseudonyms are not the ones this report renders/);
  });

  it("refuses a second label aliased onto a run that is already mapped", () => {
    // The set of *runs* still looks complete, so counting runs alone accepted this — and converting
    // it back to run→label silently picked whichever alias came last.
    const alpha = key.labels!.alpha;
    const aliased = { ...alpha, Z: Object.values(alpha)[0] };
    expect(() => assertKeyIsReusable(
      { ...key, labels: { ...key.labels, alpha: aliased } }, facts, "k.json"))
      .toThrow(/do not cover exactly the outcomes this report renders, one label each/);
  });

  it("refuses the same mapping on read, before anything can reuse it", () => {
    const alpha = key.labels!.alpha;
    const raw = JSON.parse(JSON.stringify(
      { ...key, labels: { ...key.labels, alpha: { ...alpha, Z: Object.values(alpha)[0] } } }));
    expect(() => validateReviewKeyFile(raw, "k.json")).toThrow(/more than one label/);
    const duplicated = JSON.parse(JSON.stringify(
      { ...key, pseudonyms: { alpha: "doc-01", beta: "doc-01", gamma: "doc-03" } }));
    expect(() => validateReviewKeyFile(duplicated, "k.json"))
      .toThrow(/more than one document the pseudonym "doc-01"/);
  });
});

describe("one order runs through the report, the key and the ratings template", () => {
  it("numbers pseudonyms by the order the page presents, not by manifest order", () => {
    // The page groups by modality, so manifest order is not reading order. A judge working down the
    // page has to be working down the spreadsheet at the same time.
    const fixture = buildReviewFixture("review-presentation-order");
    const orphan = { ...fixture.rows[1], docId: "delta", requestKey: "delta-text" } as ResultRow;
    const model = buildReviewModel({
      rows: [...fixture.rows, orphan], resultsFile: fixture.resultsFile,
      experiment: fixture.experiment, experimentSha256: fixture.experimentSha256,
      paths: fixture.paths, now: kNow, modes: { shareable: true, blind: true }, seed: kSeed
    });
    const page = model.groups.flatMap((group) => group.documents.map((document) => document.displayName));
    expect(page).toEqual(["doc-01", "doc-02", "doc-03", "doc-04"]);
    expect(model.documents.map((document) => document.displayName)).toEqual(page);
    expect(reviewKeyFileFor(model).documents).toEqual(["alpha", "delta", "beta", "gamma"]);
    const csv = ratingsTemplateCsv(model).trim().split("\n").slice(1)
      .map((line) => line.split(",")[0].replace(/"/g, ""));
    expect([...new Set(csv)]).toEqual(page.filter((name) => csv.includes(name)));
    // And the HTML really does present them in that order.
    const rendered = [...renderReviewHtml(model).matchAll(/<h3>(doc-\d+)<\/h3>/g)].map((m) => m[1]);
    expect(rendered).toEqual(page);
  });
});

describe("output and sidecar paths", () => {
  const results = path.join("data", "results", "corpus__experiment.jsonl");

  it("names a distinct file per mode, so no variant can overwrite another", () => {
    const names = ([
      { shareable: false, blind: false }, { shareable: true, blind: false },
      { shareable: false, blind: true }, { shareable: true, blind: true }
    ] as ReviewModes[]).map((modes) => path.basename(reviewOutputPathFor(results, modes)));
    expect(names).toEqual([
      "corpus__experiment.review.html",
      "corpus__experiment.review-shareable.html",
      "corpus__experiment.review-blind.html",
      "corpus__experiment.review-blind-shareable.html"
    ]);
    expect(new Set(names).size).toBe(4);
  });

  it("derives both sidecars from the output path, not from the results basename", () => {
    // Two `--out` targets over one results file must not share a key.
    expect(reviewSidecarPaths("/d/one.html"))
      .toEqual({ key: "/d/one.key.json", ratings: "/d/one.ratings-template.csv" });
    expect(reviewSidecarPaths("/d/two.html").key).not.toBe(reviewSidecarPaths("/d/one.html").key);
  });
});

describe("a document the manifest no longer lists is still shown", () => {
  it("renders after the manifest's own, flagged, rather than disappearing", () => {
    const fixture = buildReviewFixture("review-unknown-document");
    const orphan: ResultRow = {
      ...fixture.rows[1], docId: "delta", requestKey: "delta-text"
    } as ResultRow;
    const model = buildReviewModel({
      rows: [...fixture.rows, orphan],
      resultsFile: fixture.resultsFile,
      experiment: fixture.experiment,
      experimentSha256: fixture.experimentSha256,
      paths: fixture.paths,
      now: kNow,
      modes: { shareable: false, blind: false },
      seed: kSeed
    });
    const delta = model.documents.find((document) => document.docId === "delta")!;
    // Presentation order, not manifest order: `delta` is text-only, so it reads with the other
    // text-only document rather than after the empty one.
    expect(model.documents.map((document) => document.docId)).toEqual(["alpha", "delta", "beta", "gamma"]);
    expect(delta.missingFromManifest).toBe(true);
    expect(delta.metadata).toBeNull();
    expect(renderReviewHtml(model)).toContain("no longer in the corpus manifest");
  });
});
