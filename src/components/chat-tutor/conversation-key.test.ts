import { conversationDocId } from "./conversation-key";

describe("conversationDocId", () => {
  // Pinned literal: the no-prompts id is the backward-compat contract — conversations
  // created before per-unit prompt overrides existed must keep resolving to the same doc.
  it("matches the pre-override format when no prompts key is given", () => {
    expect(conversationDocId("123", "docKey1", undefined, "sas/1/2"))
      .toBe("uid:123_docKey1_sas_1_2");
  });

  it("uses the network as the prefix when present", () => {
    expect(conversationDocId("123", "docKey1", "my-network", "sas/1/2"))
      .toBe("my-network_docKey1_sas_1_2");
  });

  it("appends the prompts key when given", () => {
    expect(conversationDocId("123", "docKey1", undefined, "sas/1/2", "abc123"))
      .toBe("uid:123_docKey1_sas_1_2_pabc123");
  });

  // A conversation's provider is immutable for its lifetime: the parent doc holds
  // vendor-specific state (an OpenAI conversation id means nothing to another backend),
  // so selecting a non-default provider must resolve to a different doc.
  it("appends the provider when a non-default one is given", () => {
    expect(conversationDocId("123", "docKey1", undefined, "sas/1/2", undefined, "foreverlearning"))
      .toBe("uid:123_docKey1_sas_1_2_vforeverlearning");
  });

  // Both suffixes, in a fixed order. A non-default provider must not swallow the prompts
  // key: the client attaches the authored prompts to install-eligible sends whatever the
  // provider is, and the installed prompt is immutable, so dropping the key here would
  // pin such a conversation to its first prompt forever with no way to reset it.
  it("stacks the provider and prompts keys when both are given", () => {
    expect(conversationDocId("123", "docKey1", undefined, "sas/1/2", "abc123", "foreverlearning"))
      .toBe("uid:123_docKey1_sas_1_2_vforeverlearning_pabc123");
  });

  // Pinned literal: a unit with no summary must produce exactly the id conversationDocId
  // produced before it began taking a unitKey parameter at all -- no `_u...` suffix -- so existing
  // conversations in such units keep resolving to the same doc.
  it("produces the pre-unitKey id when no unitKey is given", () => {
    expect(conversationDocId("123", "docKey1", undefined, "sas/1/2"))
      .toBe("uid:123_docKey1_sas_1_2");
    expect(conversationDocId("123", "docKey1", undefined, "sas/1/2", "abc123", "foreverlearning"))
      .toBe("uid:123_docKey1_sas_1_2_vforeverlearning_pabc123");
  });

  it("appends the unit key after the prompts key when given", () => {
    expect(conversationDocId("123", "docKey1", undefined, "sas/1/2", "abc123", undefined, "def456"))
      .toBe("uid:123_docKey1_sas_1_2_pabc123_udef456");
  });

  it("produces different ids for different unit keys", () => {
    const first = conversationDocId("123", "docKey1", undefined, "sas/1/2", undefined, undefined, "hash-one");
    const second = conversationDocId("123", "docKey1", undefined, "sas/1/2", undefined, undefined, "hash-two");
    expect(first).not.toBe(second);
  });

  it("produces the same id for the same unit key", () => {
    const first = conversationDocId("123", "docKey1", undefined, "sas/1/2", undefined, undefined, "hash-one");
    const second = conversationDocId("123", "docKey1", undefined, "sas/1/2", undefined, undefined, "hash-one");
    expect(first).toBe(second);
  });
});
