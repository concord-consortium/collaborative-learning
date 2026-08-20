import fs from "node:fs";
import path from "node:path";
import { main } from "../harness.js";
import { validateReviewKeyFile } from "../src/schemas.js";
import { listFilesUnder } from "./helpers.js";
import { ReviewFixture, buildReviewFixture, kSentinels } from "./review-fixture.js";

const kSeed = "c".repeat(64);
const kNow = new Date("2026-08-20T00:00:00.000Z");

function depsFor(fixture: ReviewFixture, seed = kSeed) {
  const output: string[] = [];
  return {
    output,
    deps: {
      dataRoot: fixture.dataRoot,
      log: (message: string) => output.push(message),
      // Determinism claims only hold with the clock fixed: the generation date is real output.
      now: () => kNow,
      reviewSeed: () => seed
    }
  };
}

function review(fixture: ReviewFixture, flags: string[], seed = kSeed) {
  const { output, deps } = depsFor(fixture, seed);
  return main(["review", "--results", fixture.resultsFile, "--experiment", fixture.experimentFile,
    ...flags], deps).then(() => output);
}

/** Where a mode's three files land, given the results file the fixture wrote. */
function pathsFor(fixture: ReviewFixture, suffix: string) {
  const stem = fixture.resultsFile.replace(/\.jsonl$/, `.review${suffix}`);
  return { html: `${stem}.html`, key: `${stem}.key.json`, ratings: `${stem}.ratings-template.csv` };
}

describe("review writes one report per mode, with the sidecars that mode needs", () => {
  const fixture = buildReviewFixture("review-command-modes");

  it("writes a plain report and no sidecars at all", async () => {
    await review(fixture, []);
    const paths = pathsFor(fixture, "");
    expect(fs.existsSync(paths.html)).toBe(true);
    expect(fs.existsSync(paths.key)).toBe(false);
    expect(fs.existsSync(paths.ratings)).toBe(false);
  });

  it("writes a shareable report with a key, and no ratings template", async () => {
    await review(fixture, ["--shareable"]);
    const paths = pathsFor(fixture, "-shareable");
    expect(fs.existsSync(paths.html)).toBe(true);
    const key = validateReviewKeyFile(JSON.parse(fs.readFileSync(paths.key, "utf8")), paths.key);
    expect(key.modes).toEqual({ shareable: true, blind: false });
    expect(key.pseudonyms).toEqual({ alpha: "doc-01", beta: "doc-02", gamma: "doc-03" });
    // Nothing to rate: the cards are not labelled.
    expect(fs.existsSync(paths.ratings)).toBe(false);
  });

  it("writes a blind report with a key and a ratings template", async () => {
    await review(fixture, ["--blind"]);
    const paths = pathsFor(fixture, "-blind");
    const key = validateReviewKeyFile(JSON.parse(fs.readFileSync(paths.key, "utf8")), paths.key);
    expect(key.seed).toBe(kSeed);
    expect(Object.keys(key.labels!)).toEqual(["alpha", "beta"]);
    expect(fs.readFileSync(paths.ratings, "utf8").trim().split("\n"))
      .toHaveLength(key.judgeable.length + 1);
  });

  it("writes exactly one combined key for blind + shareable", async () => {
    await review(fixture, ["--blind", "--shareable"]);
    const paths = pathsFor(fixture, "-blind-shareable");
    const key = validateReviewKeyFile(JSON.parse(fs.readFileSync(paths.key, "utf8")), paths.key);
    expect(key.modes).toEqual({ shareable: true, blind: true });
    expect(key.pseudonyms).not.toBeNull();
    expect(key.labels).not.toBeNull();
    // One key file for this report, not a shareable one and a blind one racing for the same path.
    const keys = listFilesUnder(path.dirname(paths.html)).filter((file) => file.endsWith(".key.json"));
    expect(keys).toHaveLength(3);
    expect(new Set(keys).size).toBe(3);
  });

  it("leaves the four reports and their sidecars all distinct", () => {
    const files = listFilesUnder(path.dirname(fixture.resultsFile))
      .map((file) => path.basename(file)).sort();
    expect(files).toEqual([
      "review-corpus__review-fixture.jsonl",
      "review-corpus__review-fixture.review-blind-shareable.html",
      "review-corpus__review-fixture.review-blind-shareable.key.json",
      "review-corpus__review-fixture.review-blind-shareable.ratings-template.csv",
      "review-corpus__review-fixture.review-blind.html",
      "review-corpus__review-fixture.review-blind.key.json",
      "review-corpus__review-fixture.review-blind.ratings-template.csv",
      "review-corpus__review-fixture.review-shareable.html",
      "review-corpus__review-fixture.review-shareable.key.json",
      "review-corpus__review-fixture.review.html"
    ]);
  });

  it("keeps everything it wrote inside the data root", () => {
    for (const file of listFilesUnder(fixture.dataRoot)) {
      expect(file.startsWith(fixture.dataRoot)).toBe(true);
    }
  });
});

