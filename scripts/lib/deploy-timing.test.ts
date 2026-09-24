import {
  cannotTouchFunctions, checkDeployTiming, deployablesTouched, deployTimingPasses, isNotDeployed, parseDeployTiming,
  rollupDeployTiming
} from "./deploy-timing";

const kFunctionsSources = new Set([
  "functions-v2/src/index.ts",
  "shared/ai-summarizer/ai-summarizer.ts"
]);

describe("isNotDeployed", () => {
  it("recognizes tests and docs", () => {
    expect(isNotDeployed("functions-v2/test/utils.test.ts")).toBe(true);
    expect(isNotDeployed("shared/fl-packet/packet.test.ts")).toBe(true);
    expect(isNotDeployed("shared/__snapshots__/render-page.test.ts.snap")).toBe(true);
    expect(isNotDeployed("functions-v2/README.md")).toBe(true);
    expect(isNotDeployed("functions-v2/src/index.ts")).toBe(false);
  });
});

describe("deployablesTouched", () => {
  it("finds rules and indexes by file name", () => {
    expect(deployablesTouched(["firestore.rules"], kFunctionsSources)).toEqual(["rules"]);
    expect(deployablesTouched(["database.rules.json"], kFunctionsSources)).toEqual(["rules"]);
    expect(deployablesTouched(["firestore.indexes.json"], kFunctionsSources)).toEqual(["indexes"]);
  });
  it("counts any deployed file in a functions codebase", () => {
    expect(deployablesTouched(["functions-v2/package.json"], kFunctionsSources)).toEqual(["functions"]);
    expect(deployablesTouched(["functions-v1/src/get-image-data.ts"], kFunctionsSources)).toEqual(["functions"]);
    expect(deployablesTouched(["authoring-api/src/app.ts"], kFunctionsSources)).toEqual(["functions"]);
  });
  it("counts a shared file only when the functions compile it", () => {
    expect(deployablesTouched(["shared/ai-summarizer/ai-summarizer.ts"], kFunctionsSources)).toEqual(["functions"]);
    expect(deployablesTouched(["shared/client-only.ts"], kFunctionsSources)).toEqual([]);
    expect(deployablesTouched(["shared/package-lock.json"], kFunctionsSources)).toEqual(["functions"]);
  });
  it("ignores tests, docs and client code", () => {
    const files = ["functions-v2/test/utils.test.ts", "functions-v2/README.md", "src/components/app.tsx"];
    expect(deployablesTouched(files, kFunctionsSources)).toEqual([]);
  });
  it("reports several deployables in a fixed order", () => {
    const files = ["firestore.indexes.json", "functions-v2/src/index.ts", "firestore.rules"];
    expect(deployablesTouched(files, kFunctionsSources)).toEqual(["functions", "rules", "indexes"]);
  });
});

describe("cannotTouchFunctions", () => {
  it("is true only when nothing could reach the functions", () => {
    expect(cannotTouchFunctions(["src/app.tsx", "firestore.rules", "functions-v2/test/a.test.ts"])).toBe(true);
    expect(cannotTouchFunctions(["shared/anything.ts"])).toBe(false);
    expect(cannotTouchFunctions(["functions-v2/src/index.ts"])).toBe(false);
  });
});

const kBody = [
  "Implements the empty-document skip.",
  "",
  "> [!IMPORTANT]",
  "> **Deploy timing**",
  "> - **functions: with** — the released client waits for a comment that is never posted,",
  ">   so Ideas on an empty document looks frozen.",
  "> - **rules: before** — only widens what chat messages may contain.",
  "",
  "## Testing"
].join("\r\n");

describe("parseDeployTiming", () => {
  it("reads entries and multi-line rationales from the callout", () => {
    expect(parseDeployTiming(kBody)).toEqual({
      found: true,
      invalid: [],
      entries: [
        {
          deployable: "functions", timing: "with",
          rationale: "the released client waits for a comment that is never posted, " +
            "so Ideas on an empty document looks frozen."
        },
        { deployable: "rules", timing: "before", rationale: "only widens what chat messages may contain." }
      ]
    });
  });
  it("accepts any GitHub alert type and other separators", () => {
    const body = "> [!WARNING]\n> **Deploy timing**\n> - **indexes: after** - the old index is still queried";
    expect(parseDeployTiming(body).entries)
      .toEqual([{ deployable: "indexes", timing: "after", rationale: "the old index is still queried" }]);
  });
  it("ignores entry-like lines outside the callout", () => {
    const body = "- **functions: before** — not in a callout\n\n> **functions: before** — a plain quote";
    expect(parseDeployTiming(body)).toEqual({ found: false, entries: [], invalid: [] });
  });
  it("requires the heading to be the callout's first line", () => {
    const body = "> [!IMPORTANT]\n> Some other note\n> **Deploy timing**\n> - **functions: with** — why";
    expect(parseDeployTiming(body).found).toBe(false);
  });
  it("stops at the end of the callout", () => {
    const body = "> [!NOTE]\n> **Deploy timing**\n> - **rules: before** — why\n\n> - **functions: with** — later quote";
    expect(parseDeployTiming(body).entries.map(entry => entry.deployable)).toEqual(["rules"]);
  });
  it("reports entries with an unknown part or timing", () => {
    const body = "> [!IMPORTANT]\n> **Deploy timing**\n> - **function: soon** — typo";
    expect(parseDeployTiming(body)).toEqual({
      found: true, entries: [], invalid: ["> - **function: soon** — typo"]
    });
  });
  it("records an entry with no rationale", () => {
    const body = "> [!IMPORTANT]\n> **Deploy timing**\n> - **rules: before**";
    expect(parseDeployTiming(body).entries).toEqual([{ deployable: "rules", timing: "before", rationale: "" }]);
  });
});

