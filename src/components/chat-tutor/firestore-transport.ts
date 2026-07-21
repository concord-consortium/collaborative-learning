import firebase from "firebase/app";
import { Firestore } from "../../lib/firestore";
import { ChatStatus, ChatTransport, ChatTurn } from "./transport";
import { decideContext, RightSummary } from "./right-context";
import { TutorPrompts } from "./tutor-prompts";

// Top-level (per Firestore root) chat collection; a parent conversation doc per
// conversationId, each with a `messages` subcollection. The parent doc is created
// server-side on the first send — the client writes only message docs.
export const kChatTutorCollection = "chatTutor";

export interface FirestoreTransportOptions {
  firestore: Firestore;
  // canonical conversation doc id (already escaped — see conversationDocId)
  conversationId: string;
  // string form of the platform user id, matching CLUE's document uid convention
  uid: string;
  // the user's class_hash; the rules pin it to the token's claim
  contextId: string;
  // raw (unescaped) problemPath, kept queryable on every message doc
  problemPath: string;
  // LEFT problem JSON; undefined until the problem's sections have loaded
  getLeftContext: () => string | undefined;
  // RIGHT workspace summary; undefined until the document content has loaded
  getRightSummary: () => RightSummary | undefined;
  // unit-authored generic-prompt overrides; static for the page's lifetime (unit
  // config can't change without a reload, which rebuilds the transport)
  tutorPrompts?: TutorPrompts;
}

// Live transport: writes `user` message docs to the conversation's messages
// collection and renders `assistant` replies via onSnapshot; reload rehydrates
// from Firestore.
export class FirestoreTransport implements ChatTransport {
  private unsubMessages?: () => void;
  private unsubParent?: () => void;
  // Combined status inputs: the authoritative parent `status`, plus an optimistic
  // check on the RAW doc stream (a just-sent `user` doc with no following assistant
  // doc yet). Using the raw stream — not the rendered turn list — means a silent
  // `userText:null` reply clears "awaiting" even though it renders nothing, so the
  // typing indicator can't spin forever.
  private parentStatus: ChatStatus = "idle";
  private awaitingReply = false;
  // mirrors the parent doc's problemInstalled flag; a not-yet-created parent reads
  // as false, so the first send attaches LEFT
  private problemInstalled = false;
  private lastSentRightHash: string | undefined;
  private onStatus?: (status: ChatStatus) => void;

  constructor(private readonly opts: FirestoreTransportOptions) {}

  private parentRef() {
    return this.opts.firestore.collection(kChatTutorCollection).doc(this.opts.conversationId);
  }

  private messagesRef() {
    return this.parentRef().collection("messages");
  }

  // Firestore evaluates a listen against the QUERY, and the read rule references
  // resource.data.uid — an unfiltered listen is denied outright, so the owner
  // filter is required, not an optimization. Combined with orderBy this needs the
  // (uid, createdAt) composite index in firestore.indexes.json.
  private messagesQuery() {
    return this.messagesRef().where("uid", "==", this.opts.uid).orderBy("createdAt");
  }

  private emitStatus() {
    if (!this.onStatus) return;
    const effective: ChatStatus =
      this.parentStatus === "error" ? "error"
        : this.awaitingReply ? "generating" : "idle";
    this.onStatus(effective);
  }

  // Snapshot read errors are not tutor failures by default: `permission-denied` is
  // the expected benign case before the server creates the parent doc on the first
  // send (the read rule derefs resource.data.uid, which errors on a missing doc).
  // Treat it as "no conversation yet" → idle; any other code is a real failure.
  private onReadError(where: string, err: { code?: string; message?: string }) {
    console.warn(`[chat-tutor] ${where} read error (${err.code}):`, err.message);
    this.parentStatus = err.code === "permission-denied" ? "idle" : "error";
    this.emitStatus();
  }

  subscribe(onTurns: (turns: ChatTurn[]) => void, onStatus: (status: ChatStatus) => void): () => void {
    this.onStatus = onStatus;
    this.parentStatus = "idle";
    this.awaitingReply = false;
    onTurns([]);
    this.emitStatus();

    // Estimate pending serverTimestamps so a just-sent doc orders correctly before
    // the server resolves it (otherwise it can momentarily sort to the top as null).
    this.unsubMessages = this.messagesQuery().onSnapshot(
      snapshot => {
        const turns: ChatTurn[] = [];
        let idx = 0;
        let lastUserIdx = -1;
        let lastAssistantIdx = -1;
        snapshot.forEach(doc => {
          const data = doc.data({ serverTimestamps: "estimate" }) as any;
          if (data.kind === "user") {
            lastUserIdx = idx;
            turns.push({
              id: doc.id, sender: "user", text: data.text ?? "", pending: doc.metadata.hasPendingWrites
            });
          } else if (data.kind === "assistant") {
            lastAssistantIdx = idx;
            // userText === null is a silent reply — it clears the wait but renders nothing
            if (data.userText != null) turns.push({ id: doc.id, sender: "assistant", text: data.userText });
          }
          idx++;
        });
        this.awaitingReply = lastUserIdx > lastAssistantIdx;
        onTurns(turns);
        this.emitStatus();
      },
      err => this.onReadError("messages", err)
    );

    this.unsubParent = this.parentRef().onSnapshot(
      doc => {
        const data = doc.exists ? doc.data() as any : undefined;
        const status = data?.status;
        this.parentStatus = status === "generating" ? "generating" : status === "error" ? "error" : "idle";
        this.problemInstalled = !!data?.problemInstalled;
        this.emitStatus();
      },
      err => this.onReadError("parent", err)
    );

    return () => this.dispose();
  }

  async sendUserMessage(text: string): Promise<void> {
    const { uid, contextId, problemPath, getLeftContext, getRightSummary, tutorPrompts } = this.opts;
    const right = getRightSummary();
    const decision = decideContext({
      leftAlreadyInstalled: this.problemInstalled,
      currentRightHash: right?.hash ?? "",
      lastSentRightHash: this.lastSentRightHash,
    });

    let leftContext: string | undefined;
    if (decision.attachLeft) {
      leftContext = getLeftContext();
      if (leftContext === undefined) {
        // first-send gate: an empty LEFT would ground the tutor with no problem context
        throw new Error("The problem is still loading. Please try again in a moment.");
      }
    }

    // Field names must match the rules' create whitelist exactly. context_id and
    // problemPath ride on every message because the server stamps the parent doc's
    // owner fields off the triggering message. createdAt must be a serverTimestamp()
    // Timestamp — a numeric value would sort before every server Timestamp and
    // scramble both the transcript and the drain cursor.
    const message: Record<string, unknown> = {
      uid,
      kind: "user",
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      text,
      context_id: contextId,
      problemPath,
    };
    if (leftContext !== undefined) {
      message.leftContext = leftContext;
    }
    // Prompt overrides ride the same install-eligible sends as LEFT (the server uses
    // them only while installing the generic prompt, and ignores them afterwards).
    if (decision.attachLeft) {
      if (tutorPrompts?.replace) message.promptReplace = tutorPrompts.replace;
      if (tutorPrompts?.append) message.promptAppend = tutorPrompts.append;
    }
    if (decision.attachRight && right) {
      message.rightContext = right.markdown;
    }

    await this.messagesRef().add(message);

    if (decision.attachRight && right) {
      this.lastSentRightHash = right.hash;
    }
  }

  dispose(): void {
    this.unsubMessages?.();
    this.unsubParent?.();
    this.unsubMessages = undefined;
    this.unsubParent = undefined;
    this.onStatus = undefined;
  }
}
