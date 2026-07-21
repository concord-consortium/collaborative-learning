import { ChatStatus, ChatTransport, ChatTurn, DebugSegment } from "./transport";
import { decideContext, RightSummary } from "./right-context";
import { TutorPrompts } from "./tutor-prompts";

export interface DebugTransportOptions {
  // LEFT problem JSON; undefined until the problem's sections have loaded.
  getLeftContext: () => string | undefined;
  // RIGHT workspace summary; undefined until the document content has loaded.
  getRightSummary: () => RightSummary | undefined;
  // unit-authored generic-prompt overrides, if any.
  tutorPrompts?: TutorPrompts;
}

const segmentsToText = (segments: DebugSegment[]): string => segments.map(s => s.text).join("\n\n");

// DebugTransport composes the tutor context locally and renders "what would be sent"
// instead of calling any backend. No Firestore, no OpenAI. The conversation is seeded
// with the would-be LEFT (problem JSON) and RIGHT (workspace markdown) payloads so they
// appear immediately on open; each send then echoes the message and the context the
// live transport would attach, using the same decideContext gates.
export class DebugTransport implements ChatTransport {
  private turns: ChatTurn[] = [];
  private status: ChatStatus = "idle";
  private turnListeners = new Set<(turns: ChatTurn[]) => void>();
  private statusListeners = new Set<(status: ChatStatus) => void>();
  private seq = 0;
  private leftInstalled = false;
  private lastSentRightHash: string | undefined;

  constructor(private options: DebugTransportOptions) {
    this.pushDebugTurn("debug-context", this.contextSegments());
  }

  private pushDebugTurn(idPrefix: string, segments: DebugSegment[]): void {
    this.turns.push({
      id: `${idPrefix}-${this.seq++}`,
      sender: "assistant",
      variant: "debug",
      debugSegments: segments,
      text: segmentsToText(segments),
    });
  }

  // The opening dry run shows the context payloads the live transport would send:
  // LEFT (the whole problem as JSON, attached once on the first message), RIGHT
  // (the workspace markdown summary, re-attached whenever its hash changes), and any
  // unit-authored prompt overrides. The BUILT-IN generic tutor prompt is server-only,
  // so when it is not replaced it is shown as a placeholder.
  private contextSegments(): DebugSegment[] {
    const left = this.options.getLeftContext();
    const right = this.options.getRightSummary();
    const prompts = this.options.tutorPrompts;
    const genericSegments: DebugSegment[] = prompts?.replace
      ? [
          { kind: "note", text: "── generic tutor prompt · REPLACED by unit config ──" },
          { kind: "payload", text: prompts.replace },
        ]
      : [
          { kind: "note", text: [
            "── generic tutor prompt · built-in, server-only ──",
            "(placeholder — the tutoring stance, never-reveal-answers rule, and science lens are",
            "composed server-side; the built-in text is not in the client bundle.)",
          ].join("\n") },
        ];
    const appendSegments: DebugSegment[] = prompts?.append
      ? [
          { kind: "note", text: "── unit-authored addendum (appended to the generic prompt) ──" },
          { kind: "payload", text: prompts.append },
        ]
      : [];
    return [
      { kind: "note", text: [
        "No backend is called — local dry run. The live transport writes each message as a",
        "Firestore doc; the first message carries the LEFT problem JSON (installed once) and",
        "each message whose workspace changed carries a fresh RIGHT markdown summary.",
      ].join("\n") },
      ...genericSegments,
      ...appendSegments,
      { kind: "note", text: "── LEFT · the problem (JSON, sent once on the first message) ──" },
      left !== undefined
        ? { kind: "payload" as const, text: left }
        : { kind: "note" as const, text: "(problem sections not loaded yet — LEFT unavailable)" },
      { kind: "note", text: "── RIGHT · your workspace (markdown, re-sent when it changes) ──" },
      right
        ? { kind: "payload" as const, text: right.markdown }
        : { kind: "note" as const, text: "(workspace document not loaded yet — RIGHT unavailable)" },
    ];
  }

  subscribe(onTurns: (turns: ChatTurn[]) => void, onStatus: (status: ChatStatus) => void): () => void {
    this.turnListeners.add(onTurns);
    this.statusListeners.add(onStatus);
    onTurns([...this.turns]);
    onStatus(this.status);
    return () => {
      this.turnListeners.delete(onTurns);
      this.statusListeners.delete(onStatus);
    };
  }

  private emitTurns() {
    const snapshot = [...this.turns];
    this.turnListeners.forEach(l => l(snapshot));
  }

  private setStatus(status: ChatStatus) {
    this.status = status;
    this.statusListeners.forEach(l => l(status));
  }

  async sendUserMessage(text: string): Promise<void> {
    this.turns.push({ id: `debug-user-${this.seq++}`, sender: "user", text });
    this.emitTurns();
    this.setStatus("generating");

    // resolve on a microtask so subscribers see generating → idle transitions as in the live path
    await Promise.resolve();

    const left = this.options.getLeftContext();
    const right = this.options.getRightSummary();
    const decision = decideContext({
      leftAlreadyInstalled: this.leftInstalled,
      currentRightHash: right?.hash ?? "",
      lastSentRightHash: this.lastSentRightHash,
    });

    const segments: DebugSegment[] = [
      { kind: "note", text: "Your message would be written as a `user` doc with these context payloads:" },
    ];
    if (!decision.attachLeft) {
      segments.push({ kind: "note", text: "── LEFT not attached (already installed) ──" });
    } else if (left === undefined) {
      segments.push({ kind: "note", text: "── LEFT unavailable (problem sections not loaded yet) ──" });
    } else {
      segments.push({ kind: "note", text: "── LEFT attached (first message installs the problem) ──" });
      segments.push({ kind: "payload", text: left });
      this.leftInstalled = true;
    }
    // Prompt overrides ride the same install-eligible sends as LEFT, as in the live transport.
    if (decision.attachLeft) {
      const prompts = this.options.tutorPrompts;
      if (prompts?.replace) {
        segments.push({ kind: "note", text: "── promptReplace attached (replaces the generic prompt) ──" });
        segments.push({ kind: "payload", text: prompts.replace });
      }
      if (prompts?.append) {
        segments.push({ kind: "note", text: "── promptAppend attached (appended to the generic prompt) ──" });
        segments.push({ kind: "payload", text: prompts.append });
      }
    }
    if (!right) {
      segments.push({ kind: "note", text: "── RIGHT unavailable (workspace document not loaded yet) ──" });
    } else if (!decision.attachRight) {
      segments.push({ kind: "note", text: "── RIGHT not attached (workspace unchanged since last send) ──" });
    } else {
      segments.push({ kind: "note", text: "── RIGHT attached (workspace changed since last send) ──" });
      segments.push({ kind: "payload", text: right.markdown });
      this.lastSentRightHash = right.hash;
    }
    segments.push({ kind: "note", text: "The tutor's reply would render here." });

    this.pushDebugTurn("debug-assistant", segments);
    this.emitTurns();
    this.setStatus("idle");
  }
}
