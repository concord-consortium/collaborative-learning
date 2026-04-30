import firebase from "firebase/app";
import { reaction, IReactionDisposer } from "mobx";
import { DB } from "../db";
import { BaseListener } from "./base-listener";

export class DBGroupActivityListener extends BaseListener {
  private db: DB;
  private usersPathRef: firebase.database.Reference | null = null;
  private disposer: IReactionDisposer | null = null;

  constructor(db: DB) {
    super("DBGroupActivityListener");
    this.db = db;
  }

  public start() {
    return new Promise<void>((resolve) => {
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
    this.usersPathRef = this.db.firebase.ref(this.db.firebase.getGroupUsersPath(user, groupId));
    this.debugLogHandler("#subscribeToGroup", "adding", "on value", this.usersPathRef);
    this.usersPathRef.on("value", this.handleUsers);
  }

  private unsubscribeFromCurrentGroup() {
    if (this.usersPathRef) {
      this.debugLogHandler("#unsubscribeFromCurrentGroup", "removing", "on value", this.usersPathRef);
      this.usersPathRef.off("value", this.handleUsers);
      this.usersPathRef = null;
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
