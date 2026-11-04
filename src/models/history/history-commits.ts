export interface ICommittedEntry {
  id: string;
  index: number;
}

// Why entries that hadn't committed yet will never be reported as committed.
export type VoidReason = "remote-entry";

export interface ICommitListener {
  // The entries that just committed, in chain order, each entry reported once.
  onCommitted(entries: ICommittedEntry[]): void;
  onUncommittedVoided(reason: VoidReason): void;
}

export interface ICommitSource {
  // Returns a function that removes the listener.
  addCommitListener(listener: ICommitListener): () => void;
  // This session's newest committed local entry.
  readonly lastCommitted: ICommittedEntry | undefined;
  // The last Firestore entry the load applied to the content, when it applied any.
  readonly caughtUpTo?: ICommittedEntry;
}

export function isCommitSource(manager: unknown): manager is ICommitSource {
  return !!manager && typeof (manager as ICommitSource).addCommitListener === "function";
}
