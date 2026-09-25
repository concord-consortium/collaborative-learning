import {
  clearFirestoreData, makeDocumentSnapshot,
} from "firebase-functions-test/lib/providers/firestore";
import * as dotenv from "dotenv";
import * as path from "path";
import {getFirestore} from "firebase-admin/firestore";
import {initialize, projectConfig} from "./initialize";
import {onClassDataDocWritten} from "../src/on-class-data-doc-written";
import {getUnitSummary, IUnitSummaryFetchResult} from "../../shared/get-unit-summary";
import {IUnitSummary, UNIT_SUMMARY_LOOKAHEAD_INSTRUCTION} from "../../shared/unit-summary-types";

jest.mock("firebase-functions/logger");
jest.mock("../../shared/get-unit-summary");

const mockInvoke = jest.fn();
jest.mock("@langchain/openai", () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({invoke: mockInvoke})),
}));

const {cleanup} = initialize();

// The emulator should pick up a local value for the secret from this file, to avoid the local user needing
// permissions to access the actual secret in the cloud. See on-analysis-document-imaged.test.ts.
dotenv.config({
  path: path.resolve(__dirname, "../.secret.local"),
});

const mockGetUnitSummary = getUnitSummary as jest.MockedFunction<typeof getUnitSummary>;

const kClassDataDocPath = "demo/AITEST/aicontent/qa-config-subtabs/classes/class-hash";
const kParams = {realm: "demo", realmId: "AITEST", unit: "qa-config-subtabs", classId: "class-hash"};

const kSummary: IUnitSummary = {
  generatedAt: "2026-01-01T00:00:00.000Z",
  sourceHash: "h",
  overview: "OVERVIEW_TEXT_SHOULD_NEVER_REACH_A_REQUEST",
  sourceManifest: [
    {ordinal: "1.1", title: "Problem 1.1", problemHash: "h1"},
    {ordinal: "1.2", title: "Problem 1.2", problemHash: "h2"},
  ],
  entries: [
    {ordinal: "1.1", priorKnowledge: "", problemDigest: "digest one"},
    {ordinal: "1.2", priorKnowledge: "knows things", problemDigest: "digest two"},
  ],
};

function unitSummaryResult(): IUnitSummaryFetchResult {
  return {
    summary: kSummary,
    liveProblems: [{ordinal: "1.1", title: "Problem 1.1"}, {ordinal: "1.2", title: "Problem 1.2"}],
  };
}

function invokeResponse(summary: string) {
  return {content: summary, usage_metadata: {total_tokens: 10}};
}

// Long enough (with markdown paragraph breaks the splitter can use) to produce more than one
// chunk at the module's chunkSize (64,000 characters), so combineSummaries actually runs.
function longStudentContent(): string {
  const paragraph = "This is a paragraph of student work repeated many times to exceed the chunk size.";
  return Array(2000).fill(paragraph).join("\n\n");
}

async function writeAndTrigger(content: Record<string, unknown>) {
  // event.data.after.ref.update(...) needs a document that really exists in the emulator;
  // makeDocumentSnapshot's .data() is only what we hand it, but its .ref is real.
  await getFirestore().doc(kClassDataDocPath).set(content);
  await onClassDataDocWritten.run({
    subject: kClassDataDocPath,
    data: {
      before: makeDocumentSnapshot({}, kClassDataDocPath),
      after: makeDocumentSnapshot(content, kClassDataDocPath),
    },
    params: kParams,
  } as any);
}

function systemMessageOf(callIndex: number): string {
  return mockInvoke.mock.calls[callIndex][0][0].content;
}

function humanMessageOf(callIndex: number): string {
  return mockInvoke.mock.calls[callIndex][0][1].content;
}

describe("onClassDataDocWritten", () => {
  beforeEach(async () => {
    await clearFirestoreData(projectConfig);
    mockGetUnitSummary.mockReset();
    mockInvoke.mockReset();
  });

  afterAll(async () => {
    await cleanup();
  });

  test("per-chunk requests (student and teacher) carry the slice and the instruction", async () => {
    mockGetUnitSummary.mockResolvedValue(unitSummaryResult());
    mockInvoke
      .mockResolvedValueOnce(invokeResponse("student chunk summary"))
      .mockResolvedValueOnce(invokeResponse("teacher chunk summary"));

    await writeAndTrigger({
      studentContent: "Short student work.",
      teacherContent: "Short teacher work.",
      currentProblemOrdinal: "1.1",
    });

    expect(mockInvoke).toHaveBeenCalledTimes(2);
    for (const callIndex of [0, 1]) {
      expect(systemMessageOf(callIndex)).toContain(UNIT_SUMMARY_LOOKAHEAD_INSTRUCTION);
      expect(humanMessageOf(callIndex)).toContain("digest one");
      expect(humanMessageOf(callIndex)).toContain("digest two");
      expect(humanMessageOf(callIndex)).toContain("<curriculum-context>");
    }
  });

  test("a multi-chunk fixture's combineSummaries request also carries the slice and the instruction", async () => {
    mockGetUnitSummary.mockResolvedValue(unitSummaryResult());
    // Every summarizeChunk call before combineSummaries, plus combineSummaries itself, resolves
    // with the same canned response -- only the last (combineSummaries) call is asserted on.
    mockInvoke.mockResolvedValue(invokeResponse("a chunk summary"));

    await writeAndTrigger({
      studentContent: longStudentContent(),
      currentProblemOrdinal: "1.1",
    });

    expect(mockInvoke.mock.calls.length).toBeGreaterThan(1);
    const lastCall = mockInvoke.mock.calls.length - 1;
    expect(systemMessageOf(lastCall)).toContain(UNIT_SUMMARY_LOOKAHEAD_INSTRUCTION);
    expect(humanMessageOf(lastCall)).toContain("<curriculum-context>");
    expect(humanMessageOf(lastCall)).toContain("digest one");
  });

  test("no currentProblemOrdinal: instruction is present, but there is no slice", async () => {
    mockInvoke.mockResolvedValueOnce(invokeResponse("student chunk summary"));

    await writeAndTrigger({
      studentContent: "Short student work.",
    });

    expect(mockGetUnitSummary).not.toHaveBeenCalled();
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(systemMessageOf(0)).toContain(UNIT_SUMMARY_LOOKAHEAD_INSTRUCTION);
    expect(humanMessageOf(0)).not.toContain("<curriculum-context>");
  });

  test("overview text never appears in any request", async () => {
    mockGetUnitSummary.mockResolvedValue(unitSummaryResult());
    mockInvoke
      .mockResolvedValueOnce(invokeResponse("student chunk summary"))
      .mockResolvedValueOnce(invokeResponse("teacher chunk summary"));

    await writeAndTrigger({
      studentContent: "Short student work.",
      teacherContent: "Short teacher work.",
      currentProblemOrdinal: "1.1",
    });

    for (const call of mockInvoke.mock.calls) {
      const [systemMessage, humanMessage] = call[0];
      expect(systemMessage.content).not.toContain(kSummary.overview);
      expect(humanMessage.content).not.toContain(kSummary.overview);
    }
  });
});
