import {
  adminWriteRtdb, clearRtdb, expectRtdbReadToFail, expectRtdbReadToSucceed,
  expectRtdbWriteToFail, expectRtdbWriteToSucceed, initDatabase, kRtdbPortal,
  otherClass, researcherAuth, researcherId, researcherRunnerAuth,
  researcherRunnerOtherClassAuth, tearDownTests, thisClass
} from "./setup-rules-tests";

// CLUE keeps document content in the Realtime Database, so the runner reads it there and
// the deny has to hold there too. These mirror the Firestore tests: each denial for the
// runner token sits beside the same write under a plain researcher token, because the
// class rule grants writes to every class member and a denial both tokens get would prove
// nothing about the claim.
describe("Researcher Dashboard runner claim (RTDB)", () => {
  const classPath = (portal: string, classHash: string) =>
    `/authed/portals/${portal}/classes/${classHash}`;
  const base = classPath(kRtdbPortal, thisClass);
  const contentPath = `${base}/users/${researcherId}/documents/doc-1`;
  const metadataPath = `${base}/users/${researcherId}/documentMetadata/doc-1`;
  const groupIdPath = `${base}/users/${researcherId}/latestGroupId`;

  beforeEach(async () => {
    await clearRtdb();
    await adminWriteRtdb(contentPath, { content: JSON.stringify({ tileMap: {} }), changeCount: 1 });
    await adminWriteRtdb(metadataPath, { offeringId: "1246", type: "problem" });
    await adminWriteRtdb(groupIdPath, "group-1");
  });

  afterAll(async () => {
    await tearDownTests();
  });

  describe("reads are unchanged", () => {
    it("reads document content, exactly as a plain researcher token does", async () => {
      await expectRtdbReadToSucceed(initDatabase(researcherAuth), contentPath);
      await expectRtdbReadToSucceed(initDatabase(researcherRunnerAuth), contentPath);
    });

    it("reads documentMetadata", async () => {
      await expectRtdbReadToSucceed(initDatabase(researcherRunnerAuth), metadataPath);
    });

    it("reads the whole class subtree, which is how the runner pulls it in one round trip", async () => {
      await expectRtdbReadToSucceed(initDatabase(researcherRunnerAuth), base);
    });

    it("cannot read another class's subtree", async () => {
      await expectRtdbReadToFail(initDatabase(researcherRunnerOtherClassAuth), base);
      await expectRtdbReadToFail(initDatabase(researcherRunnerAuth), classPath(kRtdbPortal, otherClass));
    });
  });

  describe("writes are denied", () => {
    it("cannot overwrite document content a plain researcher token can", async () => {
      await expectRtdbWriteToSucceed(initDatabase(researcherAuth), contentPath, { content: "{}", changeCount: 2 });
      await expectRtdbWriteToFail(initDatabase(researcherRunnerAuth), contentPath, { content: "{}", changeCount: 3 });
    });

    it("cannot overwrite documentMetadata", async () => {
      await expectRtdbWriteToSucceed(initDatabase(researcherAuth), metadataPath, { offeringId: "9" });
      await expectRtdbWriteToFail(initDatabase(researcherRunnerAuth), metadataPath, { offeringId: "9" });
    });

    // latestGroupId carries its own `.write`, and in the RTDB a rule granted lower down
    // overrides a denial above it, so the guard on the class node does not reach it.
    it("cannot write latestGroupId, which its own rule below the class node grants", async () => {
      await expectRtdbWriteToSucceed(initDatabase(researcherAuth), groupIdPath, "group-2");
      await expectRtdbWriteToFail(initDatabase(researcherRunnerAuth), groupIdPath, "group-3");
    });

    it("cannot write at the class node itself", async () => {
      await expectRtdbWriteToFail(initDatabase(researcherRunnerAuth), `${base}/probe`, { at: 1 });
    });
  });

  // The rules name each portal explicitly rather than matching a wildcard, so a portal in
  // the file without the guard would be a write path the claim does not cover.
  describe("every portal is guarded", () => {
    const portals = ["localhost:3000", "learn_concord_org", "learn_staging_concord_org",
                     "learn_portal_staging_concord_org", "learn-migrate_concord_org"];

    portals.forEach(portal => {
      it(`denies a runner write under ${portal}, and allows a plain researcher one`, async () => {
        const path = `${classPath(portal, thisClass)}/users/${researcherId}/documents/doc-2`;
        await expectRtdbWriteToSucceed(initDatabase(researcherAuth), path, { content: "{}" });
        await expectRtdbWriteToFail(initDatabase(researcherRunnerAuth), path, { content: "{}" });
      });
    });
  });
});