describe("checkDeployTiming", () => {
  it("passes when each touched part has one entry with a rationale", () => {
    const check = checkDeployTiming(["functions", "rules"], parseDeployTiming(kBody));
    expect(check).toMatchObject({ missing: [], noRationale: [], duplicated: [], invalid: [], unneeded: [] });
    expect(deployTimingPasses(check)).toBe(true);
  });
  it("passes a change that touches nothing, with or without a callout", () => {
    expect(deployTimingPasses(checkDeployTiming([], parseDeployTiming("")))).toBe(true);
  });
  it("fails without a callout", () => {
    const check = checkDeployTiming(["rules"], parseDeployTiming("- **rules: before** — why"));
    expect(check.found).toBe(false);
    expect(deployTimingPasses(check)).toBe(false);
  });
  it("reports a missing part", () => {
    const check = checkDeployTiming(["functions", "indexes"], parseDeployTiming(kBody));
    expect(check.missing).toEqual(["indexes"]);
    expect(deployTimingPasses(check)).toBe(false);
  });
  it("reports a missing rationale", () => {
    const body = "> [!NOTE]\n> **Deploy timing**\n> - **rules: with**";
    const check = checkDeployTiming(["rules"], parseDeployTiming(body));
    expect(check.noRationale).toEqual(["rules"]);
    expect(deployTimingPasses(check)).toBe(false);
  });
  it("reports a part given twice", () => {
    const body = "> [!NOTE]\n> **Deploy timing**\n> - **rules: before** — a\n> - **rules: after** — b";
    const check = checkDeployTiming(["rules"], parseDeployTiming(body));
    expect(check.duplicated).toEqual(["rules"]);
    expect(deployTimingPasses(check)).toBe(false);
  });
  it("fails on an invalid entry and notes entries for untouched parts", () => {
    const body = "> [!NOTE]\n> **Deploy timing**\n> - **rules: before** — a\n> - **indexes: soon** — b";
    const check = checkDeployTiming(["rules"], parseDeployTiming(body));
    expect(check.invalid).toEqual(["> - **indexes: soon** — b"]);
    expect(deployTimingPasses(check)).toBe(false);
    const extra = checkDeployTiming(["functions"], parseDeployTiming(kBody));
    expect(extra.unneeded).toEqual(["rules"]);
    expect(deployTimingPasses(extra)).toBe(true);
  });
});

describe("rollupDeployTiming", () => {
  const callout = (...entries: string[]) =>
    parseDeployTiming(["> [!IMPORTANT]", "> **Deploy timing**", ...entries.map(e => `> - ${e}`)].join("\n"));

  it("takes the strictest timing per part and lists PRs without an entry", () => {
    const rollup = rollupDeployTiming([
      { number: 1, author: "a", title: "one", touched: ["functions", "rules"],
        timing: callout("**functions: before** — safe", "**rules: before** — widens only") },
      { number: 2, author: "b", title: "two", touched: ["functions"],
        timing: callout("**functions: with** — released client looks frozen") },
      { number: 3, author: "c", title: "three", touched: ["functions"], timing: callout() }
    ]);
    expect(rollup).toEqual([
      {
        deployable: "functions", timing: "with",
        entries: [
          { number: 1, author: "a", timing: "before", rationale: "safe" },
          { number: 2, author: "b", timing: "with", rationale: "released client looks frozen" }
        ],
        missing: [{ number: 3, author: "c", title: "three" }]
      },
      {
        deployable: "rules", timing: "before",
        entries: [{ number: 1, author: "a", timing: "before", rationale: "widens only" }],
        missing: []
      }
    ]);
  });
  it("leaves the timing undecided when no PR gave one, and omits untouched parts", () => {
    const rollup = rollupDeployTiming([
      { number: 4, author: "d", title: "four", touched: ["indexes"], timing: callout() }
    ]);
    expect(rollup).toEqual([
      { deployable: "indexes", entries: [], missing: [{ number: 4, author: "d", title: "four" }] }
    ]);
  });
});
