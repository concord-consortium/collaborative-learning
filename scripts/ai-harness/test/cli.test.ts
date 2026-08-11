import path from "node:path";
import { harnessRoot } from "../src/corpus.js";
import { parseArgs, resolveDataPath } from "../harness.js";

const known = {
  import: ["from", "corpus", "source", "prune"],
  run: ["corpus", "experiment", "max-cost", "output", "no-cache", "refresh-cache"]
};

describe("argv parsing", () => {
  it("reads --name value pairs", () => {
    expect(parseArgs(["import", "--from", "examples/synthetic-corpus", "--corpus", "demo1"], known))
      .toEqual({ command: "import", flags: { from: "examples/synthetic-corpus", corpus: "demo1" } });
  });

  it("reads boolean flags", () => {
    expect(parseArgs(["import", "--corpus", "demo1", "--prune"], known).flags)
      .toEqual({ corpus: "demo1", prune: true });
  });

  it("rejects an unknown command", () => {
    expect(() => parseArgs(["explode"], known)).toThrow(/Unknown command "explode"/);
  });

  it("rejects an unknown flag", () => {
    expect(() => parseArgs(["import", "--corpuss", "demo1"], known))
      .toThrow(/Unknown flag "--corpuss" for command "import"/);
  });

  it("rejects a flag that belongs to another command", () => {
    expect(() => parseArgs(["import", "--max-cost", "1"], known)).toThrow(/Unknown flag "--max-cost"/);
  });

  it("rejects a value-taking flag with no value", () => {
    expect(() => parseArgs(["import", "--corpus"], known)).toThrow(/Flag "--corpus" needs a value/);
    expect(() => parseArgs(["import", "--corpus", "--prune"], known)).toThrow(/Flag "--corpus" needs a value/);
  });

  it("rejects a repeated flag", () => {
    expect(() => parseArgs(["import", "--corpus", "a", "--corpus", "b"], known))
      .toThrow(/was given more than once/);
  });

  it("rejects a bare positional argument", () => {
    expect(() => parseArgs(["import", "demo1"], known)).toThrow(/Unexpected argument "demo1"/);
  });

  it("rejects no command at all", () => {
    expect(() => parseArgs([], known)).toThrow(/Usage: harness\.ts/);
  });
});

describe("results-path containment", () => {
  const dataRoot = path.join(harnessRoot, "data");
  const resolve = (value: string) => resolveDataPath(value, "--output", dataRoot);

  it("resolves a relative path against the harness directory, as the README writes them", () => {
    // Same base as --from and --experiment, so `data/results/x.jsonl` means what it looks like.
    expect(resolve("data/results/text-baselines.jsonl"))
      .toBe(path.join(dataRoot, "results", "text-baselines.jsonl"));
  });

  it("accepts an absolute path that is already inside the data root", () => {
    const inside = path.join(dataRoot, "results", "run.jsonl");
    expect(resolve(inside)).toBe(inside);
  });

  it.each([
    ["../escape.jsonl"],
    ["data/results/../../../escape.jsonl"],
    ["/tmp/escape.jsonl"],
    [".."],
    ["results/not-under-data.jsonl"]
  ])("refuses %s, which would write student work outside data/", (output) => {
    expect(() => resolve(output)).toThrow(/must name a file inside the harness data directory/);
  });

  it("refuses the data root itself", () => {
    expect(() => resolve(dataRoot)).toThrow(/must name a file inside/);
  });

  it("names the flag it is complaining about and suggests a valid path", () => {
    expect(() => resolveDataPath("../x.jsonl", "--results", dataRoot))
      .toThrow(/--results must name a file inside .*Try a path like "data\/results\/my-run\.jsonl"/s);
  });
});
