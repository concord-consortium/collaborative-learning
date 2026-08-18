import fs from "node:fs";
import path from "node:path";
import { isContainedBy, realPathAsFarAsExists, resolveCorpusFile } from "../src/corpus.js";
import { summaryPathFor } from "../src/report.js";
import { kOutputNameSeparator, resolveDataPath } from "../harness.js";
import { makeTestDataRoot } from "./helpers.js";

describe("a summary is named after its results file", () => {
  it("does not put every experiment's summary on one path", () => {
    // The default output directory is data/results/, so a single summary.json per directory meant
    // reporting on one experiment silently overwrote another's — the normal case, not an edge one.
    const a = summaryPathFor("/data/results/corpus__text-baselines.jsonl");
    const b = summaryPathFor("/data/results/corpus__image-vs-text.jsonl");
    expect(a).not.toBe(b);
    expect(path.basename(a)).toBe("corpus__text-baselines.summary.json");
    expect(path.basename(b)).toBe("corpus__image-vs-text.summary.json");
  });

  it("keeps the summary beside its results file", () => {
    expect(path.dirname(summaryPathFor("/data/results/x.jsonl"))).toBe(path.dirname("/data/results/x.jsonl"));
  });
});

describe("the default output path cannot collide across corpora", () => {
  it("separates corpus from experiment with something their id pattern forbids", () => {
    // Both names match [a-z0-9-]+, so a hyphen made corpus "a-b" + experiment "c" and corpus "a" +
    // experiment "b-c" resolve to one file — and `report` then refuses it for mixing two corpora.
    // Naming the corpus exists to prevent exactly that.
    expect(kOutputNameSeparator).not.toMatch(/[a-z0-9-]/);
    const name = (corpus: string, experiment: string) => `${corpus}${kOutputNameSeparator}${experiment}`;
    expect(name("a-b", "c")).not.toBe(name("a", "b-c"));
  });
});

describe("containment survives a symlinked data root", () => {
  const dataRoot = makeTestDataRoot("paths-symlink");

  it("resolves a path through symlinks as far as it exists", () => {
    const real = path.join(dataRoot, "real");
    fs.mkdirSync(real, { recursive: true });
    const link = path.join(dataRoot, "link");
    fs.symlinkSync(real, link);
    // The part that does not exist yet is preserved, and the part that does is resolved.
    expect(realPathAsFarAsExists(path.join(link, "nested", "file.jsonl")))
      .toBe(path.join(fs.realpathSync(real), "nested", "file.jsonl"));
  });

  it("accepts a path genuinely inside the root", () => {
    expect(isContainedBy(path.join(dataRoot, "results", "x.jsonl"), dataRoot)).toBe(true);
  });

  it("refuses the root itself", () => {
    expect(isContainedBy(dataRoot, dataRoot)).toBe(false);
  });

  it("refuses a lexically-inside path that really points outside", () => {
    // The failure the lexical check could not see: `data/escape` is a symlink to somewhere else
    // entirely, so `data/escape/x.jsonl` passes "does this string start with data/" while the file
    // lands outside the .gitignore entry that is supposed to protect it.
    const outside = path.join(dataRoot, "..", `outside-${path.basename(dataRoot)}`);
    fs.rmSync(outside, { recursive: true, force: true });
    fs.mkdirSync(outside, { recursive: true });
    const escape = path.join(dataRoot, "escape");
    fs.symlinkSync(outside, escape);
    try {
      const candidate = path.join(escape, "x.jsonl");
      // Lexically it looks contained — this is what the old check saw.
      expect(path.relative(dataRoot, path.resolve(candidate)).startsWith("..")).toBe(false);
      // Resolved through the symlink, it is not.
      expect(isContainedBy(candidate, dataRoot)).toBe(false);
      expect(() => resolveDataPath(candidate, "--output", dataRoot))
        .toThrow(/must name a file inside the harness data directory/);
    } finally {
      fs.rmSync(escape, { force: true });
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });

  it("refuses a corpus document whose file escapes through a symlink", () => {
    const paths = {
      root: path.join(dataRoot, "corpus", "c"),
      documents: "", representations: "", manifest: path.join(dataRoot, "corpus", "c", "manifest.json")
    };
    fs.mkdirSync(path.join(paths.root, "documents"), { recursive: true });
    const outside = path.join(dataRoot, "elsewhere");
    fs.mkdirSync(outside, { recursive: true });
    fs.symlinkSync(outside, path.join(paths.root, "linked"));
    expect(() => resolveCorpusFile(paths, {
      id: "doc", file: path.join("linked", "doc.json")
    } as never)).toThrow(/resolves outside the corpus directory/);
  });
});
