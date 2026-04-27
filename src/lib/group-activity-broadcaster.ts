import { reaction, IReactionDisposer } from "mobx";
import firebase from "firebase/app";
import { debounce } from "lodash";
import { DB } from "./db";

export const kActivityDebounceDelay = 150;

export class GroupActivityBroadcaster {
  private db: DB;
  private disposer: IReactionDisposer | null = null;
  private onDisconnectHandler: firebase.database.OnDisconnect | null = null;
  private onDisconnectGroupId: string | undefined;
  private flush: ReturnType<typeof debounce>;

  constructor(db: DB) {
    this.db = db;
    this.flush = debounce(this.flushNow, kActivityDebounceDelay);
  }

  public start() {
    const { ui, persistentUI, user } = this.db.stores;
    this.disposer = reaction(
      () => ({
        groupId: user.currentGroupId,
        documentKey: persistentUI.problemWorkspace.primaryDocumentKey,
        tileIds: ui.selectedTileIds.slice()
      }),
      () => this.flush()
    );
  }

  public stop() {
    this.flush.cancel();
    this.disposer?.();
    this.disposer = null;
    this.onDisconnectHandler?.cancel();
    this.onDisconnectHandler = null;
    this.onDisconnectGroupId = undefined;
  }

  private flushNow = async () => {
    const { ui, persistentUI, user } = this.db.stores;
    const groupId = user.currentGroupId;
    const documentKey = persistentUI.problemWorkspace.primaryDocumentKey;
    const tileIds = ui.selectedTileIds.slice();

    if (!groupId) return;

    if (!documentKey || tileIds.length === 0) {
      await this.db.clearGroupUserActivity();
      return;
    }

    if (this.onDisconnectGroupId !== groupId) {
      this.onDisconnectHandler?.cancel();
      this.onDisconnectHandler = this.db.setGroupUserActivityOnDisconnect();
      this.onDisconnectGroupId = groupId;
    }

    await this.db.setGroupUserActivity({
      documentKey,
      focus: { tileIds }
    });
  };
}
