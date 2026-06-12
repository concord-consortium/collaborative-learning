import { reaction, IReactionDisposer } from "mobx";
import firebase from "firebase/app";
import { debounce } from "lodash";
import { DB } from "./db";
import { isDrivingQuestionBoardType } from "../models/document/document-types";
import { kActivityDebounceDelay } from "./group-activity-broadcaster";

// Broadcasts the local user's tile focus while they are editing the class-wide
// Driving Question Board, to a class-scoped presence channel so every class member
// (not just group-mates) can see who is working where. Mirrors GroupActivityBroadcaster
// but keys on the DQB document type rather than group membership.
export class DrivingQuestionBoardActivityBroadcaster {
  private db: DB;
  private disposer: IReactionDisposer | null = null;
  private onDisconnectHandler: firebase.database.OnDisconnect | null = null;
  private flush: ReturnType<typeof debounce>;

  constructor(db: DB) {
    this.db = db;
    this.flush = debounce(this.flushNow, kActivityDebounceDelay);
  }

  public start() {
    const { ui, persistentUI } = this.db.stores;
    this.disposer = reaction(
      () => ({
        documentKey: persistentUI.problemWorkspace.primaryDocumentKey,
        tileIds: ui.selectedTileIds.slice()
      }),
      () => this.flush(),
      { fireImmediately: true }
    );
  }

  public stop(): Promise<void> {
    this.flush.cancel();
    this.disposer?.();
    this.disposer = null;

    const onDisconnectHandler = this.onDisconnectHandler;
    this.onDisconnectHandler = null;

    return this.db.clearDQBUserActivity()
      .catch(() => undefined)
      .finally(() => {
        void onDisconnectHandler?.cancel();
      });
  }

  private isDQBOpen(documentKey: string | undefined) {
    if (!documentKey) return false;
    const document = this.db.stores.documents.getDocument(documentKey);
    return !!document && isDrivingQuestionBoardType(document.type);
  }

  private flushNow = async () => {
    const { ui, persistentUI } = this.db.stores;
    const documentKey = persistentUI.problemWorkspace.primaryDocumentKey;
    const tileIds = ui.selectedTileIds.slice();

    // Only broadcast while the Driving Question Board is the open workspace document.
    if (!this.isDQBOpen(documentKey) || tileIds.length === 0) {
      await this.db.clearDQBUserActivity();
      return;
    }

    if (!this.onDisconnectHandler) {
      this.onDisconnectHandler = this.db.setDQBUserActivityOnDisconnect();
    }

    await this.db.setDQBUserActivity({
      documentKey: documentKey!,
      focus: { tileIds }
    });
  };
}
