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

export function sameChatOwner(parent: Record<string, unknown>, message: Record<string, unknown>): boolean {
  return ["uid", "context_id", "problemPath"].every(field =>
    typeof parent[field] === "string" && (parent[field] as string).length > 0 && parent[field] === message[field]);
}
