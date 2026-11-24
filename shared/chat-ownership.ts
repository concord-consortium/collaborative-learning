// Owner-bound ids support uid- and network-based legacy workspace keys. The length prefix
// makes underscores/colons unambiguous. Rules mirror this literal check, without a uid regex.
export function chatOwnerPrefix(uid: string): string {
  return `owner:${uid.length}:${uid}_`;
}

export function ownedConversationId(uid: string, contextId: string, legacyId: string): string {
  return `${chatOwnerPrefix(uid)}${encodeURIComponent(contextId)}_${legacyId}`;
}

export function canStartConversation(id: string, uid: string): boolean {
  const prefix = chatOwnerPrefix(uid);
  return id.length > prefix.length && id.startsWith(prefix);
}

export const kChatOwnerFields = ["uid", "context_id", "problemPath"] as const;

export function hasChatOwner(fields: Record<string, unknown>): boolean {
  return kChatOwnerFields.every(field => typeof fields[field] === "string" && (fields[field] as string).length > 0);
}

export function sameChatOwner(parent: Record<string, unknown>, message: Record<string, unknown>): boolean {
  return hasChatOwner(parent) && kChatOwnerFields.every(field => parent[field] === message[field]);
}
