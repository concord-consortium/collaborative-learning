// Chat transport abstraction for the AI chat tutor.
//
// The UI talks only to a `ChatTransport`, so the entire sidebar is buildable and
// reviewable with no backend and no OpenAI key. The live FirestoreTransport swaps
// in behind the same interface with no UI changes.

// Authoritative per-conversation status, mirrored from the parent doc in the live path.
export type ChatStatus = "idle" | "generating" | "error";

// A segment of a debug turn's body: `note` is explanatory wrapper text; `payload` is the
// verbatim content that would actually be sent to the server and is rendered monospace
// so it reads as data, distinct from the wrapper prose.
export interface DebugSegment {
  kind: "note" | "payload";
  text: string;
}

export interface ChatTurn {
  id: string;
  sender: "user" | "assistant";
  text: string;
  // optimistic user turn not yet confirmed by the backend (live path only)
  pending?: boolean;
  // `"debug"` marks a DebugTransport dry-run turn. The UI renders these as a distinct
  // diagnostic panel rather than a tutor bubble, and excludes them from the
  // "Tutor said:" live-region announcement. Absent on all live-path turns.
  variant?: "debug";
  // For debug turns: ordered note/payload segments for differentiated rendering. `text`
  // still holds the full concatenation (used for copy-to-clipboard).
  debugSegments?: DebugSegment[];
}

export interface ChatTransport {
  // Subscribe to turn + status changes. Implementations should immediately emit current
  // state. Returns an unsubscribe function.
  subscribe(onTurns: (turns: ChatTurn[]) => void, onStatus: (status: ChatStatus) => void): () => void;
  // Write a user message (live path) / render what would be sent (debug path).
  sendUserMessage(text: string): Promise<void>;
}
