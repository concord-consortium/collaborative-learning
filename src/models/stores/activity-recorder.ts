import firebase from "firebase/app";
import { reaction, IReactionDisposer } from "mobx";
import { escapeKey } from "../../lib/fire-utils";
import { Firestore } from "../../lib/firestore";
import { AppMode } from "./store-types";
import { UserModelType } from "./user";
import { DocumentModelType } from "../document/document";
import { isPlanningType, isProblemType } from "../document/document-types";
import { HistoryEntryType } from "../history/history";
import { TreeManagerType } from "../history/tree-manager";

// Must equal the floor in firestore.rules' researcher_dashboard block, which refuses a write sooner
// than this after the stored lastActivityAt. activity-recorder.test.ts reads the rule to check.
export const kActivityWriteFloorMs = 5000;
// How long a change whose history has been uploaded waits for a content save that covers it.
export const kActivitySaveTimeoutMs = 30000;
// Consecutive refused writes after which the recorder waits for the next change.
export const kActivityMaxRefusals = 3;

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
 * kActivityWriteFloorMs apart and each covers every change that has landed by then.
 */
export class ActivityRecorder {
  private pending: IPendingChange[] = [];
  private inFlight = false;
  private lastAckAt: number | undefined;
  private refusals = 0;
  private stopped = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private timerDueAt: number | undefined;
  private saveReactions = new Map<DocumentModelType, IReactionDisposer>();

  constructor(private stores: IActivityRecorderStores) {
    window.addEventListener("pagehide", this.handlePageHide);
  }

  dispose() {
    window.removeEventListener("pagehide", this.handlePageHide);
    this.clearTimer();
    this.saveReactions.forEach(dispose => dispose());
    this.saveReactions.clear();
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
    this.stopped = false;
    this.refusals = 0;
    this.pending.push({
      entryId: entry.id, document, inLaunchOffering: this.isInLaunchOffering(document), uploadedAt: Date.now()
    });
    this.watchSaves(document);
    this.schedule();
  }

  private watchSaves(document: DocumentModelType) {
    if (this.saveReactions.has(document)) return;
    this.saveReactions.set(document, reaction(() => document.savedLastHistoryEntryId, () => this.schedule()));
  }

  private unwatchSettledDocuments() {
    this.saveReactions.forEach((dispose, document) => {
      if (!this.pending.some(change => change.document === document)) {
        dispose();
        this.saveReactions.delete(document);
      }
    });
  }

  private isSaved(change: IPendingChange) {
    const { document, entryId } = change;
    const savedId = document.savedLastHistoryEntryId;
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

  private schedule() {
    if (this.inFlight || this.stopped || this.pending.length === 0) return;
    const now = Date.now();
    const landed = this.pending.filter(change => this.hasLanded(change, now));
    if (landed.length === 0) {
      this.setTimer(Math.min(...this.pending.map(change => change.uploadedAt + kActivitySaveTimeoutMs)));
      return;
    }
    const dueAt = this.lastAckAt === undefined ? now : this.lastAckAt + kActivityWriteFloorMs;
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
    this.unwatchSettledDocuments();
    const data: Record<string, any> = {
      lastActivityAt: FieldValue.serverTimestamp(),
      writeCount: FieldValue.increment(1)
    };
    if (changes.some(change => change.inLaunchOffering)) {
      data.changed = { [user.offeringId]: FieldValue.serverTimestamp() };
    }
    this.inFlight = true;
    db.firestore.documentRef(this.documentPath).set(data, { merge: true })
      .then(() => {
        this.refusals = 0;
      })
      .catch(error => {
        // Refused by the rule's floor (another tab wrote) or otherwise failed: keep the changes for the
        // next write.
        this.pending = [...changes, ...this.pending];
        changes.forEach(change => this.watchSaves(change.document));
        this.refusals++;
        if (this.refusals >= kActivityMaxRefusals) this.stopped = true;
        console.warn("Could not record researcher dashboard activity", error);
      })
      .finally(() => {
        this.lastAckAt = Date.now();
        this.inFlight = false;
        this.schedule();
      });
  }

  private handlePageHide = () => {
    if (!this.isEnabled || this.pending.length === 0) return;
    this.clearTimer();
    this.write([...this.pending]);
  };
}
