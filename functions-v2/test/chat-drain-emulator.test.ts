// Drain-engine tests against the Firestore emulator with a fake TutorProvider.
//
// These cover the machinery the CLUE-566 spec calls out as hard to get right — the drain cursor
// and the atomic assistant-doc + parent-state + cursor commit — which had no automated coverage
// because the only way to reach it was through the real trigger and the real OpenAI client. The
// provider seam is what makes it reachable: the drain no longer knows which backend answered.
//
// Requires a FIRESTORE-ONLY emulator (npm run test:emulator). A full stack with functions loaded
// fires the real chatTutorOnWrite trigger on these writes and corrupts state mid-run.
import {clearFirestoreData} from "firebase-functions-test/lib/providers/firestore";
import {DocumentData, FieldValue, getFirestore} from "firebase-admin/firestore";

import {initialize, projectConfig} from "./initialize";
import {DrainContext, TurnResult, TutorProvider, processAndDrain} from "../src/chat/drain";

const {cleanup} = initialize();

const kConversation = "demo/test-demo/chatTutor/conv1";

// A provider that records what the drain handed it and replies with a canned script, so a test
// can assert on both directions of the seam.
function fakeProvider(script: TurnResult[]): TutorProvider & {calls: {parent: DocumentData, message: DocumentData}[]} {
  const calls: {parent: DocumentData, message: DocumentData}[] = [];
  return {
    calls,
    processTurn: async (parent, message) => {
      calls.push({parent, message});
      return script[calls.length - 1] ?? script[script.length - 1];
    },
  };
}

function makeCtx(provider: TutorProvider): DrainContext {
  const parentRef = getFirestore().doc(kConversation);
  return {parentRef, messagesCol: parentRef.collection("messages"), provider};
}

async function queueUserMessage(text: string) {
  await getFirestore().doc(kConversation).collection("messages").add({
    kind: "user",
    text,
    uid: "student-1",
    context_id: "class-hash-1",
    problemPath: "sas/1/1",
    createdAt: FieldValue.serverTimestamp(),
  });
}

async function readMessages() {
  const snap = await getFirestore().doc(kConversation).collection("messages")
    .orderBy("createdAt").get();
  return snap.docs;
}

