import firebase from "firebase/app";
import { DB } from "../db";
import { TileCommentModel, TileCommentsModel } from "../../models/tools/tile-comments";
import { forEach } from "lodash";
import { BaseListener } from "./base-listener";

export class DBCommentsListener extends BaseListener {
  private db: DB;
  private commentsRef: firebase.database.Reference | null = null;
  private onChildAdded: (snapshot: firebase.database.DataSnapshot) => void;
  private onChildChanged: (snapshot: firebase.database.DataSnapshot) => void;

  constructor(db: DB) {
    super("DBCommentsListener");
    this.db = db;
  }

  public start() {
    this.commentsRef = this.db.firebase.ref(
      this.db.firebase.getUserDocumentCommentsPath(this.db.stores.user)
    );
    this.debugLogHandlers("#start", "adding", ["child_changed", "child_added"], this.commentsRef);
    this.commentsRef.on("child_changed", this.onChildChanged = this.handleUpdateComments("child_changed"));
    this.commentsRef.on("child_added", this.onChildAdded = this.handleUpdateComments("child_added"));
  }

  public stop() {
    if (this.commentsRef) {
      this.debugLogHandlers("#stop", "removing", ["child_changed", "child_added"], this.commentsRef);
      this.commentsRef.off("child_changed", this.onChildChanged);
      this.commentsRef.off("child_added", this.onChildAdded);
    }
  }

  private handleUpdateComments = (eventType: string) => (snapshot: firebase.database.DataSnapshot) => {
    const { documents } = this.db.stores;
    const dbDocComments = snapshot.val();
    this.debugLogSnapshot(`#handleUpdateComments (${eventType})`, snapshot);
    if (dbDocComments) {
      const docModel = snapshot.ref.key && documents.getDocument(snapshot.ref.key);
      if (docModel) {
        forEach(dbDocComments, (tileComments, tileId) => {
          const tileCommentsModel = TileCommentsModel.create({tileId});
          forEach(tileComments, (tileComment, commentKey) => {
            if (!tileComment.deleted) {
              const { uid, content, selectionInfo } = tileComment;
              const commentModel = TileCommentModel.create({
                uid,
                key: commentKey,
                text: content,
                selectionInfo
              });
              tileCommentsModel.addComment(commentModel);
            }
          });
          docModel.setTileComments(tileId, tileCommentsModel);
        });
      }
    }
  };
}
