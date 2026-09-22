import { checkSkipReport, parseDeletionSettings, runDeletions } from "./delete-unrepairable-documents";
import type { IDeletionPlan, IPlannedDeletion, ISkipReport } from "./lib/deletion-plan";

const kDayMs = 24 * 60 * 60 * 1000;

describe("parseDeletionSettings", () => {
  it("defaults to a dry run with a year's retention and a 24h report limit", () => {
    expect(parseDeletionSettings({}))
      .toEqual({ dryRun: true, retentionMs: 365 * kDayMs, maxReportAgeHours: 24 });
  });

  it("applies only when APPLY is exactly 1", () => {
    expect(parseDeletionSettings({ APPLY: "1" }).dryRun).toBe(false);
    expect(parseDeletionSettings({ APPLY: "true" }).dryRun).toBe(true);
  });

  it("reads both limits", () => {
    const settings = parseDeletionSettings({ RETENTION_DAYS: "730", MAX_REPORT_AGE_HOURS: "48" });
    expect(settings.retentionMs).toBe(730 * kDayMs);
    expect(settings.maxReportAgeHours).toBe(48);
  });

  it("accepts zero, which tightens rather than disables", () => {
    expect(parseDeletionSettings({ RETENTION_DAYS: "0" }).retentionMs).toBe(0);
    expect(parseDeletionSettings({ MAX_REPORT_AGE_HOURS: "0" }).maxReportAgeHours).toBe(0);
  });

  it("refuses a value it cannot read, which would otherwise disable the guard", () => {
    // NaN compares false against everything, so "48h" would switch the staleness check off.
    expect(() => parseDeletionSettings({ MAX_REPORT_AGE_HOURS: "48h" })).toThrow(/MAX_REPORT_AGE_HOURS/);
    expect(() => parseDeletionSettings({ MAX_REPORT_AGE_HOURS: "2days" })).toThrow(/MAX_REPORT_AGE_HOURS/);
    expect(() => parseDeletionSettings({ RETENTION_DAYS: "a year" })).toThrow(/RETENTION_DAYS/);
  });

  it("refuses a negative value", () => {
    expect(() => parseDeletionSettings({ MAX_REPORT_AGE_HOURS: "-1" })).toThrow(/MAX_REPORT_AGE_HOURS/);
    expect(() => parseDeletionSettings({ RETENTION_DAYS: "-1" })).toThrow(/RETENTION_DAYS/);
  });
});

describe("checkSkipReport", () => {
  const kHourMs = 60 * 60 * 1000;
  const now = 1_800_000_000_000;
  const current = { projectId: "p", databaseURL: "https://p.firebaseio.com", now };
  const record = { key: "k", classHash: "c", uid: "u", hasContent: false, hasMetadata: true,
    reason: "skippedNoContent", space: "demo/S" };
  const report = (overrides: Partial<ISkipReport> = {}): ISkipReport => ({
    generatedAt: now - kHourMs, projectId: "p", databaseURL: "https://p.firebaseio.com",
    dryRun: true, spaces: null, skipped: [record], ...overrides
  });
  const apply = parseDeletionSettings({ APPLY: "1" });
  const dryRun = parseDeletionSettings({});

  it("returns the records of a fresh dry-run report for this project", () => {
    expect(checkSkipReport(report(), current, apply)).toEqual([record]);
  });

  it("accepts a filtered report, which can only under-delete", () => {
    expect(checkSkipReport(report({ spaces: ["demo/S"] }), current, apply)).toEqual([record]);
  });

  it("refuses a report with no run details", () => {
    expect(() => checkSkipReport([record] as any, current, dryRun)).toThrow(/which run wrote it/);
  });

  it("refuses a report written against another project or database", () => {
    // Otherwise every record reads as already gone, and the run reports a clean no-op.
    expect(() => checkSkipReport(report({ projectId: "other" }), current, dryRun)).toThrow(/other/);
    expect(() => checkSkipReport(report({ databaseURL: "https://x" }), current, dryRun)).toThrow(/https:\/\/x/);
  });

  it("refuses a report written by an apply run", () => {
    // The residue must be confirmed by the dry run after the repair, not predicted by the repair.
    expect(() => checkSkipReport(report({ dryRun: false }), current, apply)).toThrow(/apply run/);
  });

  it("refuses a report over the age limit when applying", () => {
    expect(() => checkSkipReport(report({ generatedAt: now - 25 * kHourMs }), current, apply))
      .toThrow(/25\.0h old/);
  });

  it("refuses a report with no readable timestamp when applying", () => {
    expect(() => checkSkipReport(report({ generatedAt: undefined as any }), current, apply)).toThrow(/old/);
  });

  it("allows a dry run to read an old report, since it removes nothing", () => {
    expect(checkSkipReport(report({ generatedAt: now - 1000 * kHourMs }), current, dryRun)).toEqual([record]);
  });
});

describe("runDeletions", () => {
  const deletion = (key: string, paths: string[]): IPlannedDeletion =>
    ({ key, space: "demo/S", reason: "skippedNoContent", paths });
  const plan = (...deletions: IPlannedDeletion[]) => ({ deletions } as IDeletionPlan);
  const both = deletion("both", ["/content/both", "/metadata/both"]);
  const one = deletion("one", ["/metadata/one"]);

  it("removes every node of a document still deletable, content first", async () => {
    const removeNode = jest.fn(async () => undefined);
    const result = await runDeletions(plan(both, one), { dryRun: false },
      { stillDeletable: async () => undefined, removeNode, log: () => undefined });
    expect(removeNode.mock.calls).toEqual([["/content/both"], ["/metadata/both"], ["/metadata/one"]]);
    expect(result).toEqual({ deletedDocuments: 2, deletedNodes: 3, changed: [] });
  });

  it("removes nothing on a dry run, but counts what it would", async () => {
    const removeNode = jest.fn(async () => undefined);
    const result = await runDeletions(plan(both, one), { dryRun: true },
      { stillDeletable: async () => undefined, removeNode });
    expect(removeNode).not.toHaveBeenCalled();
    expect(result).toEqual({ deletedDocuments: 2, deletedNodes: 3, changed: [] });
  });

  it("leaves a document that changed since the report alone, and says why", async () => {
    const removeNode = jest.fn(async () => undefined);
    const stillDeletable = async (d: IPlannedDeletion) =>
      d.key === "both" ? "it now has Firestore metadata" : undefined;
    const result = await runDeletions(plan(both, one), { dryRun: false }, { stillDeletable, removeNode });
    expect(removeNode.mock.calls).toEqual([["/metadata/one"]]);
    expect(result.changed).toEqual([{ key: "both", space: "demo/S", why: "it now has Firestore metadata" }]);
  });

  it("counts only the removals that resolved when one fails", async () => {
    // A crash mid-document must understate what was deleted, never overstate it.
    const removeNode = jest.fn(async (path: string) => {
      if (path === "/metadata/both") throw new Error("network");
    });
    const err: any = await runDeletions(plan(both, one), { dryRun: false },
      { stillDeletable: async () => undefined, removeNode }).catch(e => e);
    expect(err.message).toBe("network");
    expect(err.result).toEqual({ deletedDocuments: 0, deletedNodes: 1, changed: [] });
    expect(removeNode).toHaveBeenCalledTimes(2);
  });
});
