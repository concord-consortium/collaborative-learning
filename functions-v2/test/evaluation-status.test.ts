import {getDatabase} from "firebase-admin/database";
import {initialize} from "./initialize";
import {kStatusRetentionMs, writeEvaluationStatus} from "../src/evaluation-status";

const {cleanup} = initialize();

const metadataPath = "demo/AI/portals/demo/classes/democlass1/users/1/documentMetadata/testdoc1";
const evaluator = "categorize-design";

const statusAt = (requestId: string) =>
  getDatabase().ref(`${metadataPath}/evaluationStatus/${evaluator}/${requestId}`)
    .once("value").then((snapshot) => snapshot.val());

describe("writeEvaluationStatus", () => {
  beforeEach(async () => {
    await getDatabase().ref(metadataPath).set(null);
  });

  afterAll(async () => {
    await cleanup();
  });

  it("writes statuses for two requests on the same document under two different children", async () => {
    await writeEvaluationStatus(metadataPath, evaluator, {
      outcome: "commented", requestId: "req-a", docUpdated: "1001",
    });
    await writeEvaluationStatus(metadataPath, evaluator, {
      outcome: "skipped-empty", requestId: "req-b", docUpdated: "1002",
    });

    expect(await statusAt("req-a")).toMatchObject({outcome: "commented", requestId: "req-a"});
    expect(await statusAt("req-b")).toMatchObject({outcome: "skipped-empty", requestId: "req-b"});
  });

  it("writing an older request's status after a newer one's leaves the newer one's child untouched", async () => {
    await writeEvaluationStatus(metadataPath, evaluator, {
      outcome: "commented", requestId: "req-b", docUpdated: "1002",
    });
    await writeEvaluationStatus(metadataPath, evaluator, {
      outcome: "skipped-empty", requestId: "req-a", docUpdated: "1001",
    });

    expect(await statusAt("req-b")).toMatchObject({outcome: "commented", requestId: "req-b"});
    expect(await statusAt("req-a")).toMatchObject({outcome: "skipped-empty", requestId: "req-a"});
  });

  it("a status with no request id lands under \"automatic\"", async () => {
    await writeEvaluationStatus(metadataPath, evaluator, {
      outcome: "skipped-empty", docUpdated: "1001",
    });

    const status = await statusAt("automatic");
    expect(status).toMatchObject({outcome: "skipped-empty", docUpdated: "1001"});
    expect(status).not.toHaveProperty("requestId");
  });

  it("prunes a sibling older than the retention window, but not a recent one", async () => {
    const evaluationStatusPath = `${metadataPath}/evaluationStatus/${evaluator}`;
    await getDatabase().ref(`${evaluationStatusPath}/req-old`).set({
      outcome: "commented", requestId: "req-old", docUpdated: "999",
      completedAt: Date.now() - kStatusRetentionMs - 1,
    });
    await getDatabase().ref(`${evaluationStatusPath}/req-recent`).set({
      outcome: "commented", requestId: "req-recent", docUpdated: "1000", completedAt: Date.now(),
    });

    await writeEvaluationStatus(metadataPath, evaluator, {
      outcome: "commented", requestId: "req-new", docUpdated: "1001",
    });

    expect(await statusAt("req-old")).toBeNull();
    expect(await statusAt("req-recent")).toMatchObject({outcome: "commented", requestId: "req-recent"});
    expect(await statusAt("req-new")).toMatchObject({outcome: "commented", requestId: "req-new"});
  });
});
