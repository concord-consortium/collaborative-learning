// Application delivery state; these are not model teaching actions.
export type DeliveryState = "retryable" | "unknown" | "blocked" | "failed" | "closed";
export type RecoveryAction = "retry" | "continue" | "new_session";
export interface ChatDelivery {
  id: string;
  messageId: string;
  state: DeliveryState;
  code: string;
  requestId?: string;
}
export function recoveryAction(state: DeliveryState): RecoveryAction | undefined {
  if (state === "retryable" || state === "unknown") return "retry";
  if (state === "failed") return "continue";
  if (state === "closed") return "new_session";
  return undefined;
}
export function deliveryMessage(state: DeliveryState): string {
  switch (state) {
    case "failed": return "Ada could not complete this message. It is saved here. Continue when you are ready to move on.";
    case "retryable": return "Ada is temporarily unavailable. Retry this saved message to continue.";
    case "unknown": return "We could not confirm a completed reply. Check for the reply before sending another message.";
    case "blocked": return "This message needs support before the conversation can continue. Your messages are saved.";
    case "closed": return "This conversation is closed. Start a new conversation to continue.";
  }
}
export function readChatDelivery(value: any): ChatDelivery | undefined {
  return value && typeof value.id === "string" && typeof value.messageId === "string" &&
    typeof value.code === "string" && ["retryable", "unknown", "blocked", "failed", "closed"].includes(value.state)
    ? value : undefined;
}
