import { useCallback, useEffect, useRef, useState } from "react";
import { ChatStatus, ChatTransport, ChatTurn } from "./transport";
import { Logger } from "../../lib/logger";
import { LogEventName } from "../../lib/logger-types";

// A deadline rather than a smarter reading of status: no client state distinguishes a dead turn
// from a slow one, since the drain commits its reply and its cursor together. Erring short is the
// cheaper mistake, because a late reply still renders and clears the message. Retune against
// AI_CHAT_TIMEOUT over AI_CHAT_MESSAGE_SENT.
export const kReplyDeadlineMs = 30_000;

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
}

export interface ChatLogContext extends Record<string, unknown> {
  // Joins a log row to the Firestore conversation it came from, which is the lookup a report of
  // one stuck chat needs. problemPath is already on every log message, so it isn't repeated here.
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
  // Reopening a wedged conversation re-arms the deadline from rehydrated history. The message
  // should appear every time, but only a send made here counts, or repeat views inflate the rate.
  const sentThisSessionRef = useRef(false);

  // Re-subscribe whenever the transport instance changes — this is the hard
  // conversation swap when the student switches documents or problems.
  useEffect(() => {
    // Reset transient UI state so a conversation swap doesn't carry the previous
    // conversation's status/error into the new one before its first snapshot arrives.
    setError(null);
    setStatus("idle");
    setTurns([]);
    sentThisSessionRef.current = false;
    return transport.subscribe(setTurns, setStatus);
  }, [transport]);

  // Surface an authoritative `status:"error"` as a visible error (never an infinite spinner).
  useEffect(() => {
    if (status === "error") {
      setError("Ada is currently unavailable. Please try again.");
      // Gated like the timeout below: the parent doc's "error" persists in Firestore, so every
      // reopen of a failed conversation would otherwise log again with no matching send.
      if (logContext && sentThisSessionRef.current) Logger.log(LogEventName.AI_CHAT_UNAVAILABLE, logContext);
    }
  }, [status, logContext]);

  // The live transport folds "a just-sent user message awaits a reply" into the status it
  // emits — computed from the raw doc stream, so a silent reply clears it.
  const waiting = status === "generating";
  const newestTurnId = turns.length ? turns[turns.length - 1].id : undefined;

  // Keyed on the newest turn as well as `waiting`: a second message sent mid-wait must start its
  // own clock rather than inherit the first one's and be cut off seconds after the student sent
  // it. The id is minted client-side by the transport's add(), so the optimistic turn and its
  // confirmation share one id and this changes exactly once per message.
  useEffect(() => {
    setTimedOut(false);
    if (!waiting) return;
    const timer = setTimeout(() => {
      setTimedOut(true);
      if (logContext && sentThisSessionRef.current) Logger.log(LogEventName.AI_CHAT_TIMEOUT, logContext);
    }, kReplyDeadlineMs);
    return () => clearTimeout(timer);
  }, [waiting, newestTurnId, logContext]);

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

  return { turns, status, error, pending, timedOut, sendMessage, header };
}
