import { kProtectedSpaces, planDeletions } from "./deletion-plan";

const skipped = (over: any = {}) => ({
  key: "k1", classHash: "c1", uid: "u1", hasContent: true, hasMetadata: true,
  reason: "unresolvedCurriculum", createdAt: Date.parse("2023-01-01"), space: "demo/Joe2", ...over
});

// A fixed "now" so the age rule is tested rather than the calendar.
const now = Date.parse("2026-08-25");

describe("planDeletions", () => {
  it("plans both realtime-database nodes for a document that has both halves", () => {
    const { deletions } = planDeletions([skipped()], { now });

    expect(deletions).toEqual([{
      key: "k1", space: "demo/Joe2", reason: "unresolvedCurriculum",
      createdAt: Date.parse("2023-01-01"),
      paths: [
        "/demo/Joe2/portals/demo/classes/c1/users/u1/documents/k1",
        "/demo/Joe2/portals/demo/classes/c1/users/u1/documentMetadata/k1"
      ]
    }]);
  });

  it("plans only the metadata node when the content is already gone", () => {
    const { deletions } = planDeletions([skipped({ hasContent: false, reason: "skippedNoContent" })],
      { now });

    expect(deletions[0].paths).toEqual([
      "/demo/Joe2/portals/demo/classes/c1/users/u1/documentMetadata/k1"
    ]);
  });

  it("plans only the content node when no metadata node exists", () => {
    const { deletions } = planDeletions([skipped({ hasMetadata: false, reason: "nodeUnreadable" })],
      { now });

    expect(deletions[0].paths).toEqual([
      "/demo/Joe2/portals/demo/classes/c1/users/u1/documents/k1"
    ]);
  });

  it("refuses anything in a protected space", () => {
    // Production is never touched by this script. Three of its documents appear in the skip report,
    // and they are student work with no metadata rather than demo debris.
    const { deletions, refused } = planDeletions(
      [skipped({ space: "authed/learn_concord_org" })], { now });

    expect(deletions).toEqual([]);
    expect(refused).toEqual([{ key: "k1", space: "authed/learn_concord_org", reason: "protected space" }]);
  });

  it("protects production by default without being told to", () => {
    expect(kProtectedSpaces).toContain("authed/learn_concord_org");
  });

  it("refuses a document created within the retention window", () => {
    const { deletions, refused } = planDeletions(
      [skipped({ createdAt: Date.parse("2026-06-01") })], { now });

    expect(deletions).toEqual([]);
    expect(refused[0].reason).toMatch(/newer than/);
  });

  it("deletes a document with no createdAt, which cannot be aged but is still debris", () => {
    // The content-without-metadata documents have no node to carry a timestamp. Outside a protected
    // space they are still deletable; inside one they are already refused above.
    const { deletions } = planDeletions([skipped({ createdAt: undefined, hasMetadata: false })],
      { now });

    expect(deletions).toHaveLength(1);
  });

  it("refuses an entry it cannot address rather than guessing a path", () => {
    const { deletions, refused } = planDeletions([skipped({ classHash: "", uid: "u1" })], { now });

    expect(deletions).toEqual([]);
    expect(refused[0].reason).toMatch(/cannot be addressed/);
  });

  it("refuses a document with neither half, which names nothing to delete", () => {
    const { deletions, refused } = planDeletions(
      [skipped({ hasContent: false, hasMetadata: false })], { now });

    expect(deletions).toEqual([]);
    expect(refused[0].reason).toMatch(/nothing to delete/);
  });

  it("refuses a space whose realtime root cannot be derived", () => {
    const { deletions, refused } = planDeletions([skipped({ space: "qa/someRoot" })], { now });

    expect(deletions).toEqual([]);
    expect(refused[0].reason).toMatch(/realtime/i);
  });

  it("builds an authed space's paths from its portal root", () => {
    const { deletions } = planDeletions([skipped({ space: "authed/learn_staging_concord_org" })],
      { now });

    expect(deletions[0].paths[0])
      .toBe("/authed/portals/learn_staging_concord_org/classes/c1/users/u1/documents/k1");
  });

  it("summarises what it plans and what it refused", () => {
    const { summary } = planDeletions([
      skipped(),
      skipped({ key: "k2", space: "authed/learn_concord_org" }),
      skipped({ key: "k3", reason: "skippedNoContent", hasContent: false })
    ], { now });

    expect(summary).toEqual({
      documents: 2, nodes: 3, refused: 1,
      bySpace: { "demo/Joe2": 2 },
      byReason: { unresolvedCurriculum: 1, skippedNoContent: 1 }
    });
  });
});
