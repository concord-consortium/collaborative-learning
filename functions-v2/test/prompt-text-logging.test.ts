import * as logger from "firebase-functions/logger";
import {
  CategorizeDeps,
  DocumentMetadata,
  categorizeRepresentations,
  relatedSummaryTextParts,
} from "../lib/src/ai-categorize-document";
import {
  IAiPrompt, RelatedSummary, buildMixedMessages, defaultAiPrompt,
} from "../../shared/ai-analysis-messages";

jest.mock("firebase-functions/logger");

const prompt: IAiPrompt = {...defaultAiPrompt, systemPrompt: "You are a master teacher."};
const summary = "A summary of the student's work.";
const imageUrl = "https://example.com/image.png";

const relatedSummary: RelatedSummary = {
  summary: "A peer's work, found by the lookup.",
  agreements: {yes: [{content: "Ada said something.", tags: []}]},
  peerComments: [{
    commentId: "c1",
    commentUid: "student-2",
    content: "A classmate wrote this about that document.",
    tags: ["user"],
    ratings: {yes: 2},
    updatedAt: 1756000000000,
  }],
};

const documentMetadata: DocumentMetadata = {
  root: "demo", space: "AI", key: "testdoc1", context_id: "class1",
  unit: "vibe", investigation: "1", problem: "1.1", offeringId: "1234",
  contextSource: "document",
};

function deps(overrides: Partial<CategorizeDeps> = {}): CategorizeDeps {
  return {
    readDocumentMetadata: jest.fn().mockResolvedValue({metadata: documentMetadata}),
    getEmbeddings: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    findRelatedSummaries: jest.fn().mockResolvedValue([relatedSummary]),
    createOpenAI: () => ({
      chat: {
        completions: {
          parse: async () => ({choices: [{message: {parsed: {discussion: "ok"}}}], usage: {}}),
        },
      },
    }) as any,
    ...overrides,
  };
}

/**
 * The text the gated line logged, or undefined when it did not run.
 *
 * @return {string[] | undefined} the logged parts
 */
function loggedPromptText(): string[] | undefined {
  const call = (logger.info as jest.Mock).mock.calls
    .find(([message]) => message === "Related summary prompt text");
  return call?.[1]?.parts;
}

describe("relatedSummaryTextParts", () => {
  it("returns the related-summary parts of a built message", () => {
    const messages = buildMixedMessages(prompt, summary, [relatedSummary], imageUrl);

    expect(relatedSummaryTextParts(messages, 1)).toEqual([
      expect.stringContaining("A peer's work, found by the lookup."),
    ]);
    expect(relatedSummaryTextParts(messages, 1)[0]).not.toContain(summary);
  });

  it("returns one entry per related summary, in order", () => {
    const second: RelatedSummary = {summary: "A second peer's work.", agreements: {}, peerComments: []};
    const messages = buildMixedMessages(prompt, summary, [relatedSummary, second], imageUrl);

    const parts = relatedSummaryTextParts(messages, 2);
    expect(parts).toHaveLength(2);
    expect(parts[0]).toContain("A peer's work, found by the lookup.");
    expect(parts[1]).toContain("A second peer's work.");
  });

  it("returns nothing when there were no related summaries", () => {
    expect(relatedSummaryTextParts(buildMixedMessages(prompt, summary, [], imageUrl), 0)).toEqual([]);
  });

  it("returns nothing for a message whose content is not a list of parts", () => {
    expect(relatedSummaryTextParts([{role: "user", content: "plain text"}], 1)).toEqual([]);
  });
});

describe("the prompt-text logging gate", () => {
  const variable = "AI_PROMPT_TEXT_LOGGING";
  const emulator = "FUNCTIONS_EMULATOR";
  const before = {param: process.env[variable], emulator: process.env[emulator]};

  const restore = (name: string, value: string | undefined) => {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env[variable];
    // The functions emulator sets this itself; a deployed function never has it.
    process.env[emulator] = "true";
  });

  afterAll(() => {
    restore(variable, before.param);
    restore(emulator, before.emulator);
  });

  const categorize = () => categorizeRepresentations(
    {summary, imageUrl}, "key", "demo/AI/documents/testdoc1", prompt, undefined, deps());

  it("logs nothing outside the emulator, whatever the param says", async () => {
    // The second half of the gate: what a deployed project cannot satisfy.
    process.env[variable] = "on";
    delete process.env[emulator];

    await categorize();

    expect(loggedPromptText()).toBeUndefined();
  });

  it("logs nothing when the param is unset, which is what production is", async () => {
    // An unset param reads back as "", not as the declared default, so this is the production case.
    await categorize();

    expect(loggedPromptText()).toBeUndefined();
  });

  it("logs nothing for any value that is not exactly `on`", async () => {
    for (const value of ["off", "true", "ON", "1", ""]) {
      jest.clearAllMocks();
      process.env[variable] = value;

      await categorize();

      expect(loggedPromptText()).toBeUndefined();
    }
  });

  it("logs the related-summary text when the param is exactly `on`", async () => {
    process.env[variable] = "on";

    await categorize();

    const parts = loggedPromptText();
    expect(parts).toHaveLength(1);
    // The emulator check reads the counts line and the peer section side by side, to confirm that
    // neither has leaked into the other.
    expect(parts![0]).toContain("Other users agreed with this summary as follows: yes: 1");
    expect(parts![0]).toContain("<comment tag=\"user\" ratings=\"yes: 2\">");
    expect(parts![0]).toContain("A classmate wrote this about that document.");
  });

  it("logs nothing when the lookup found no related summaries, even when on", async () => {
    process.env[variable] = "on";

    await categorizeRepresentations(
      {summary, imageUrl}, "key", "demo/AI/documents/testdoc1", prompt, undefined,
      deps({findRelatedSummaries: jest.fn().mockResolvedValue([])}));

    expect(loggedPromptText()).toBeUndefined();
  });

  it("logs nothing for an image-only request, which carries no related summaries", async () => {
    process.env[variable] = "on";

    await categorizeRepresentations(
      {summary: null, imageUrl}, "key", "demo/AI/documents/testdoc1", prompt, undefined, deps());

    expect(loggedPromptText()).toBeUndefined();
  });
});
