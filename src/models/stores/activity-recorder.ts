import firebase from "firebase/app";
import { escapeKey } from "../../lib/fire-utils";
import { Firestore } from "../../lib/firestore";
import { AppMode } from "./store-types";
import { UserModelType } from "./user";
import { DocumentModelType } from "../document/document";
import { isPlanningType, isProblemType } from "../document/document-types";
import { HistoryEntryType } from "../history/history";
import { TreeManagerType } from "../history/tree-manager";

// Each tab's least time between the acknowledgment of one write and the start of the next.
export const kActivityWriteIntervalMs = 5000;
// How long a change whose history has been uploaded waits for a content save that covers it.
export const kActivitySaveTimeoutMs = 30000;
// Each consecutive failed write doubles the wait before the next, up to this.
export const kActivityMaxRetryDelayMs = 60000;

// Entries a running Simulator or DataFlow tile records on its own, every step. They are not activity.
const kTickEntries: Array<{ model: string, actionSuffix: string }> = [
  { model: "SimulatorTool", actionSuffix: "/step" },
  { model: "DataflowProgram", actionSuffix: "/tickAndProcess" }
];

export function isTickEntry(entry: Pick<HistoryEntryType, "model" | "action">) {
  return kTickEntries.some(({ model, actionSuffix }) =>
    entry.model === model && !!entry.action?.endsWith(actionSuffix));
}

export interface IActivityRecorderStores {
  appMode: AppMode;
  user: UserModelType;
  db: { firestore: Firestore };
}

interface IPendingChange {
  entryId: string;
  document: DocumentModelType;
  inLaunchOffering: boolean;
  uploadedAt: number;
}

/**
 * Keeps the launched student's researcher dashboard activity document,
 * researcher_dashboard/{portal}/activity/{classHash}/users/{uid}, current. A change counts once its
 * history entry has been uploaded and a content save covering it has succeeded; writes are at least
 * kActivityWriteIntervalMs apart and each covers every change that has landed by then.
 */
export class ActivityRecorder {
  private pending: IPendingChange[] = [];
  // The changes of failed writes, which have all landed, kept as whether any was in the launch offering.
  private failed: { inLaunchOffering: boolean } | undefined;
  private savedIds = new WeakMap<DocumentModelType, string>();
  private inFlight = false;
  private lastAckAt: number | undefined;
  private failures = 0;
  private listening = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private timerDueAt: number | undefined;

  constructor(private stores: IActivityRecorderStores) {}

  dispose() {
    window.removeEventListener("pagehide", this.handlePageHide);
    this.listening = false;
    this.clearTimer();
  }

  get isEnabled() {
    const { appMode, user } = this.stores;
    return appMode === "authed" && user.isStudent && !!user.classHash && !!user.offeringId;
  }

  get documentPath() {
    const { user } = this.stores;
    return `researcher_dashboard/${escapeKey(user.portal)}/activity/${user.classHash}/users/${user.id}`;
  }

  isInLaunchOffering(document: DocumentModelType) {
    const { user } = this.stores;
    if (isProblemType(document.type) || isPlanningType(document.type)) return true;
    return !!user.userIdForGroupDocuments && document.uid === user.userIdForGroupDocuments;
  }

  onLocalEntryUploaded(document: DocumentModelType, entry: HistoryEntryType) {
    if (!this.isEnabled || isTickEntry(entry)) return;
    if (!this.listening) {
      window.addEventListener("pagehide", this.handlePageHide);
      this.listening = true;
    }
    this.pending.push({
      entryId: entry.id, document, inLaunchOffering: this.isInLaunchOffering(document), uploadedAt: Date.now()
    });
    this.schedule();
  }

  /**
   * Called when this client's content save of the document succeeds, with the history entry id stamped on it.
   * The id is kept because an entry's upload can land after the save that covers it.
   */
  onContentSaved(document: DocumentModelType, lastHistoryEntryId: string) {
    this.savedIds.set(document, lastHistoryEntryId);
    this.schedule();
  }

  private isSaved(change: IPendingChange) {
    const { document, entryId } = change;
    const savedId = this.savedIds.get(document);
    if (!savedId) return false;
    const history = (document.treeManagerAPI as TreeManagerType | undefined)?.document.history;
    if (!history) return false;
    const entryIndex = history.findIndex(e => e.id === entryId);
    const savedIndex = history.findIndex(e => e.id === savedId);
    return entryIndex >= 0 && savedIndex >= entryIndex;
  }

  private hasLanded(change: IPendingChange, now: number) {
    return this.isSaved(change) || now - change.uploadedAt >= kActivitySaveTimeoutMs;
  }

  private setTimer(dueAt: number) {
    if (this.timer && this.timerDueAt !== undefined && this.timerDueAt <= dueAt) return;
    this.clearTimer();
    this.timerDueAt = dueAt;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.timerDueAt = undefined;
      this.schedule();
    }, Math.max(0, dueAt - Date.now()));
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.timerDueAt = undefined;
  }

  private get hasWork() {
    return this.pending.length > 0 || !!this.failed;
  }

  private schedule() {
    if (this.inFlight || !this.hasWork) return;
    const now = Date.now();
    const landed = this.pending.filter(change => this.hasLanded(change, now));
    if (landed.length === 0 && !this.failed) {
      this.setTimer(Math.min(...this.pending.map(change => change.uploadedAt + kActivitySaveTimeoutMs)));
      return;
    }
    const wait = Math.min(kActivityWriteIntervalMs * 2 ** this.failures, kActivityMaxRetryDelayMs);
    const dueAt = this.lastAckAt === undefined ? now : this.lastAckAt + wait;
    if (now < dueAt) {
      this.setTimer(dueAt);
      return;
    }
    this.write(landed);
  }

  private write(changes: IPendingChange[]) {
    const { user, db } = this.stores;
    const { FieldValue } = firebase.firestore;
    this.pending = this.pending.filter(change => !changes.includes(change));
    const inLaunchOffering = !!this.failed?.inLaunchOffering || changes.some(change => change.inLaunchOffering);
    this.failed = undefined;
    const data: Record<string, any> = {
      lastActivityAt: FieldValue.serverTimestamp(),
      writeCount: FieldValue.increment(1)
    };
    if (inLaunchOffering) {
      data.changed = { [user.offeringId]: FieldValue.serverTimestamp() };
    }
    this.inFlight = true;
    db.firestore.documentRef(this.documentPath).set(data, { merge: true })
      .then(() => {
        this.failures = 0;
      })
      .catch(error => {
        this.failed = { inLaunchOffering: inLaunchOffering || !!this.failed?.inLaunchOffering };
        this.failures++;
        console.warn("Could not record researcher dashboard activity", error);
      })
      .finally(() => {
        this.lastAckAt = Date.now();
        this.inFlight = false;
        this.schedule();
      });
  }

  private handlePageHide = () => {
    if (!this.isEnabled || !this.hasWork) return;
    this.clearTimer();
    this.write([...this.pending]);
  };
}