describe("an existing key is never overwritten, and never rewritten", () => {
  it("refuses a second blind report over the same key, and writes nothing", async () => {
    const fixture = buildReviewFixture("review-command-key-exists");
    await review(fixture, ["--blind"]);
    const paths = pathsFor(fixture, "-blind");
    const before = fs.readFileSync(paths.key, "utf8");
    const htmlBefore = fs.readFileSync(paths.html, "utf8");

    await expect(review(fixture, ["--blind"], "d".repeat(64)))
      .rejects.toThrow(/already exists, and a key is never overwritten/);
    // A refused run leaves every file exactly as it found it — including the HTML, which is checked
    // before it is written rather than after.
    expect(fs.readFileSync(paths.key, "utf8")).toBe(before);
    expect(fs.readFileSync(paths.html, "utf8")).toBe(htmlBefore);
  });

  it("refuses --reuse-key when there is no key to reuse", async () => {
    const fixture = buildReviewFixture("review-command-no-key");
    await expect(review(fixture, ["--blind", "--reuse-key"]))
      .rejects.toThrow(/there is no key at .* to reuse/);
    expect(fs.existsSync(pathsFor(fixture, "-blind").html)).toBe(false);
  });

  it("refuses --reuse-key on a plain report, which writes no key", async () => {
    const fixture = buildReviewFixture("review-command-reuse-plain");
    await expect(review(fixture, ["--reuse-key"])).rejects.toThrow(/A plain review report writes no sidecars/);
  });

  it("refuses a ratings template left behind without its key", async () => {
    const fixture = buildReviewFixture("review-command-orphan-template");
    const paths = pathsFor(fixture, "-blind");
    fs.mkdirSync(path.dirname(paths.ratings), { recursive: true });
    fs.writeFileSync(paths.ratings, "document,label,rating,notes\n");
    await expect(review(fixture, ["--blind"])).rejects.toThrow(/already exists without a key beside it/);
    expect(fs.existsSync(paths.html)).toBe(false);
  });
});

