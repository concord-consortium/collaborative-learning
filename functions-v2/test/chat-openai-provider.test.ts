// Tests for the OpenAI tutor backend behind the TutorProvider seam: conversation creation,
// install-once, the rule that parent state is earned only after a successful response, and the
// conversation id and model actually reaching the OpenAI call.
//
// The OpenAI module is mocked because the alternative is billing a real API call. Assertions
// prefer the returned TurnResult; the mocks are inspected only where the behavior is a call the
// provider is supposed to make.
import {createOpenAIProvider} from "../src/chat/openai-provider";
import * as openai from "../src/chat/openai";

jest.mock("../src/chat/openai");

const createConversation = openai.createConversation as jest.MockedFunction<typeof openai.createConversation>;
const installDeveloperPrompt =
  openai.installDeveloperPrompt as jest.MockedFunction<typeof openai.installDeveloperPrompt>;
const createTutorResponse = openai.createTutorResponse as jest.MockedFunction<typeof openai.createTutorResponse>;

const kGeneric = "GENERIC TUTOR PROMPT";
const kLeft = JSON.stringify({sections: [{type: "introduction", title: "1.1", content: "{}"}]});

function provider() {
  return createOpenAIProvider({openai: {} as never, model: "test-model", genericText: kGeneric});
}

// the prompt text each installDeveloperPrompt call carried, in order
function installedItems() {
  return installDeveloperPrompt.mock.calls.map((call) => call[2]);
}

describe("createOpenAIProvider", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    createConversation.mockResolvedValue("conv_new");
    createTutorResponse.mockResolvedValue({userText: "What do you notice about the sensor?", highlights: []});
  });

  it("creates a conversation and installs the prompt and problem on a first turn", async () => {
    const result = await provider().processTurn({}, {text: "how do I start?", leftContext: kLeft});

    expect(result.assistantText).toBe("What do you notice about the sensor?");
    expect(result.parentUpdate.conversationId).toBe("conv_new");
    expect(result.parentUpdate.problemInstalled).toBe(true);
    expect(installedItems()).toHaveLength(2);
    expect(installedItems()[0]).toBe(kGeneric);
    expect(installedItems()[1]).toContain(kLeft);
  });

  it("reuses the parent's conversation and skips the install once the problem is flagged", async () => {
    const parent = {conversationId: "conv_existing", problemInstalled: true};

    const result = await provider().processTurn(parent, {text: "and now?", leftContext: kLeft});

    expect(createConversation).not.toHaveBeenCalled();
    expect(installedItems()).toHaveLength(0);
    // an already-persisted conversationId is not re-reported
    expect(result.parentUpdate.conversationId).toBeUndefined();
    expect(result.parentUpdate.problemInstalled).toBeUndefined();
    // the parent's conversation and the configured model are what reach OpenAI — the two pieces
    // of plumbing the seam carries that the TurnResult cannot show
    expect(createTutorResponse).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({conversationId: "conv_existing", model: "test-model"})
    );
  });

  it("leaves problemInstalled unset when LEFT is empty, keeping the recovery path open", async () => {
    const result = await provider().processTurn({}, {text: "hi", leftContext: JSON.stringify({sections: []})});

    // the generic prompt still installs; the problem does not, so a later turn re-attaches LEFT
    expect(installedItems()).toEqual([kGeneric]);
    expect(result.parentUpdate.problemInstalled).toBeUndefined();
    expect(result.parentUpdate.conversationId).toBe("conv_new");
  });

  it("increments the parent's seq when a workspace refresh rides the turn", async () => {
    const result = await provider().processTurn(
      {conversationId: "conv_existing", problemInstalled: true, seq: 4},
      {text: "look at this", rightContext: "# workspace"}
    );

    expect(result.parentUpdate.seq).toBe(5);
  });

  it("earns no parent state when the response fails", async () => {
    createTutorResponse.mockRejectedValue(new Error("openai 500"));

    await expect(provider().processTurn({}, {text: "hi", leftContext: kLeft}))
      .rejects.toThrow("openai 500");

    // the conversation was created, but the caller gets nothing to persist — so the next turn
    // re-creates rather than recording a conversation whose first response never landed
    expect(createConversation).toHaveBeenCalled();
  });

  it("earns no parent state when the prompt install fails", async () => {
    installDeveloperPrompt.mockRejectedValue(new Error("install failed"));

    await expect(provider().processTurn({}, {text: "hi", leftContext: kLeft}))
      .rejects.toThrow("install failed");

    expect(createTutorResponse).not.toHaveBeenCalled();
  });

  // The seam carries the structured half of the reply, not just its prose. Dropping it here is
  // invisible from the client's side — the tutor simply stops pointing at anything — so the
  // pass-through is pinned rather than left to the type checker, which a `string | null` text
  // field alone would have satisfied.
  it("carries the reply's highlights through to the TurnResult", async () => {
    const highlights = [{tileId: "t1", objectId: "n1", label: "the sensor"}];
    createTutorResponse.mockResolvedValue({userText: "look here", highlights});

    const result = await provider().processTurn(
      {conversationId: "conv_existing", problemInstalled: true}, {text: "where?"});

    expect(result.highlights).toEqual(highlights);
  });
});
