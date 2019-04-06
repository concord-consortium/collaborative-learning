import { DB } from "../db";
import { TileCommentModel, TileCommentsModelType, TileCommentsModel } from "../../models/tools/tile-comments";
import { forEach } from "lodash";

export class DBCommentsListener {
  private db: DB;
  private commentsRef: firebase.database.Reference | null = null;

  constructor(db: DB) {
    this.db = db;
  }

  public start() {
    this.commentsRef = this.db.firebase.ref(
      this.db.firebase.getUserDocumentCommentsPath(this.db.stores.user)
    );
    this.commentsRef.on("child_changed", this.handleUpdateComments);
    this.commentsRef.on("child_added", this.handleUpdateComments);
  }

  public stop() {
    if (this.commentsRef) {
      this.commentsRef.on("child_changed", this.handleUpdateComments);
      this.commentsRef.off("child_added", this.handleUpdateComments);
    }
  }

  private handleUpdateComments = (snapshot: firebase.database.DataSnapshot) => {
    const { documents } = this.db.stores;
    const dbDocComments = snapshot.val();
    if (dbDocComments) {
      const docModel = snapshot.ref.key && documents.getDocument(snapshot.ref.key);
      if (docModel) {
        forEach(dbDocComments, (tileComments, tileId) => {
          const tileCommentsModel = TileCommentsModel.create({tileId});
          forEach(tileComments, (tileComment, commentKey) => {
            const { uid, content, selectionInfo } = tileComment;
            const commentModel = TileCommentModel.create({
              uid,
              key: commentKey,
              text: content,
              selectionInfo
            });
            tileCommentsModel.addComment(commentModel);
          });
          docModel.setTileComments(tileId, tileCommentsModel);
        });
      }
    }
  }
}