describe("processAndDrain", () => {
  beforeEach(async () => {
    await clearFirestoreData(projectConfig);
  });

  afterAll(async () => {
    await cleanup();
  });

  it("commits the provider's reply, the parent state it earned, and the cursor together", async () => {
    await queueUserMessage("how do I start?");
    const provider = fakeProvider([
      {assistantText: "What do you notice about the sensor value?", parentUpdate: {conversationId: "conv_abc"}},
    ]);

    await processAndDrain(makeCtx(provider));

    const docs = await readMessages();
    const assistants = docs.filter((d) => d.get("kind") === "assistant");
    expect(assistants).toHaveLength(1);
    expect(assistants[0].get("userText")).toBe("What do you notice about the sensor value?");
    // owner fields are copied off the triggering message, or the client's owner-filtered
    // onSnapshot cannot read the reply at all
    expect(assistants[0].get("uid")).toBe("student-1");
    expect(assistants[0].get("context_id")).toBe("class-hash-1");

    const parent = (await getFirestore().doc(kConversation).get()).data();
    expect(parent?.conversationId).toBe("conv_abc");
    expect(parent?.status).toBe("idle");
    expect(parent?.lastProcessedMessageId).toBe(docs.find((d) => d.get("kind") === "user")?.id);
  });

  it("writes an assistant doc even when the provider declines to reply", async () => {
    await queueUserMessage("thanks!");
    const provider = fakeProvider([{assistantText: null, parentUpdate: {}}]);

    await processAndDrain(makeCtx(provider));

    // a silent reply must still land, or the client's typing indicator spins forever
    const assistants = (await readMessages()).filter((d) => d.get("kind") === "assistant");
    expect(assistants).toHaveLength(1);
    expect(assistants[0].get("userText")).toBeNull();
  });

  it("hands the provider the parent state earned by earlier turns", async () => {
    await getFirestore().doc(kConversation).set({conversationId: "conv_abc", problemInstalled: true, seq: 4});
    await queueUserMessage("and now?");
    const provider = fakeProvider([{assistantText: "Say more.", parentUpdate: {seq: 5}}]);

    await processAndDrain(makeCtx(provider));

    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0].parent.conversationId).toBe("conv_abc");
    expect(provider.calls[0].parent.problemInstalled).toBe(true);
    expect(provider.calls[0].parent.seq).toBe(4);
    expect(provider.calls[0].message.text).toBe("and now?");
  });

  it("drains a backlog in order, one provider turn per queued message", async () => {
    await queueUserMessage("first");
    await queueUserMessage("second");
    await queueUserMessage("third");
    const provider = fakeProvider([
      {assistantText: "r1", parentUpdate: {}},
      {assistantText: "r2", parentUpdate: {}},
      {assistantText: "r3", parentUpdate: {}},
    ]);

    await processAndDrain(makeCtx(provider));

    expect(provider.calls.map((c) => c.message.text)).toEqual(["first", "second", "third"]);
    // each turn sees the cursor state the previous one committed
    const parent = (await getFirestore().doc(kConversation).get()).data();
    expect(parent?.status).toBe("idle");
    const assistants = (await readMessages()).filter((d) => d.get("kind") === "assistant");
    expect(assistants.map((d) => d.get("userText"))).toEqual(["r1", "r2", "r3"]);
  });

  it("refuses a provider that tries to release the drain's lock", async () => {
    await queueUserMessage("a provider overreaching");
    // status is drain-owned: acquireLock proceeds on anything that is not "generating", so a
    // provider writing status:"idle" mid-drain would let a racing trigger start a second
    // concurrent drain of the same backlog.
    const provider = fakeProvider([{assistantText: "reply", parentUpdate: {status: "idle"}}]);

    await expect(processAndDrain(makeCtx(provider))).rejects.toThrow(/drain-owned/);

    const assistants = (await readMessages()).filter((d) => d.get("kind") === "assistant");
    expect(assistants).toHaveLength(0);
  });

  it("refuses a provider that tries to restamp the owner fields", async () => {
    await queueUserMessage("a provider reaching further");
    // the owner stamp is what the client's owner-only read rule keys on; letting a provider set
    // it would re-point a conversation at another user.
    const provider = fakeProvider([{assistantText: "reply", parentUpdate: {uid: "someone-else"}}]);

    await expect(processAndDrain(makeCtx(provider))).rejects.toThrow(/drain-owned/);

    const parent = (await getFirestore().doc(kConversation).get()).data();
    expect(parent?.uid).not.toBe("someone-else");
  });

  it("commits nothing when the parent write fails after the provider already succeeded", async () => {
    await queueUserMessage("the turn works, the write does not");
    // an undefined field the Firestore SDK rejects, so the parent write fails while the assistant
    // doc and cursor in the SAME batch are already staged. Written sequentially the assistant doc
    // would survive; batched, nothing does — which is what makes this test about atomicity rather
    // than about failure handling.
    const provider = fakeProvider([
      {assistantText: "a reply that must not survive", parentUpdate: {bad: undefined as unknown as string}},
    ]);

    await expect(processAndDrain(makeCtx(provider))).rejects.toThrow();

    const assistants = (await readMessages()).filter((d) => d.get("kind") === "assistant");
    expect(assistants).toHaveLength(0);
    const parent = (await getFirestore().doc(kConversation).get()).data();
    expect(parent?.lastProcessedMessageId).toBeUndefined();
  });

  it("leaves the cursor unadvanced and writes nothing when the provider throws", async () => {
    await queueUserMessage("this turn fails");
    const provider: TutorProvider = {
      processTurn: async () => {
        throw new Error("provider exploded");
      },
    };

    await expect(processAndDrain(makeCtx(provider))).rejects.toThrow("provider exploded");

    // the whole point of the single-batch commit: a failed turn leaves no partial state, so the
    // next trigger re-processes the same message rather than skipping it
    const assistants = (await readMessages()).filter((d) => d.get("kind") === "assistant");
    expect(assistants).toHaveLength(0);
    const parent = (await getFirestore().doc(kConversation).get()).data();
    expect(parent?.lastProcessedMessageId).toBeUndefined();
  });
});
