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
  it("sends the prompt overrides under a non-default provider", async () => {
    const { added, transport } = makeTransport("foreverlearning", { replace: "REPLACED" });
    await transport.sendUserMessage("hello");
    expect(added[0].promptReplace).toBe("REPLACED");
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

// A tutor backend keys its memory on this, not on uid — see canonical-user-id.ts. It rides on
// every message rather than only FL-bound ones, so the field means the same thing whatever
// backend a conversation later turns out to use.
describe("FirestoreTransport canonical user id", () => {
  function transportWith(canonicalUserId?: string) {
    const { added, firestore } = fakeFirestore();
    const transport = new FirestoreTransport({
      firestore, conversationId: "conv1", uid: "123", contextId: "class1",
      problemPath: "sas/1/2", getLeftContext: () => "{}",
      getRightSummary: () => undefined, canonicalUserId,
    });
    return { added, transport };
  }

  it("stamps the canonical user id on the message", async () => {
    const { added, transport } = transportWith("https://learn.concord.org/users/123");
    await transport.sendUserMessage("hello");
    expect(added[0].canonicalUserId).toBe("https://learn.concord.org/users/123");
    // uid stays: it is what the rules pin to the token and what owns the document.
    expect(added[0].uid).toBe("123");
  });

  it("omits the field when the caller has none, rather than sending an empty one", async () => {
    const { added, transport } = transportWith(undefined);
    await transport.sendUserMessage("hello");
    expect(added[0]).not.toHaveProperty("canonicalUserId");
  });
});
