import { IReactionDisposer, reaction } from "mobx";
import { DB } from "../db";
import { BaseListener } from "./base-listener";
import { customCommentTagsPath } from "../../models/stores/comment-tags";

// Keeps the CommentTags store in sync with the current class + unit's teacher-added tags via a
// Firestore onSnapshot listener, so newly-added tags are available to every client immediately.
export class DBCommentTagsListener extends BaseListener {
  private db: DB;
  private reactionDisposer?: IReactionDisposer;
  private unsubscribe?: () => void;

  constructor(db: DB) {
    super("DBCommentTagsListener");
    this.db = db;
  }

  public start() {
    // Guard against a double start() (without an intervening stop()) leaking the previous
    // reaction and Firestore subscription.
    this.reactionDisposer?.();
    this.unsubscribe?.();
    // (Re)subscribe whenever the class or unit becomes available or changes. Read `unit`/`user`
    // through `this.db.stores` (which is makeAutoObservable) rather than capturing the model
    // instances: Stores.setUnit() replaces the UnitModel wholesale, so a reaction reading `unit.code`
    // off a captured instance would never re-fire on a unit change.
    this.reactionDisposer = reaction(
      () => ({ classHash: this.db.stores.user.classHash, unit: this.db.stores.unit.code }),
      ({ classHash, unit: unitCode }) => this.subscribe(classHash, unitCode),
      { fireImmediately: true }
    );
  }

  public stop() {
    this.reactionDisposer?.();
    this.reactionDisposer = undefined;
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.db.stores.commentTags.replaceAll([]);
  }

  private subscribe(classHash: string, unitCode: string) {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    const { commentTags } = this.db.stores;
    commentTags.replaceAll([]);
    if (!classHash || !unitCode) return;
    const ref = this.db.firestore.collection(customCommentTagsPath(classHash, unitCode));
    this.unsubscribe = ref.onSnapshot(snapshot => {
      const entries: Array<[string, string]> = [];
      snapshot.forEach(doc => {
        const label = doc.data()?.label;
        if (typeof label === "string" && label) entries.push([doc.id, label]);
      });
      commentTags.replaceAll(entries);
    });
  }
}
