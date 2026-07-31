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
});