describe("--reuse-key regenerates the same report", () => {
  const fixture = buildReviewFixture("review-command-reuse");
  const paths = pathsFor(fixture, "-blind-shareable");

  it("reproduces byte-identical HTML under a fixed clock, from the key's own seed", async () => {
    await review(fixture, ["--blind", "--shareable"]);
    const html = fs.readFileSync(paths.html, "utf8");
    const key = fs.readFileSync(paths.key, "utf8");

    // A different seed on the command line changes nothing: the key's seed is what the report is
    // regenerated from, and the key itself is not rewritten.
    await review(fixture, ["--blind", "--shareable", "--reuse-key"], "e".repeat(64));
    expect(fs.readFileSync(paths.html, "utf8")).toBe(html);
    expect(fs.readFileSync(paths.key, "utf8")).toBe(key);
  });

  it("preserves a judge's part-filled ratings template byte for byte", async () => {
    const filled = 'document,label,rating,notes\n"doc-01","A","4","good"\n';
    fs.writeFileSync(paths.ratings, filled);
    await review(fixture, ["--blind", "--shareable", "--reuse-key"]);
    expect(fs.readFileSync(paths.ratings, "utf8")).toBe(filled);
  });

  it("refuses a key whose outcomes have been re-run since it was written", async () => {
    // The reachable case, and the one the never-overwrite-a-key rule did not cover: no file is
    // hand-edited, a re-run simply appends a replacement row for the same (document, run). The
    // labels used to survive onto the new answers while the preserved ratings template went on
    // describing the ones they replaced.
    const rerun = buildReviewFixture("review-command-rerun");
    await review(rerun, ["--blind"]);
    const files = pathsFor(rerun, "-blind");
    const html = fs.readFileSync(files.html, "utf8");
    fs.writeFileSync(files.ratings, 'document,label,rating,notes\n"alpha","A","5","best"\n');

    const rows = fs.readFileSync(rerun.resultsFile, "utf8").trim().split("\n").map((line) => JSON.parse(line));
    const replaced = rows.find((row) => row.docId === "alpha" && row.status === "success")!;
    fs.appendFileSync(rerun.resultsFile, `${JSON.stringify({
      ...replaced, requestKey: "alpha-text-rerun",
      response: { parsed: { category: "user", discussion: "a different answer" }, raw: {} }
    })}\n`);

    await expect(review(rerun, ["--blind", "--reuse-key"]))
      .rejects.toThrow(/1 outcome\(s\) have been re-run since it was written/);
    // And nothing was written: the report the judge read, and their ratings, are as they were.
    expect(fs.readFileSync(files.html, "utf8")).toBe(html);
    expect(fs.readFileSync(files.ratings, "utf8")).toContain('"5","best"');
  });

  it("accepts a re-run that returned the same answer, which is what the cache does", async () => {
    // A cache hit rewrites runMeta, usage and cost while the card stays identical. Refusing that
    // would make `--reuse-key` useless on any file that had been re-run at all.
    const cached = buildReviewFixture("review-command-rerun-same");
    await review(cached, ["--blind"]);
    const files = pathsFor(cached, "-blind");
    const html = fs.readFileSync(files.html, "utf8");

    const rows = fs.readFileSync(cached.resultsFile, "utf8").trim().split("\n").map((line) => JSON.parse(line));
    const replayed = rows.find((row) => row.docId === "alpha" && row.status === "success")!;
    fs.appendFileSync(cached.resultsFile, `${JSON.stringify({
      ...replayed,
      runMeta: { ...replayed.runMeta, date: "2027-01-01T00:00:00.000Z" },
      usage: { ...replayed.usage, source: "cache" },
      cost: { modeledUsd: replayed.cost.modeledUsd, incurredThisRunUsd: 0 }
    })}\n`);

    await review(cached, ["--blind", "--reuse-key"]);
    const regenerated = fs.readFileSync(files.html, "utf8");
    // Every card, and every label on it, is where the judge left it.
    const cards = (source: string) => source.split('<div class="card">').slice(1);
    expect(cards(regenerated)).toEqual(cards(html));
    // The header does move, and honestly so: the file now holds one more superseded row.
    expect(html).toContain("1 superseded row(s)");
    expect(regenerated).toContain("2 superseded row(s)");
  });

  it("refuses a key from another corpus, experiment, mode or set of outcomes", async () => {
    const stored = JSON.parse(fs.readFileSync(paths.key, "utf8"));
    const edits: [string, unknown, RegExp][] = [
      ["corpus", "another-corpus", /generated over corpus/],
      ["experimentSha256", "f".repeat(64), /generated over experiment definition/],
      
      ["documents", ["alpha", "beta"], /generated over documents/],
      ["judgeable", stored.judgeable.slice(1), /generated over judgeable outcomes/]
    ];
    for (const [field, value, message] of edits) {
      fs.writeFileSync(paths.key, JSON.stringify({ ...stored, [field]: value }));
      await expect(review(fixture, ["--blind", "--shareable", "--reuse-key"])).rejects.toThrow(message);
    }
    // A key for a blind-only report cannot be reused for a blind+shareable one: the pseudonyms it
    // does not carry are part of what a reader would be shown.
    fs.writeFileSync(paths.key, JSON.stringify({
      ...stored, modes: { shareable: false, blind: true }, pseudonyms: null
    }));
    await expect(review(fixture, ["--blind", "--shareable", "--reuse-key"]))
      .rejects.toThrow(/generated over modes/);
    // And one whose labels no longer cover the outcomes the report renders.
    fs.writeFileSync(paths.key, JSON.stringify({
      ...stored, labels: { ...stored.labels, alpha: { A: kSentinels.textRun } }
    }));
    await expect(review(fixture, ["--blind", "--shareable", "--reuse-key"]))
      .rejects.toThrow(/labels for document "alpha" do not cover exactly the outcomes/);
    fs.writeFileSync(paths.key, JSON.stringify(stored));
  });
});

