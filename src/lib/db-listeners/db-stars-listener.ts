import firebase from "firebase/app";
import { forEach } from "lodash";
import { DB } from "../db";
import { Bookmark } from "../../models/stores/bookmarks";
import { BaseListener } from "./base-listener";
import { DEBUG_BOOKMARKS } from "../debug";

export class DBStarsListener extends BaseListener {
  private db: DB;
  private starsRef: firebase.database.Reference | null = null;
  private onChildAdded: (snapshot: firebase.database.DataSnapshot) => void;
  private onChildChanged: (snapshot: firebase.database.DataSnapshot) => void;

  constructor(db: DB) {
    super("DBStarsListener");
    this.db = db;
  }

  public start() {
    this.starsRef = this.db.firebase.ref(
      this.db.firebase.getUserDocumentStarsPath(this.db.stores.user)
    );
    this.debugLogHandlers("#start", "adding", ["child_changed", "child_added"], this.starsRef);
    this.starsRef.on("child_changed", this.onChildChanged = this.handleUpdateStars("child_changed"));
    this.starsRef.on("child_added", this.onChildAdded = this.handleUpdateStars("child_added"));
  }

  public stop() {
    if (this.starsRef) {
      this.debugLogHandlers("#stop", "removing", ["child_changed", "child_added"], this.starsRef);
      this.starsRef.off("child_changed", this.onChildChanged);
      this.starsRef.off("child_added", this.onChildAdded);
    }
  }

  // See bookmarks.md for details about this
  private handleUpdateStars = (eventType: string) => (snapshot: firebase.database.DataSnapshot) => {
    const { bookmarks } = this.db.stores;
    const dbDocStars = snapshot.val();
    this.debugLogSnapshot(`#handleUpdateStars (${eventType})`, snapshot);
    const docKey = snapshot.ref.key;
    if (!dbDocStars || !docKey) return;

    // In the past there have been multiple stars for the same user on the same document.
    // The code below cleans this up when it finds them.
    const consolidatedStars: Record<string, Bookmark> = {};
    const duplicateStars: Bookmark[] = [];
    forEach(dbDocStars, (userStar, starKey) => {
      const { uid, starred } = userStar;
      const star = new Bookmark(uid, starKey, starred);
      const existingStar = consolidatedStars[uid];
      if (existingStar) {
        // There was already a star for this document and user.
        duplicateStars.push(star);
        if (starred) {
          // If this duplicate star is starred then make sure the main star is starred
          existingStar.starred = true;
        }
      } else {
        consolidatedStars[uid] = star;
      }
    });

    Object.values(consolidatedStars).forEach(star => {
      bookmarks.updateDocumentBookmark(docKey, star);
    });

    duplicateStars.forEach(duplicateStar => {
      const starRef = this.db.firebase.ref(
        this.db.firebase.getUserDocumentStarsPath(this.db.stores.user, docKey, duplicateStar.key)
      );
      if (DEBUG_BOOKMARKS) {
        // eslint-disable-next-line no-console
        console.log("Deleting duplicate star", {path: starRef.toString(), duplicateStar: duplicateStar.toJSON() });
      }
      starRef.remove();
    });
  };
}
