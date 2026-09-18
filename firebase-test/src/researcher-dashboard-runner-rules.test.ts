import {
  adminWriteDoc, expectDeleteToFail, expectReadToFail, expectReadToSucceed,
  expectUpdateToFail, expectWriteToFail, expectWriteToSucceed,
  initFirestore, mockTimestamp, network1, noNetwork, offeringId, otherClass, prepareEachTest,
  researcherAuth, researcherId, researcherRunnerAuth, researcherRunnerOtherClassAuth,
  tearDownTests, teacherId, thisClass
} from "./setup-rules-tests";

// The Researcher Dashboard runs a per-researcher MicroVM that reads one class's corpus
// with a researcher token carrying `researcher_dashboard_runner`. Its results go to
// report-service, never here, and the analysis packages it runs are fetched code, so the
// claim must cost the token every write while costing it no read. These tests are paired
// deliberately: each denial for the runner token sits beside the same operation with a
// plain researcher token, because a denial that a plain researcher also gets would prove
// nothing about the claim.
describe("Researcher Dashboard runner claim", () => {
  beforeEach(async () => {
    await prepareEachTest();
  });

  afterAll(async () => {
    await tearDownTests();
  });

  const kDocumentDocPath = "authed/myPortal/documents/myDocument";
  const kHistoryDocPath = `${kDocumentDocPath}/history/myHistoryEntry`;
  const kCommentDocPath = `${kDocumentDocPath}/comments/myComment`;
  const kClassDocPath = `authed/myPortal/classes/${thisClass}`;

  function specDocumentDoc(add: Record<string, unknown> = {}) {
    return {
      context_id: thisClass, network: noNetwork, uid: teacherId,
      type: "problemDocument", key: "my-document", createdAt: mockTimestamp(), ...add
    };
  }

  function specHistoryEntryDoc() {
    const entry = {
      id: "an-id", tree: "my-document", action: "/content/stuff",
      undoable: true, createdAt: mockTimestamp(), records: [], state: "complete"
    };
    return { index: 1, entry: JSON.stringify(entry), created: mockTimestamp(), previousEntryId: "prev-id" };
  }

  describe("reads are unchanged", () => {
    it("reads a document in its class, exactly as a plain researcher token does", async () => {
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc());
      await expectReadToSucceed(initFirestore(researcherAuth), kDocumentDocPath);
      await expectReadToSucceed(initFirestore(researcherRunnerAuth), kDocumentDocPath);
    });

    it("reads a document's history entries", async () => {
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc());
      await adminWriteDoc(kHistoryDocPath, specHistoryEntryDoc());
      await expectReadToSucceed(initFirestore(researcherAuth), kHistoryDocPath);
      await expectReadToSucceed(initFirestore(researcherRunnerAuth), kHistoryDocPath);
    });

    it("still cannot read another class's documents", async () => {
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc({ context_id: otherClass }));
      await expectReadToFail(initFirestore(researcherRunnerAuth), kDocumentDocPath);
    });

    it("a runner token for another class cannot read this class's documents", async () => {
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc());
      await expectReadToFail(initFirestore(researcherRunnerOtherClassAuth), kDocumentDocPath);
    });
  });

  describe("writes are denied", () => {
    it("cannot create a document a plain researcher token can create", async () => {
      await expectWriteToSucceed(initFirestore(researcherAuth), kDocumentDocPath,
        specDocumentDoc({ uid: researcherId }));
      await prepareEachTest();
      await expectWriteToFail(initFirestore(researcherRunnerAuth), kDocumentDocPath,
        specDocumentDoc({ uid: researcherId }));
    });

    it("cannot update a document", async () => {
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc({ uid: researcherId }));
      await expectUpdateToFail(initFirestore(researcherRunnerAuth), kDocumentDocPath, { title: "new-title" });
    });

    it("cannot delete a document it would otherwise own", async () => {
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc({ uid: researcherId }));
      await expectDeleteToFail(initFirestore(researcherRunnerAuth), kDocumentDocPath);
    });

    // The one write path that does not run through the researcher predicates: history
    // creation is granted to any authed member of a concurrent class document.
    it("cannot append history to a concurrent class document", async () => {
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc({
        uid: `class_${thisClass}`, concurrent: true
      }));
      await expectWriteToFail(initFirestore(researcherRunnerAuth), kHistoryDocPath, specHistoryEntryDoc());
    });

    it("cannot create a comment on a document it can read", async () => {
      await adminWriteDoc(kDocumentDocPath, specDocumentDoc());
      await expectWriteToFail(initFirestore(researcherRunnerAuth), kCommentDocPath, {
        uid: researcherId, name: "Rita Researcher", network: noNetwork,
        createdAt: mockTimestamp(), content: "a comment"
      });
    });

    it("cannot create a class document", async () => {
      await expectWriteToFail(initFirestore(researcherRunnerAuth), kClassDocPath, {
        id: thisClass, name: "A class", context_id: thisClass, teacher: "Jane Teacher",
        teachers: [teacherId], uri: "https://example.com/class"
      });
    });
  });
});

