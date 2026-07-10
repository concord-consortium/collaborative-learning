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
    const { user, unit } = this.db.stores;
    // (Re)subscribe whenever the class or unit becomes available or changes. A reaction (rather
    // than reading once) handles the unit loading asynchronously after listeners start.
    this.reactionDisposer = reaction(
      () => ({ classHash: user.classHash, unit: unit.code }),
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
