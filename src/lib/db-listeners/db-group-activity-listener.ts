import firebase from "firebase/app";
import { reaction, IReactionDisposer } from "mobx";
import { DB } from "../db";
import { BaseListener } from "./base-listener";

export class DBGroupActivityListener extends BaseListener {
  private db: DB;
  private usersRef: firebase.database.Reference | null = null;
  private disposer: IReactionDisposer | null = null;

  constructor(db: DB) {
    super("DBGroupActivityListener");
    this.db = db;
  }

  public start() {
    return new Promise<void>((resolve) => {
      // React to currentGroupId so the subscription re-arms when a user
      // joins a group after boot (e.g., a fresh student who starts on a
      // personal doc and is assigned to a group asynchronously).
      this.disposer = reaction(
        () => this.db.stores.user.currentGroupId,
        groupId => this.subscribeToGroup(groupId),
        { fireImmediately: true }
      );
      resolve();
    });
  }

  public stop() {
    this.disposer?.();
    this.disposer = null;
    this.unsubscribeFromCurrentGroup();
  }

  private subscribeToGroup(groupId: string | undefined) {
    this.unsubscribeFromCurrentGroup();
    if (!groupId) return;
    const { user } = this.db.stores;
    const path = `${this.db.firebase.getGroupPath(user, groupId)}/users`;
    this.usersRef = this.db.firebase.ref(path);
    this.debugLogHandler("#subscribeToGroup", "adding", "on value", this.usersRef);
    this.usersRef.on("value", this.handleUsers);
  }

  private unsubscribeFromCurrentGroup() {
    if (this.usersRef) {
      this.debugLogHandler("#unsubscribeFromCurrentGroup", "removing", "on value", this.usersRef);
      this.usersRef.off("value", this.handleUsers);
      this.usersRef = null;
    }
    this.db.stores.groupActivity.clear();
  }

  private handleUsers = (snapshot: firebase.database.DataSnapshot) => {
    const { groupActivity } = this.db.stores;
    this.debugLogSnapshot("#handleUsers", snapshot);
    const value = snapshot.val() || {};
    const seen = new Set<string>();
    Object.keys(value).forEach(userId => {
      const activity = value[userId]?.activity;
      if (activity && typeof activity.documentKey === "string") {
        groupActivity.setActivity({
          userId,
          documentKey: activity.documentKey,
          focus: activity.focus
            ? { tileIds: activity.focus.tileIds || [] }
            : undefined,
          updatedAt: activity.updatedAt || 0
        });
        seen.add(userId);
      }
    });
    // Remove users whose activity disappeared
    Array.from(groupActivity.activities.keys()).forEach(userId => {
      if (!seen.has(userId)) groupActivity.removeActivity(userId);
    });
  };
}
