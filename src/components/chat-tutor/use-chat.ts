import { useCallback, useEffect, useRef, useState } from "react";
import { ChatStatus, ChatTransport, ChatTurn } from "./transport";
import { ChatDelivery, RecoveryAction } from "../../../shared/chat-delivery";
import { Logger } from "../../lib/logger";
import { LogEventName } from "../../lib/logger-types";

// A deadline rather than a smarter reading of status: no client state distinguishes a dead turn
// from a slow one, since the drain commits its reply and its cursor together. Erring short is the
// cheaper mistake, because a late reply still renders and clears the message. Retune against
// AI_CHAT_TIMEOUT over AI_CHAT_MESSAGE_SENT.
export const kReplyDeadlineMs = 30_000;
const kUnavailableMessage = "Ada is currently unavailable. Please try again.";

// Distinct from the status:"error" message below: the backend reporting an error and the backend
// reporting nothing are different failures, and support can't tell them apart if they read alike.
export const kTimeoutMessage = "Ada didn't answer. Please try again.";

export interface UseChatResult {
  turns: ChatTurn[];
  status: ChatStatus;
  error: string | null;
  pending: boolean;
  timedOut: boolean;
  sendMessage: (text: string) => Promise<void>;
  header: string;
  delivery?: ChatDelivery;
  recover?: (action: RecoveryAction) => Promise<void>;
}

export interface ChatLogContext extends Record<string, unknown> {
  // Joins a log row to the Firestore conversation it came from, which is the lookup a report of
  // one stuck chat needs. problemPath is already on every log message, so it isn't repeated here.
  // Always the owner-bound id; a reused legacy conversation's id is its suffix.
  conversationId: string;
  documentKey: string;
}

export interface UseChatOptions {
  transport: ChatTransport;
  // Makes the per-document/per-problem scoping legible in the drawer header.
  header: string;
  // Optional so the debug transport and tests need not supply it. Identifiers only: no message
  // text ever goes into a log, which reaches a research database and Rollbar.
  logContext?: ChatLogContext;
}

export function useChat({ transport, header, logContext }: UseChatOptions): UseChatResult {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [delivery, setDelivery] = useState<ChatDelivery>();
  const [recoveryAttempt, setRecoveryAttempt] = useState(0);
  // Reopening a wedged conversation re-arms the deadline from rehydrated history. The message
  // should appear every time, but only a send made here counts, or repeat views inflate the rate.
  const sentThisSessionRef = useRef(false);
  const transportRef = useRef(transport);

  // Re-subscribe whenever the transport instance changes — this is the hard
  // conversation swap when the student switches documents or problems.
  useEffect(() => {
    // Reset transient UI state so a conversation swap doesn't carry the previous
    // conversation's status/error into the new one before its first snapshot arrives.
    setError(null);
    setStatus("idle");
    setTurns([]);
    sentThisSessionRef.current = false;
    setDelivery(undefined);
    transportRef.current = transport;
    return transport.subscribe(setTurns, (value, currentDelivery) => {
      setStatus(value); setDelivery(currentDelivery);
    });
  }, [transport]);

  // Surface an authoritative `status:"error"` as a visible error (never an infinite spinner).
  // Clears only its own message, so a rejected send or recovery keeps its error.
  useEffect(() => {
    if (status === "error" && !delivery) {
      setError(kUnavailableMessage);
      // Gated like the timeout below: the parent doc's "error" persists in Firestore, so every
      // reopen of a failed conversation would otherwise log again with no matching send.
      if (logContext && sentThisSessionRef.current) Logger.log(LogEventName.AI_CHAT_UNAVAILABLE, logContext);
    } else {
      setError(current => current === kUnavailableMessage ? null : current);
    }
  }, [status, logContext, delivery]);

  // FL failures reuse AI_CHAT_UNAVAILABLE rather than a new event, so existing reporting counts them.
  // Once per sent message (retries share its messageId), so this stays a rate over AI_CHAT_MESSAGE_SENT.
  const failure = delivery && status !== "generating" && delivery.state !== "closed" ? delivery : undefined;
  const failureMessageId = failure?.messageId;
  const failureState = failure?.state;
  const failureCode = failure?.code;
  const loggedFailureMessageRef = useRef<string>();
  useEffect(() => {
    if (failureMessageId && failureMessageId !== loggedFailureMessageRef.current &&
        logContext && sentThisSessionRef.current) {
      loggedFailureMessageRef.current = failureMessageId;
      Logger.log(LogEventName.AI_CHAT_UNAVAILABLE,
        { ...logContext, deliveryState: failureState, deliveryCode: failureCode });
    }
  }, [failureMessageId, failureState, failureCode, logContext]);

  // The live transport folds "a just-sent user message awaits a reply" into the status it
  // emits — computed from the raw doc stream, so a silent reply clears it.
  const waiting = status === "generating";
  const newestTurnId = turns.length ? turns[turns.length - 1].id : undefined;

  // Keyed on the message the wait is for: the delivery's source message while one is recorded, so a
  // recovery's re-armed deadline does not log again, else the newest turn, so a second message sent
  // mid-wait starts its own clock. Turn ids are minted client-side by the transport's add(), so the
  // optimistic turn and its confirmation share one id.
  const waitingForId = delivery?.messageId ?? newestTurnId;
  const loggedTimeoutRef = useRef<string>();
  useEffect(() => {
    setTimedOut(false);
    if (!waiting) return;
    const timer = setTimeout(() => {
      setTimedOut(true);
      if (logContext && sentThisSessionRef.current && waitingForId !== loggedTimeoutRef.current) {
        loggedTimeoutRef.current = waitingForId;
        Logger.log(LogEventName.AI_CHAT_TIMEOUT, logContext);
      }
    }, kReplyDeadlineMs);
    return () => clearTimeout(timer);
  }, [waiting, newestTurnId, waitingForId, logContext, recoveryAttempt]);

  const pending = waiting && !timedOut;

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setError(null);
    try {
      await transport.sendUserMessage(trimmed);
      // Only once the write landed, so the denominator counts messages the backend could
      // actually have answered.
      sentThisSessionRef.current = true;
      // No context means the debug transport, which is ungated in every appMode: its dry runs
      // would inflate the denominator with rows carrying no conversation.
      if (logContext) Logger.log(LogEventName.AI_CHAT_MESSAGE_SENT, logContext);
    } catch (e) {
      setError((e as Error)?.message || "Failed to send your message. Please try again.");
      throw e;
    }
  }, [transport, logContext]);

  const recover = useCallback(async (action: RecoveryAction) => {
    setError(null);
    // A recovery that settles after the drawer has moved to another conversation must not touch it.
    try {
      await transport.recover?.(action);
      if (transportRef.current === transport) setRecoveryAttempt(n => n + 1);
    } catch (e) {
      if (transportRef.current === transport) setError((e as Error).message);
    }
  }, [transport]);
  return { turns, status, error, pending, timedOut, sendMessage, header, delivery,
    ...(transport.recover ? { recover } : {}) };
}
