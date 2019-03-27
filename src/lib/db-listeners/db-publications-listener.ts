import { DB } from "../db";
import { DBPublication } from "../db-types";
import { forEach } from "lodash";
import { onPatch } from "mobx-state-tree";

export class DBPublicationsListener {
  private db: DB;
  private publicationsRef: firebase.database.Reference | null = null;

  constructor(db: DB) {
    this.db = db;
  }

  public start() {
    return new Promise<void>((resolve, reject) => {
      const publicationsRef = this.publicationsRef = this.db.firebase.ref(
        this.db.firebase.getPublicationsPath(this.db.stores.user)
      );
      // use once() so we are ensured that publications are set before we resolve
      publicationsRef.once("value", (snapshot) => {
        this.handleLoadPublications(snapshot);
        publicationsRef.on("child_added", this.handlePublicationChildAdded);
      })
      .then(snapshot => {
        resolve();
      })
      .catch(reject);
    });
  }

  public stop() {
    if (this.publicationsRef) {
      this.publicationsRef.off("child_added", this.handlePublicationChildAdded);
    }
  }

  private handleLoadPublications = (snapshot: firebase.database.DataSnapshot) => {
    const publications = snapshot.val();
    if (publications) {
      forEach(publications, (publication) => {
        this.handlePublication(publication);
      });
    }
  }

  private handlePublicationChildAdded = (snapshot: firebase.database.DataSnapshot) => {
    const publication: DBPublication|null = snapshot.val();
    this.handlePublication(publication);
  }

  private handlePublication = (publication: DBPublication|null) => {
    const {documents} = this.db.stores;
    if (publication) {
      this.db.createDocumentFromPublication(publication)
        .then(doc => {
          documents.add(doc);
          onPatch(doc.stars, patch => {
            const path = patch.path.split("/");
            if (patch.op === "add") {
              const star = patch.value;
              const { starred, key } = star;
              if (key === "") { // key will be assigned from Firebase node id
                this.db.createUserStar(doc, starred);
              }
            } else if (patch.op === "replace" && path[path.length - 1] === "starred") {
              const starIndex = parseInt(path[path.length - 2], 10);
              const star = doc.getUserStarAtIndex(starIndex);
              if (star) {
                this.db.setUserStarState(doc.key, star.key, star.starred);
              }
            }
          });
          onPatch(doc.comments, patch => {
            const path = patch.path.split("/");
            const tileId = path[1];
            if (patch.op === "add") {
              const comment = patch.value;
              const { text, selectionInfo } = comment;
              if (text) {
                this.db.createTileComment(doc, tileId, text, selectionInfo);
              }
            } else if (patch.op === "replace" && path[path.length - 1] === "deleted") {
              const tileComments = doc.comments.get(tileId);
              if (tileComments) {
                const commentIndex = parseInt(path[path.length - 2], 10);
                const comment = tileComments.getCommentAtIndex(commentIndex);
                if (comment) {
                  this.db.deleteComment(doc.key, tileId, comment.key);
                }
              }
            }
          });
        });
    }
  }
}
