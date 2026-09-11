// The contract between the drain engine and a tutor backend.
//
// Everything Firestore-shaped — the lock, the drain cursor, the batch commit, the owner fields —
// stays in drain.ts, which refuses a parentUpdate that reaches for any of them. A provider sees
// only the parent doc's current state plus the triggering message, and returns what to persist.
// That split is what lets a second backend sit alongside the OpenAI path without touching the
// lock and cursor machinery.
import {DocumentData} from "firebase-admin/firestore";

import {TutorHighlight} from "../../../shared/chat-tutor-highlight";

export interface TurnResult {
  // The reply to write as an assistant doc. A null text still writes a doc, or the client's
  // "awaiting reply" indicator spins forever.
  assistantText: string | null;
  // Objects in the student's document this reply points at. Optional, not an empty array: a
  // backend that cannot produce them says nothing and the assistant doc omits the field, which
  // the client reads the same as an empty one. The shape is shared/ rather than a backend's own
  // type because it is a wire contract the client reads back off the message.
  highlights?: TutorHighlight[];
  // Parent-doc fields this turn earned (conversation/session ids, install flags, seq). The
  // drain commits them in the same batch as the cursor, so they land atomically or not at all.
  parentUpdate: Record<string, unknown>;
}

export interface TutorProvider {
  processTurn(parent: DocumentData, message: DocumentData): Promise<TurnResult>;
}
