// The contract between the drain engine and a tutor backend.
//
// Firestore ownership stays in the drain and its persistence helper. Providers receive the
// current parent/message plus an optional reservation seam; they never receive a document ref.
// The drain protects its lock/cursor/owner fields and atomically commits successful delivery.
import {DocumentData} from "firebase-admin/firestore";

import {TutorHighlight} from "../../../shared/chat-tutor-highlight";

export interface TurnResult {
  // The reply to write as an assistant doc. A null text still writes a doc, or the client's
  // "awaiting reply" indicator spins forever.
  assistantText: string | null;
  // FL request id and whether FL ended the session; the drain records both on success.
  requestId?: string;
  sessionClosed?: boolean;
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
  processTurn(parent: DocumentData, message: DocumentData, persistence?: TurnPersistence): Promise<TurnResult>;
}

// Supplied by the drain for the actual source message, never from client message fields.
export interface TurnPersistence {
  reserve<T extends object>(prepare: () => Promise<T>): Promise<T>;
}