// Four guards the commit added had no test, so each could have been deleted with the
// suite still green: the two offering writes, the two canonical slot creates, and the
// write on the portal document itself.
describe("Researcher Dashboard runner claim, the remaining write paths", () => {
  beforeEach(async () => {
    await prepareEachTest();
  });

  afterAll(async () => {
    await tearDownTests();
  });

  const kPortalDocPath = "authed/myPortal";
  const kOfferingDocPath = `authed/myPortal/offerings/${network1}_${offeringId}`;
  const kSlotPath = `authed/myPortal/canonical/v1/classes/${thisClass}` +
    `/offerings/${offeringId}/owners/${researcherId}/slots/canonical`;
  const kUnitSlotPath = `authed/myPortal/canonical/v1/classes/${thisClass}` +
    `/units/abc/owners/${researcherId}/slots/canonical`;

  function specOffering(add: Record<string, unknown> = {}) {
    return {
      id: offeringId, name: "Activity Offering", uri: "https://concord.org/offering",
      context_id: thisClass, teachers: [researcherId], unit: "msa", problem: "1.4",
      problemPath: "msa/1/4", network: noNetwork, ...add
    };
  }

  const pointer = { documentKey: "my-document", createdAt: mockTimestamp(), createdBy: researcherId };

  it("cannot create an offering a plain researcher token can", async () => {
    await expectWriteToSucceed(initFirestore(researcherAuth), kOfferingDocPath, specOffering());
    await prepareEachTest();
    await expectWriteToFail(initFirestore(researcherRunnerAuth), kOfferingDocPath, specOffering());
  });

  it("cannot update an offering", async () => {
    await adminWriteDoc(kOfferingDocPath, specOffering());
    await expectUpdateToFail(initFirestore(researcherRunnerAuth), kOfferingDocPath, { name: "renamed" });
  });

  it("cannot claim a canonical pointer slot under an offering", async () => {
    await expectWriteToSucceed(initFirestore(researcherAuth), kSlotPath, pointer);
    await prepareEachTest();
    await expectWriteToFail(initFirestore(researcherRunnerAuth), kSlotPath, pointer);
  });

  it("cannot claim a canonical pointer slot under a unit", async () => {
    await expectWriteToSucceed(initFirestore(researcherAuth), kUnitSlotPath, pointer);
    await prepareEachTest();
    await expectWriteToFail(initFirestore(researcherRunnerAuth), kUnitSlotPath, pointer);
  });

  // The portal document itself is granted read and write to any teacher or researcher.
  it("cannot write the portal document", async () => {
    await expectWriteToSucceed(initFirestore(researcherAuth), kPortalDocPath, { touched: true });
    await prepareEachTest();
    await expectWriteToFail(initFirestore(researcherRunnerAuth), kPortalDocPath, { touched: true });
  });
});
