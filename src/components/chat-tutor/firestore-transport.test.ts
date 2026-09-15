// The transport reaches firebase.firestore.FieldValue.serverTimestamp() for createdAt, which
// is undefined unless the firestore module is loaded. The real call returns an opaque sentinel
// the server resolves on write, so a marker stands in for it faithfully — these tests assert
// which fields are present, never what createdAt resolves to.
jest.mock("firebase/app", () => ({
  __esModule: true,
  default: { firestore: { FieldValue: { serverTimestamp: () => "server-timestamp" } } },
}));

import { FirestoreTransport } from "./firestore-transport";
import { TutorPrompts } from "./tutor-prompts";
import { TutorProviderId } from "../../../shared/chat-tutor-providers";

// Minimal stand-in for the Firestore handle the transport reaches through. Only the
// add() path is exercised here; subscribe() is not called, so no listeners are needed.
function fakeFirestore() {
  const added: Record<string, unknown>[] = [];
  const messages = { add: (doc: Record<string, unknown>) => { added.push(doc); return Promise.resolve(); } };
  const firestore = { collection: () => ({ doc: () => ({ collection: () => messages }) }) };
  return { added, firestore: firestore as any };
}

function makeTransport(provider?: TutorProviderId, tutorPrompts?: TutorPrompts) {
  const { added, firestore } = fakeFirestore();
  const transport = new FirestoreTransport({
    firestore,
    conversationId: "conv1",
    uid: "123",
    contextId: "class1",
    problemPath: "sas/1/2",
    getLeftContext: () => "{}",
    getRightSummary: () => undefined,
    tutorPrompts,
    provider,
  });
  return { added, transport };
}

describe("FirestoreTransport message provider stamp", () => {
  // The default path must write exactly the fields it wrote before provider selection
  // existed — the rules whitelist is a hasOnly, so an always-stamped field would also
  // have to be allowed everywhere before it could ever be sent.
  it("omits the provider field when no provider is given", async () => {
    const { added, transport } = makeTransport(undefined);
    await transport.sendUserMessage("hello");
    expect(added).toHaveLength(1);
    expect("provider" in added[0]).toBe(false);
  });

  it("stamps the provider field when one is given", async () => {
    const { added, transport } = makeTransport("foreverlearning");
    await transport.sendUserMessage("hello");
    expect(added[0].provider).toBe("foreverlearning");
  });
});

// The other half of the stacking contract in conversationDocId: the prompts key forks the
// conversation under a non-default provider *because* the overrides are still sent there.
// Re-gating this send on the default provider would reinstate the failure the stacking fixed
// — an authored prompt installed once on a conversation whose id can no longer change.
describe("FirestoreTransport prompt overrides", () => {
  // The overrides ride the same install-eligible sends as LEFT, and ForeverLearning reads neither
  // — it never installs a generic prompt to override. Sending them would be the same dead weight
  // LEFT was, so the gate that stops one stops both.
  it("does not send the prompt overrides to a backend that installs no prompt", async () => {
    const { added, transport } = makeTransport("foreverlearning", { replace: "REPLACED" });
    await transport.sendUserMessage("hello");
    expect(added[0]).not.toHaveProperty("promptReplace");
  });

  it("sends the prompt overrides under the default provider", async () => {
    const { added, transport } = makeTransport(undefined, { append: "APPENDED" });
    await transport.sendUserMessage("hello");
    expect(added[0].promptAppend).toBe("APPENDED");
  });
});

// Which workspace payload a message carries is decided by the backend the conversation belongs
// to: OpenAI reads a markdown summary, ForeverLearning projects the document server-side. Sending
// both would put two readings of the same workspace on every message, one of which no backend
// reads.
describe("FirestoreTransport workspace payload", () => {
  function transportFor(provider: TutorProviderId | undefined) {
    const { added, firestore } = fakeFirestore();
    const transport = new FirestoreTransport({
      firestore,
      conversationId: "conv1",
      uid: "123",
      contextId: "class1",
      problemPath: "sas/1/2",
      getLeftContext: () => "{}",
      getRightSummary: () => ({ markdown: "# Workspace", hash: "h-md" }),
      getRightContent: () => ({ json: '{"rowOrder":[]}', hash: "h-json" }),
      provider,
    });
    return { added, transport };
  }

  it("sends the markdown summary under the default backend", async () => {
    const { added, transport } = transportFor(undefined);
    await transport.sendUserMessage("hello");
    expect(added[0].rightContext).toBe("# Workspace");
    expect(added[0]).not.toHaveProperty("rightContent");
  });

  it("sends the document itself under ForeverLearning", async () => {
    const { added, transport } = transportFor("foreverlearning");
    await transport.sendUserMessage("hello");
    expect(added[0].rightContent).toBe('{"rowOrder":[]}');
    expect(added[0]).not.toHaveProperty("rightContext");
  });

  // The gate keys on the payload actually sent, not on the summary's hash. The two derive from
  // one document but not identically — a change can move one and not the other, and gating the
  // document on the summary's hash would skip a send the server needed.
  it("does not resend an unchanged document", async () => {
    const { added, transport } = transportFor("foreverlearning");
    await transport.sendUserMessage("first");
    await transport.sendUserMessage("second");
    expect(added[0]).toHaveProperty("rightContent");
    expect(added[1]).not.toHaveProperty("rightContent");
  });

  it("sends nothing for a workspace that has not loaded", async () => {
    const { added, firestore } = fakeFirestore();
    const transport = new FirestoreTransport({
      firestore, conversationId: "conv1", uid: "123", contextId: "class1",
      problemPath: "sas/1/2", getLeftContext: () => "{}",
      getRightSummary: () => undefined, getRightContent: () => undefined,
      provider: "foreverlearning",
    });
    await transport.sendUserMessage("hello");
    expect(added[0]).not.toHaveProperty("rightContent");
    expect(added[0]).not.toHaveProperty("rightContext");
  });
});


