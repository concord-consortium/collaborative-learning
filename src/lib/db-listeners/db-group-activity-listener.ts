import firebase from "firebase/app";
import { DB } from "../db";
import { BaseListener } from "./base-listener";

export class DBGroupActivityListener extends BaseListener {
  private db: DB;
  private usersRef: firebase.database.Reference | null = null;

  constructor(db: DB) {
    super("DBGroupActivityListener");
    this.db = db;
  }

  public start() {
    return new Promise<void>((resolve) => {
      const { user } = this.db.stores;
      const groupId = user.currentGroupId;
      if (!groupId) { resolve(); return; }
      const path = `${this.db.firebase.getGroupPath(user, groupId)}/users`;
      this.usersRef = this.db.firebase.ref(path);
      this.debugLogHandler("#start", "adding", "on value", this.usersRef);
      this.usersRef.on("value", this.handleUsers);
      resolve();
    });
  }

  public stop() {
    if (this.usersRef) {
      this.debugLogHandler("#stop", "removing", "on value", this.usersRef);
      this.usersRef.off("value", this.handleUsers);
      this.usersRef = null;
    }
    this.db.stores.groupActivity.clear();
  }

  private handleUsers = (snapshot: firebase.database.DataSnapshot) => {
    const { groupActivity } = this.db.stores;
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
