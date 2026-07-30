import { useCallback, useEffect, useState } from "react";
import { ChatStatus, ChatTransport, ChatTurn } from "./transport";

export interface UseChatResult {
  turns: ChatTurn[];
  status: ChatStatus;
  error: string | null;
  pending: boolean;
  sendMessage: (text: string) => Promise<void>;
  header: string;
}

export interface UseChatOptions {
  transport: ChatTransport;
  // Makes the per-document/per-problem scoping legible in the drawer header.
  header: string;
}

export function useChat({ transport, header }: UseChatOptions): UseChatResult {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  // Re-subscribe whenever the transport instance changes — this is the hard
  // conversation swap when the student switches documents or problems.
  useEffect(() => {
    // Reset transient UI state so a conversation swap doesn't carry the previous
    // conversation's status/error into the new one before its first snapshot arrives.
    setError(null);
    setStatus("idle");
    setTurns([]);
    return transport.subscribe(setTurns, setStatus);
  }, [transport]);

  // Surface an authoritative `status:"error"` as a visible error (never an infinite spinner).
  useEffect(() => {
    if (status === "error") {
      setError("The tutor is currently unavailable. Please try again.");
    }
  }, [status]);

  // The live transport folds "a just-sent user message awaits a reply" into the status it
  // emits — computed from the raw doc stream, so a silent reply clears it.
  const pending = status === "generating";

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setError(null);
    try {
      await transport.sendUserMessage(trimmed);
    } catch (e) {
      setError((e as Error)?.message || "Failed to send your message. Please try again.");
      throw e;
    }
  }, [transport]);

  return { turns, status, error, pending, sendMessage, header };
}
