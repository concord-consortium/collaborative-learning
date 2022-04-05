import firebase from "firebase/app";
import { DB } from "../db";
import { DBPublication } from "../db-types";
import { forEach } from "lodash";
import { onPatch } from "mobx-state-tree";
import { BaseListener } from "./base-listener";
import { syncStars } from "./sync-stars";

export class DBPublicationsListener extends BaseListener {
  private db: DB;
  private publicationsRef: firebase.database.Reference | null = null;

  constructor(db: DB) {
    super("DBPublicationsListener");
    this.db = db;
  }

  public start() {
    return new Promise<void>((resolve, reject) => {
      const publicationsRef = this.publicationsRef = this.db.firebase.ref(
        this.db.firebase.getProblemPublicationsPath(this.db.stores.user)
      );
      // use once() so we are ensured that publications are set before we resolve
      this.debugLogHandler("#start", "adding", "once", publicationsRef);
      publicationsRef.once("value", (snapshot) => {
        this.handleLoadPublications(snapshot);
        this.debugLogHandler("#start", "adding", "child_added", publicationsRef);
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
      this.debugLogHandler("#stop", "removing", "child_added", this.publicationsRef);
      this.publicationsRef.off("child_added", this.handlePublicationChildAdded);
    }
  }

  private handleLoadPublications = (snapshot: firebase.database.DataSnapshot) => {
    const publications = snapshot.val();
    this.debugLogSnapshot("#handleLoadPublications", snapshot);
    if (publications) {
      forEach(publications, (publication) => {
        this.handlePublication(publication);
      });
    }
  };

  private handlePublicationChildAdded = (snapshot: firebase.database.DataSnapshot) => {
    const publication: DBPublication|null = snapshot.val();
    this.debugLogSnapshot("#handlePublicationChildAdded", snapshot);
    this.handlePublication(publication);
  };

  private handlePublication = (publication: DBPublication|null) => {
    if (publication) {
      this.db.createDocumentFromPublication(publication)
        .then(doc => {
          syncStars(doc, this.db);
          onPatch(doc.comments, patch => {
            const [, tileId, , index, replaceKey] = patch.path.split("/");
            if (patch.op === "add") {
              const comment = patch.value;
              const { text, selectionInfo } = comment;
              if (text) {
                this.db.createLegacyTileComment(doc, tileId, text, selectionInfo);
              }
            } else if (patch.op === "replace" && replaceKey === "deleted") {
              const tileComments = doc.comments.get(tileId);
              if (tileComments) {
                const commentIndex = parseInt(index, 10);
                const comment = tileComments.getCommentAtIndex(commentIndex);
                if (comment) {
                  this.db.deleteLegacyTileComment(doc.key, tileId, comment.key);
                }
              }
            }
          });
        });
    }
  };
}
