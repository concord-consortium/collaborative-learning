// Tests for provider routing: which backend answers a conversation, and the rule that the choice
// is made once and then held.
import {TurnResult, TutorProvider} from "../src/chat/provider";
import {createRoutingProvider} from "../src/chat/routing-provider";

function fakeBackend(name: string): TutorProvider & {calls: number} {
  const backend = {
    calls: 0,
    async processTurn(): Promise<TurnResult> {
      backend.calls++;
      return {
        assistantText: `reply from ${name}`,
        parentUpdate: {[`${name}State`]: "earned"},
      };
    },
  };
  return backend;
}

function routing(over: {onBuild?: (name: string) => void} = {}) {
  const openai = fakeBackend("openai");
  const fl = fakeBackend("fl");
  const provider = createRoutingProvider({
    defaultProvider: "openai",
    providers: {
      openai: () => {
        over.onBuild?.("openai");
        return openai;
      },
      fl: () => {
        over.onBuild?.("fl");
        return fl;
      },
    },
  });
  return {provider, openai, fl};
}

describe("createRoutingProvider", () => {
  it("routes a first turn to the backend the message names", async () => {
    const {provider, fl, openai} = routing();
    const result = await provider.processTurn({}, {text: "hi", provider: "fl"});
    expect(result.assistantText).toBe("reply from fl");
    expect(fl.calls).toBe(1);
    expect(openai.calls).toBe(0);
  });

  // Existing conversations predate the field entirely, so an absent one is not an error.
  it("routes to the default when no backend is named", async () => {
    const {provider, openai} = routing();
    const result = await provider.processTurn({}, {text: "hi"});
    expect(result.assistantText).toBe("reply from openai");
    expect(openai.calls).toBe(1);
  });

  // The choice is persisted on the first turn precisely so a later message cannot change it.
  it("records the chosen backend on the parent from the first turn", async () => {
    const {provider} = routing();
    const result = await provider.processTurn({}, {text: "hi", provider: "fl"});
    expect(result.parentUpdate.provider).toBe("fl");
  });

  it("records the default too, so an unset field never means two things", async () => {
    const {provider} = routing();
    const result = await provider.processTurn({}, {text: "hi"});
    expect(result.parentUpdate.provider).toBe("openai");
  });

  // The rule this whole module exists for. Conversation state — an OpenAI conversation id, an FL
  // session id — lives on one backend and means nothing to the other, so a mid-conversation flip
  // would strand half a conversation on each and neither could answer coherently.
  it("ignores a later message that names a different backend", async () => {
    const {provider, openai, fl} = routing();
    const result = await provider.processTurn(
      {provider: "openai", conversationId: "conv_1"}, {text: "hi", provider: "fl"});
    expect(result.assistantText).toBe("reply from openai");
    expect(openai.calls).toBe(1);
    expect(fl.calls).toBe(0);
  });

  it("does not rewrite a choice the parent already holds", async () => {
    const {provider} = routing();
    const result = await provider.processTurn({provider: "fl"}, {text: "hi", provider: "fl"});
    expect(result.parentUpdate).not.toHaveProperty("provider");
  });

  it("passes the backend's own parent state through untouched", async () => {
    const {provider} = routing();
    const result = await provider.processTurn({}, {text: "hi", provider: "fl"});
    expect(result.parentUpdate).toEqual({flState: "earned", provider: "fl"});
  });

  // A name we have no backend for is a routing bug or a client sending something we never
  // shipped. Falling back to the default would answer as the wrong backend and look like it
  // worked; throwing becomes status:"error", which is visible.
  it("throws rather than guessing when the named backend is unknown", async () => {
    const {provider} = routing();
    await expect(provider.processTurn({}, {text: "hi", provider: "nope"}))
      .rejects.toThrow(/nope/);
  });

  it("throws when a parent holds a backend that no longer exists", async () => {
    const {provider} = routing();
    await expect(provider.processTurn({provider: "retired"}, {text: "hi"}))
      .rejects.toThrow(/retired/);
  });

  // Each backend needs its own credential, and a Cloud Function only holds the secrets it
  // declares. Building both up front would make an OpenAI turn fail for want of an FL key.
  it("builds only the backend it routes to", async () => {
    const built: string[] = [];
    const {provider} = routing({onBuild: (name) => built.push(name)});
    await provider.processTurn({}, {text: "hi", provider: "fl"});
    expect(built).toEqual(["fl"]);
  });
});
