import firebase from "firebase";
import {
  expectDeleteToFail, expectReadToFail, expectReadToSucceed, expectWriteToFail, expectWriteToSucceed,
  genericAuth, initFirestore, prepareEachTest, tearDownTests
} from "./setup-rules-tests";

describe("Firestore security rules: seismic event database", () => {

  let db: firebase.firestore.Firestore;

  const kModelPath = "services/seismic/stations/AK_K204/locations/00/channels/BHZ/models/compact-v1";
  const kEventPath = `${kModelPath}/events/1710720000000_earthquake`;
  const kCoveragePath = `${kModelPath}/coverage/76`;

  const validEvent = () => ({
    station: "AK_K204", location: "00", channel: "BHZ", model: "compact-v1",
    windowStart: firebase.firestore.Timestamp.fromMillis(1710720000000),
    windowEnd: firebase.firestore.Timestamp.fromMillis(1710720060000),
    eventType: "earthquake", confidence: 0.9,
    createdBy: genericAuth.uid,
    createdAt: firebase.firestore.Timestamp.now()
  });

  const validCoverage = () => ({
    bitmap: firebase.firestore.Blob.fromUint8Array(new Uint8Array(540)),
    updatedAt: firebase.firestore.Timestamp.now()
  });

  beforeEach(async () => {
    await prepareEachTest();
  });

  afterAll(async () => {
    await tearDownTests();
  });

  describe("events", () => {
    it("unauthenticated users cannot read or write events", async () => {
      db = initFirestore();
      await expectReadToFail(db, kEventPath);
      await expectWriteToFail(db, kEventPath, validEvent());
    });

    it("an authenticated (anonymous) user can write a valid event and read it back", async () => {
      db = initFirestore(genericAuth);
      await expectWriteToSucceed(db, kEventPath, validEvent());
      await expectReadToSucceed(db, kEventPath);
    });

    it("rejects an event whose createdBy is not the requesting uid", async () => {
      db = initFirestore(genericAuth);
      await expectWriteToFail(db, kEventPath, { ...validEvent(), createdBy: "someone-else" });
    });

    it("rejects an event whose denormalized fields don't match the path", async () => {
      db = initFirestore(genericAuth);
      await expectWriteToFail(db, kEventPath, { ...validEvent(), station: "AK_OTHER" });
      await expectWriteToFail(db, kEventPath, { ...validEvent(), location: "10" });
      await expectWriteToFail(db, kEventPath, { ...validEvent(), channel: "BNZ" });
      await expectWriteToFail(db, kEventPath, { ...validEvent(), model: "other-model" });
    });

    it("does not allow deleting events", async () => {
      db = initFirestore(genericAuth);
      await expectWriteToSucceed(db, kEventPath, validEvent());
      await expectDeleteToFail(db, kEventPath);
    });

    // The design doc dedupes events by deterministic doc id, so a second user re-detecting the
    // same event overwrites the existing doc — the rules intentionally allow that.
    it("allows a different authenticated user to overwrite an existing event", async () => {
      db = initFirestore(genericAuth);
      await expectWriteToSucceed(db, kEventPath, validEvent());
      const secondAuth = { uid: "user-generic-2" };
      db = initFirestore(secondAuth);
      await expectWriteToSucceed(db, kEventPath, { ...validEvent(), createdBy: secondAuth.uid });
    });
  });

  describe("coverage", () => {
    it("unauthenticated users cannot read or write coverage", async () => {
      db = initFirestore();
      await expectReadToFail(db, kCoveragePath);
      await expectWriteToFail(db, kCoveragePath, validCoverage());
    });

    it("an authenticated user can write valid coverage and read it back", async () => {
      db = initFirestore(genericAuth);
      await expectWriteToSucceed(db, kCoveragePath, validCoverage());
      await expectReadToSucceed(db, kCoveragePath);
    });

    it("rejects coverage with a non-bytes bitmap, non-timestamp updatedAt, or missing updatedAt", async () => {
      db = initFirestore(genericAuth);
      await expectWriteToFail(db, kCoveragePath, { ...validCoverage(), bitmap: [1, 2, 3] });
      await expectWriteToFail(db, kCoveragePath, { ...validCoverage(), updatedAt: "not-a-timestamp" });
      await expectWriteToFail(db, kCoveragePath, { bitmap: validCoverage().bitmap });
    });

    it("does not allow deleting coverage", async () => {
      db = initFirestore(genericAuth);
      await expectWriteToSucceed(db, kCoveragePath, validCoverage());
      await expectDeleteToFail(db, kCoveragePath);
    });
  });
});