describe("review refuses inputs it cannot report on honestly", () => {
  it("refuses an experiment file that has been edited since the run", async () => {
    const fixture = buildReviewFixture("review-command-edited-experiment");
    const experiment = JSON.parse(fs.readFileSync(fixture.experimentFile, "utf8"));
    experiment.runs[0].textVariant = "minimal";
    fs.writeFileSync(fixture.experimentFile, JSON.stringify(experiment));
    await expect(review(fixture, [])).rejects.toThrow(/has been edited since the run/);
    expect(fs.existsSync(pathsFor(fixture, "").html)).toBe(false);
  });

  it("refuses a corpus that is not on this machine", async () => {
    const fixture = buildReviewFixture("review-command-missing-corpus");
    fs.rmSync(fixture.paths.manifest);
    await expect(review(fixture, [])).rejects.toThrow(/which is not in .*import it as "review-corpus"/);
  });

  it("refuses a results file that is not there, or holds no rows", async () => {
    const fixture = buildReviewFixture("review-command-missing-results");
    const { deps } = depsFor(fixture);
    const missing = path.join(fixture.dataRoot, "results", "typo.jsonl");
    await expect(main(["review", "--results", missing, "--experiment", fixture.experimentFile], deps))
      .rejects.toThrow(/No results file at/);
    const empty = path.join(fixture.dataRoot, "results", "empty.jsonl");
    fs.writeFileSync(empty, "");
    await expect(main(["review", "--results", empty, "--experiment", fixture.experimentFile], deps))
      .rejects.toThrow(/contains no result rows/);
  });

  it("requires the experiment file rather than guessing at it", async () => {
    const fixture = buildReviewFixture("review-command-no-experiment");
    const { deps } = depsFor(fixture);
    await expect(main(["review", "--results", fixture.resultsFile], deps))
      .rejects.toThrow(/--experiment is required/);
  });

  it("refuses an --out that would write outside the data root", async () => {
    const fixture = buildReviewFixture("review-command-containment");
    await expect(review(fixture, ["--out", "../escaped.html"]))
      .rejects.toThrow(/--out must name a file inside the harness data directory/);
  });

  it("refuses an --out that is not a .html file, since the sidecars are named from it", async () => {
    const fixture = buildReviewFixture("review-command-out-extension");
    await expect(review(fixture, ["--out", path.join(fixture.dataRoot, "report.txt")]))
      .rejects.toThrow(/--out must name a \.html file/);
  });
});

describe("--out names the sidecars too", () => {
  it("puts a second blind report's key beside that report, not beside the first", async () => {
    const fixture = buildReviewFixture("review-command-out-sidecars");
    await review(fixture, ["--blind"]);
    const other = path.join(fixture.dataRoot, "results", "second.html");
    await review(fixture, ["--blind", "--out", other], "f".repeat(64));
    expect(fs.existsSync(path.join(fixture.dataRoot, "results", "second.key.json"))).toBe(true);
    expect(fs.existsSync(path.join(fixture.dataRoot, "results", "second.ratings-template.csv")))
      .toBe(true);
    // The first report's key is untouched, and the two reports have different orders.
    const first = pathsFor(fixture, "-blind");
    expect(JSON.parse(fs.readFileSync(first.key, "utf8")).seed).toBe(kSeed);
    expect(JSON.parse(fs.readFileSync(path.join(fixture.dataRoot, "results", "second.key.json"), "utf8"))
      .seed).toBe("f".repeat(64));
  });
});

describe("the flags are flags, not values", () => {
  it("does not swallow the flag that follows a value-less one", async () => {
    // `--shareable --blind` has to parse as two booleans; if `--shareable` took a value, the report
    // would silently not be blinded.
    const fixture = buildReviewFixture("review-command-flag-parsing");
    const output = await review(fixture, ["--shareable", "--blind"]);
    expect(output.join("\n")).toContain("review-blind-shareable.html");
  });
});
