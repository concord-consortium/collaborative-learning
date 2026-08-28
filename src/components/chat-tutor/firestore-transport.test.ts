// The transport reaches firebase.firestore.FieldValue.serverTimestamp() for createdAt, which
// is undefined unless the firestore module is loaded. The real call returns an opaque sentinel
// the server resolves on write, so a marker stands in for it faithfully — these tests assert
// which fields are present, never what createdAt resolves to.
jest.mock("firebase/app", () => ({
  __esModule: true,
  default: { firestore: { FieldValue: { serverTimestamp: () => "server-timestamp" } } },
}));

import { FirestoreTransport } from "./firestore-transport";
import { TutorProviderId } from "./tutor-provider";

// Minimal stand-in for the Firestore handle the transport reaches through. Only the
// add() path is exercised here; subscribe() is not called, so no listeners are needed.
function fakeFirestore() {
  const added: Record<string, unknown>[] = [];
  const messages = { add: (doc: Record<string, unknown>) => { added.push(doc); return Promise.resolve(); } };
  const firestore = { collection: () => ({ doc: () => ({ collection: () => messages }) }) };
  return { added, firestore: firestore as any };
}

function makeTransport(provider?: TutorProviderId) {
  const { added, firestore } = fakeFirestore();
  const transport = new FirestoreTransport({
    firestore,
    conversationId: "conv1",
    uid: "123",
    contextId: "class1",
    problemPath: "sas/1/2",
    getLeftContext: () => "{}",
    getRightSummary: () => undefined,
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
