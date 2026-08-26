/**
 * A reply is awaited when the newest user message is newer than the newest assistant message.
 *
 * Every message counts, including an assistant reply whose userText is null. That reply renders
 * nothing, but it is what tells the client the tutor has finished — narrowing this list to the
 * messages that produce a visible turn would leave the typing indicator running forever.
 */
export function isAwaitingReply(kinds: Array<string | undefined>): boolean {
  let lastUser = -1;
  let lastAssistant = -1;
  kinds.forEach((kind, index) => {
    if (kind === "user") lastUser = index;
    else if (kind === "assistant") lastAssistant = index;
  });
  return lastUser > lastAssistant;
}
