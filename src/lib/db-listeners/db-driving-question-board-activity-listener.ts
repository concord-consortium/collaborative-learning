import firebase from "firebase/app";
import { reaction, IReactionDisposer } from "mobx";
import { DB } from "../db";
import { BaseListener } from "./base-listener";

// Listens to the class-scoped Driving Question Board presence channel and mirrors it
// into the dqbActivity store so tile presence badges can show every class member who is
// focused on a tile of the shared board. Mirrors DBGroupActivityListener but is scoped
// to the class (via classHash) rather than to a single group.
export class DBDrivingQuestionBoardActivityListener extends BaseListener {
  private db: DB;
  private usersPathRef: firebase.database.Reference | null = null;
  private disposer: IReactionDisposer | null = null;

  constructor(db: DB) {
    super("DBDrivingQuestionBoardActivityListener");
    this.db = db;
  }

  public start() {
    return new Promise<void>((resolve) => {
      this.disposer = reaction(
        () => this.db.stores.user.classHash,
        classHash => this.subscribeToClass(classHash),
        { fireImmediately: true }
      );
      resolve();
    });
  }

  public stop() {
    this.disposer?.();
    this.disposer = null;
    this.unsubscribe();
  }

  private subscribeToClass(classHash: string | undefined) {
    this.unsubscribe();
    if (!classHash) return;
    const { user } = this.db.stores;
    this.usersPathRef = this.db.firebase.ref(this.db.firebase.getDQBActivityUsersPath(user));
    this.debugLogHandler("#subscribeToClass", "adding", "on value", this.usersPathRef);
    this.usersPathRef.on("value", this.handleUsers);
  }

  private unsubscribe() {
    if (this.usersPathRef) {
      this.debugLogHandler("#unsubscribe", "removing", "on value", this.usersPathRef);
      this.usersPathRef.off("value", this.handleUsers);
      this.usersPathRef = null;
    }
    this.db.stores.dqbActivity.clear();
  }

  private handleUsers = (snapshot: firebase.database.DataSnapshot) => {
    const { dqbActivity } = this.db.stores;
    this.debugLogSnapshot("#handleUsers", snapshot);
    const value = snapshot.val() || {};
    const seen = new Set<string>();
    Object.keys(value).forEach(userId => {
      const activity = value[userId]?.activity;
      if (activity && typeof activity.documentKey === "string") {
        dqbActivity.setActivity({
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
    Array.from(dqbActivity.activities.keys()).forEach(userId => {
      if (!seen.has(userId)) dqbActivity.removeActivity(userId);
    });
  };
}
