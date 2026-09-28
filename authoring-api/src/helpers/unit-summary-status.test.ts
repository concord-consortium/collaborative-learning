import {AssembledUnit} from "./assemble-unit";
import {computeUnitSummaryStatus} from "./unit-summary-status";

function assembledUnit(): AssembledUnit {
  return {
    sourceHash: "unit-hash",
    sourceManifest: [
      {ordinal: "1.1", title: "First", problemHash: "hash-1"},
      {ordinal: "1.2", title: "Second", problemHash: "hash-2"},
    ],
    problems: [
      {ordinal: "1.1", title: "First", markdown: "x".repeat(100), problemHash: "hash-1"},
      {ordinal: "1.2", title: "Second", markdown: "x".repeat(250), problemHash: "hash-2"},
    ],
  };
}

describe("computeUnitSummaryStatus", () => {
  it("passes through sourceHash and sourceManifest unchanged", () => {
    const assembled = assembledUnit();
    const status = computeUnitSummaryStatus(assembled);
    expect(status.sourceHash).toBe(assembled.sourceHash);
    expect(status.sourceManifest).toEqual(assembled.sourceManifest);
  });

  it("reports each problem's Markdown length, in order, without including the Markdown itself", () => {
    const status = computeUnitSummaryStatus(assembledUnit());
    expect(status.problemSizes).toEqual([
      {ordinal: "1.1", markdownLength: 100},
      {ordinal: "1.2", markdownLength: 250},
    ]);
    expect(JSON.stringify(status)).not.toContain("x".repeat(100));
  });
});