// LEFT is an OpenAI-path concept: the provider installs the problem once and flips the parent's
// problemInstalled flag. The ForeverLearning provider reads neither, so without this the flag
// never flips, every FL message carries the whole problem JSON, and every byte of it is discarded
// on arrival.
describe("FirestoreTransport problem context by backend", () => {
  function transportFor(provider: TutorProviderId | undefined) {
    const { added, firestore } = fakeFirestore();
    const transport = new FirestoreTransport({
      firestore, conversationId: "conv1", uid: "123", contextId: "class1",
      problemPath: "sas/1/2", getLeftContext: () => '{"sections":[{"type":"intro"}]}',
      getRightSummary: () => ({ markdown: "# W", hash: "h" }),
      getRightContent: () => ({ json: "{}", hash: "j" }),
      provider,
    });
    return { added, transport };
  }

  it("attaches the problem for the default backend, which installs it", async () => {
    const { added, transport } = transportFor(undefined);
    await transport.sendUserMessage("hello");
    expect(added[0].leftContext).toEqual(expect.any(String));
  });

  it("never attaches the problem for ForeverLearning, which does not read it", async () => {
    const { added, transport } = transportFor("foreverlearning");
    await transport.sendUserMessage("first");
    await transport.sendUserMessage("second");
    expect(added[0]).not.toHaveProperty("leftContext");
    expect(added[1]).not.toHaveProperty("leftContext");
  });

  // The first-send gate exists to stop an OpenAI conversation being grounded with no problem.
  // It must not block a backend that never wanted the problem in the first place.
  it("does not block an FL send while the problem is still loading", async () => {
    const { added, firestore } = fakeFirestore();
    const transport = new FirestoreTransport({
      firestore, conversationId: "conv1", uid: "123", contextId: "class1",
      problemPath: "sas/1/2", getLeftContext: () => undefined,
      getRightSummary: () => undefined, getRightContent: () => ({ json: "{}", hash: "j" }),
      provider: "foreverlearning",
    });
    await expect(transport.sendUserMessage("hello")).resolves.toBeUndefined();
    expect(added).toHaveLength(1);
  });
});

// rightContent is the whole document snapshot in one Firestore message doc, and a Firestore
// document is capped at 1 MiB. A CLUE dataset can grow without bound — a long recorded Dataflow
// run writes a row per tick — so a valid workspace can exceed the cap and make the write itself
// fail, before the trigger ever runs. Skipping the attachment degrades that to a turn with no
// workspace; attaching it loses the turn entirely.
describe("FirestoreTransport oversized workspace", () => {
  function transportWith(json: string) {
    const { added, firestore } = fakeFirestore();
    const transport = new FirestoreTransport({
      firestore, conversationId: "conv1", uid: "123", contextId: "class1",
      problemPath: "sas/1/2", getLeftContext: () => "{}",
      getRightSummary: () => undefined,
      getRightContent: () => ({ json, hash: `h${json.length}` }),
      provider: "foreverlearning",
    });
    return { added, transport };
  }

  it("attaches a workspace that fits", async () => {
    const { added, transport } = transportWith(`{"x":"${"a".repeat(1000)}"}`);
    await transport.sendUserMessage("hello");
    expect(added[0].rightContent).toEqual(expect.any(String));
  });

  it("sends the turn without the workspace rather than failing the write", async () => {
    const { added, transport } = transportWith(`{"x":"${"a".repeat(1_100_000)}"}`);
    await transport.sendUserMessage("hello");
    expect(added).toHaveLength(1);
    expect(added[0]).not.toHaveProperty("rightContent");
    expect(added[0].text).toBe("hello");
  });
});

// Firestore enforces its limit in bytes; a JavaScript string's length is UTF-16 code units. A
// snapshot full of non-ASCII can pass a length check and still exceed 1 MiB on the wire, which is
// the write failure the budget exists to avoid.
describe("FirestoreTransport measures the workspace in bytes", () => {
  it("drops a snapshot that is under the budget in characters but over it in bytes", async () => {
    const { added, firestore } = fakeFirestore();
    // Each emoji is 2 UTF-16 units and 4 UTF-8 bytes: 280k of them is 560k "length" but 1.12 MB.
    const json = `{"x":"${"\u{1F600}".repeat(280_000)}"}`;
    expect(json.length).toBeLessThan(900_000);
    const transport = new FirestoreTransport({
      firestore, conversationId: "conv1", uid: "123", contextId: "class1",
      problemPath: "sas/1/2", getLeftContext: () => "{}", getRightSummary: () => undefined,
      getRightContent: () => ({ json, hash: "h" }), provider: "foreverlearning",
    });
    await transport.sendUserMessage("hello");
    expect(added).toHaveLength(1);
    expect(added[0]).not.toHaveProperty("rightContent");
  });
});
