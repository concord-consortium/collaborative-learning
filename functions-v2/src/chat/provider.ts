// The contract between the drain engine and a tutor backend.
//
// Everything Firestore-shaped — the lock, the drain cursor, the atomic batch commit, the owner
// fields — stays in drain.ts. A provider sees only the parent doc's current state plus the
// triggering message, and returns what to persist. That split is what lets a second backend sit
// alongside the OpenAI path without touching the machinery the CLUE-566 spec calls out as hard
// to get right.
import {DocumentData} from "firebase-admin/firestore";

export interface TurnResult {
  // The reply to write as an assistant doc. A null text still writes a doc, or the client's
  // "awaiting reply" indicator spins forever.
  assistantText: string | null;
  // Parent-doc fields this turn earned (conversation/session ids, install flags, seq). The
  // drain commits them in the same batch as the cursor, so they land atomically or not at all.
  parentUpdate: Record<string, unknown>;
}

export interface TutorProvider {
  processTurn(parent: DocumentData, message: DocumentData): Promise<TurnResult>;
}
