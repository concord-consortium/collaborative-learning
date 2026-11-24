import {DeliveryState} from "../../../shared/chat-delivery";

// The drain has already published and released a durable failure. The trigger must not
// write status again: a recovery invocation may already own the conversation now.
export class RecordedDeliveryError extends Error {
  constructor(error: unknown) {
    super(error instanceof Error ? error.message : String(error));
    this.name = "RecordedDeliveryError";
  }
}

export class FlDeliveryError extends Error {
  constructor(public readonly state: Exclude<DeliveryState, "closed">,
    public readonly code: string, public readonly httpStatus?: number) {
    super(httpStatus ? `ForeverLearning chat request failed with status ${httpStatus} (${code})` : code);
    this.name = "FlDeliveryError";
  }
}

export function flResponseFailure(status: number, code?: string): FlDeliveryError {
  // Only the admission ledger's explicit failed response proves terminal failure. An SSE
  // execution error can precede a failed persistence operation, so it is not that proof.
  if (status === 422 && code === "CLUE_TURN_FAILED") return new FlDeliveryError("failed", code, status);
  if (code === "CLUE_IDEMPOTENCY_CONFLICT") return new FlDeliveryError("blocked", code, status);
  if ([401, 403, 429].includes(status)) return new FlDeliveryError("retryable", `HTTP_${status}`, status);
  return new FlDeliveryError("unknown", code || `HTTP_${status}`, status);
}
