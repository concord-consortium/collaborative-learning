import {
  canStartConversation, hasChatOwner, kChatOwnerFields, ownedConversationId, sameChatOwner
} from "./chat-ownership";

it("separates different learners on the same network workspace", () => {
  const a = ownedConversationId("101", "class", "network_doc");
  const b = ownedConversationId("202", "class", "network_doc");
  expect(a).not.toBe(b);
  expect(canStartConversation(a, "101")).toBe(true);
  expect(canStartConversation(a, "202")).toBe(false);
});
it.each(["101", "101_more", "a.b+", "é", "😀"])("binds the full literal platform id %s", uid => {
  const id = ownedConversationId(uid, "class", "doc");
  expect(canStartConversation(id, uid)).toBe(true);
  expect(canStartConversation(id, uid + "_more")).toBe(false);
  expect(canStartConversation(id, uid.slice(0, -1))).toBe(false);
});
it("does not accept an unowned legacy path or an empty owner prefix", () => {
  expect(canStartConversation("uid:101_doc", "101")).toBe(false);
  expect(canStartConversation("network_doc", "101")).toBe(false);
  expect(canStartConversation("owner:3:101_", "101")).toBe(false);
});
it("separates classes and retains the original workspace identity", () => {
  expect(ownedConversationId("101", "class/a", "network_doc"))
    .toBe("owner:3:101_class%2Fa_network_doc");
  expect(ownedConversationId("101", "class/a", "network_doc"))
    .not.toBe(ownedConversationId("101", "class_a", "network_doc"));
});
it("requires all immutable owner fields, not just a matching user", () => {
  const owner = {uid: "101", context_id: "class", problemPath: "vibe/1/2"};
  expect(sameChatOwner(owner, {...owner, text: "Question"})).toBe(true);
  for (const field of ["uid", "context_id", "problemPath"]) {
    expect(sameChatOwner(owner, {...owner, [field]: "different"})).toBe(false);
    expect(sameChatOwner({...owner, [field]: undefined}, owner)).toBe(false);
  }
});
it("has an owner only when every owner field is a non-empty string", () => {
  const owner = {uid: "101", context_id: "class", problemPath: "vibe/1/2"};
  expect(hasChatOwner(owner)).toBe(true);
  expect(kChatOwnerFields).toHaveLength(3);
  for (const field of kChatOwnerFields) {
    expect(hasChatOwner({...owner, [field]: undefined})).toBe(false);
    expect(hasChatOwner({...owner, [field]: ""})).toBe(false);
  }
});
