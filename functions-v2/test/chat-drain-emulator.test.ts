// Drain-engine tests: the lock, the cursor, and the batch commit, run against the Firestore
// emulator with a fake TutorProvider so no backend is involved.
//
// Requires a FIRESTORE-ONLY emulator (npm run test:emulator). A full stack with functions loaded
// fires the real chatTutorOnWrite trigger on these writes and corrupts state mid-run.
import {clearFirestoreData} from "firebase-functions-test/lib/providers/firestore";
import {DocumentData, FieldValue, Timestamp, getFirestore} from "firebase-admin/firestore";

import {initialize, projectConfig} from "./initialize";
import {DrainContext, acquireLock, processAndDrain} from "../src/chat/drain";
import {TurnResult, TutorProvider} from "../src/chat/provider";

const {cleanup} = initialize();

const kConversation = "demo/test-demo/chatTutor/conv1";

// A provider that records what the drain handed it and replies with a canned script, so a test
// can assert on both directions of the seam. Running off the end of the script throws rather
// than replaying the last reply, so an unexpected extra turn shows up as a failure here instead
// of as a plausible-looking duplicate answer.
function fakeProvider(script: TurnResult[]): TutorProvider & {calls: {parent: DocumentData, message: DocumentData}[]} {
  const calls: {parent: DocumentData, message: DocumentData}[] = [];
  return {
    calls,
    processTurn: async (parent, message) => {
      calls.push({parent, message});
      const reply = script[calls.length - 1];
      if (!reply) throw new Error(`fakeProvider called ${calls.length} times, script has ${script.length}`);
      return reply;
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

// file-scoped: cleanup() deletes the Firebase app, so it must not run between describe blocks
beforeEach(async () => {
  await clearFirestoreData(projectConfig);
});

afterAll(async () => {
  await cleanup();
});

describe("processAndDrain", () => {
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

    // the provider call order is the authoritative statement about ordering; the assistant docs
    // share a serverTimestamp() and are read back by createdAt alone, so their relative order is
    // not something this test can pin
    expect(provider.calls.map((c) => c.message.text)).toEqual(["first", "second", "third"]);
    const parent = (await getFirestore().doc(kConversation).get()).data();
    expect(parent?.status).toBe("idle");
    const assistants = (await readMessages()).filter((d) => d.get("kind") === "assistant");
    expect(assistants.map((d) => d.get("userText")).sort()).toEqual(["r1", "r2", "r3"]);
  });

  it("resumes at the persisted cursor instead of re-answering the backlog", async () => {
    await queueUserMessage("first");
    await processAndDrain(makeCtx(fakeProvider([{assistantText: "r1", parentUpdate: {}}])));

    await queueUserMessage("second");
    // a fresh provider whose script holds exactly one reply: if the drain re-read from the top it
    // would ask for a second turn and the script would throw. This is the behavior that stops a
    // re-trigger from re-answering — and re-billing — the whole backlog.
    const resumed = fakeProvider([{assistantText: "r2", parentUpdate: {}}]);
    await processAndDrain(makeCtx(resumed));

    expect(resumed.calls).toHaveLength(1);
    expect(resumed.calls[0].message.text).toBe("second");
    const assistants = (await readMessages()).filter((d) => d.get("kind") === "assistant");
    expect(assistants).toHaveLength(2);
  });

  it("refuses a provider that tries to release the drain's lock", async () => {
    await queueUserMessage("a provider overreaching");
    // status is drain-owned: acquireLock proceeds on anything that is not "generating", so a
    // provider writing status:"idle" mid-drain would let a racing trigger start a second
    // concurrent drain of the same backlog.
    const provider = fakeProvider([{assistantText: "reply", parentUpdate: {status: "idle"}}]);

    await expect(processAndDrain(makeCtx(provider))).rejects.toThrow(/drain-owned parent fields: status/);

    const assistants = (await readMessages()).filter((d) => d.get("kind") === "assistant");
    expect(assistants).toHaveLength(0);
  });

  it("refuses a provider that tries to restamp the owner fields", async () => {
    // seed the owner stamp so the assertion below has something to defend: the owner stamp is
    // what the client's owner-only read rule keys on, and letting a provider set it would
    // re-point a conversation at another user.
    await getFirestore().doc(kConversation).set({uid: "student-1"});
    await queueUserMessage("a provider reaching further");
    const provider = fakeProvider([{assistantText: "reply", parentUpdate: {uid: "someone-else"}}]);

    await expect(processAndDrain(makeCtx(provider))).rejects.toThrow(/drain-owned parent fields: uid/);

    const parent = (await getFirestore().doc(kConversation).get()).data();
    expect(parent?.uid).toBe("student-1");
  });

  it("commits nothing when the parent write fails after the provider already succeeded", async () => {
    await queueUserMessage("the turn works, the write does not");
    // an undefined field the SDK rejects. WriteBatch.set() validates synchronously, so this
    // throws while the batch is being assembled and commit() is never reached — nothing the
    // drain staged reaches Firestore. What that pins is that the assistant doc is staged rather
    // than written eagerly: the same provider against a drain that wrote sequentially would
    // leave the reply behind.
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

describe("acquireLock", () => {
  const ownerFields = {uid: "student-1", context_id: "class-hash-1", problemPath: "sas/1/1"};
  const parentRef = () => getFirestore().doc(kConversation);

  it("admits the first caller and turns the next one away", async () => {
    expect(await acquireLock(parentRef(), ownerFields)).toBe(true);

    // single-in-flight: while the first invocation is still draining, a second trigger for the
    // same conversation must back off rather than drain the same backlog alongside it
    expect(await acquireLock(parentRef(), ownerFields)).toBe(false);
  });

  it("stamps the owner fields when it creates the parent, so the client can read status", async () => {
    await acquireLock(parentRef(), ownerFields);

    const parent = (await parentRef().get()).data();
    expect(parent?.status).toBe("generating");
    expect(parent?.uid).toBe("student-1");
    expect(parent?.context_id).toBe("class-hash-1");
  });

  it("reclaims a lock whose owner crashed mid-drain", async () => {
    // STALE_LOCK_MS is 5 minutes; a lock older than that belongs to an invocation that died
    // without releasing it, and refusing to reclaim would wedge the conversation permanently
    await parentRef().set({
      status: "generating",
      lockedAt: Timestamp.fromMillis(Date.now() - 6 * 60 * 1000),
      ...ownerFields,
    });

    expect(await acquireLock(parentRef(), ownerFields)).toBe(true);
  });

  it("does not reclaim a lock that is merely recent", async () => {
    await parentRef().set({
      status: "generating",
      lockedAt: Timestamp.fromMillis(Date.now() - 30 * 1000),
      ...ownerFields,
    });

    expect(await acquireLock(parentRef(), ownerFields)).toBe(false);
  });
});
