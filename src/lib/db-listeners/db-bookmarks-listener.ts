import firebase from "firebase/app";
import { forEach } from "lodash";
import { DB } from "../db";
import { Bookmark } from "../../models/stores/bookmarks";
import { BaseListener } from "./base-listener";
import { DEBUG_BOOKMARKS } from "../debug";

export class DBBookmarksListener extends BaseListener {
  private db: DB;
  private bookmarksRef: firebase.database.Reference | null = null;
  private onChildAdded: (snapshot: firebase.database.DataSnapshot) => void;
  private onChildChanged: (snapshot: firebase.database.DataSnapshot) => void;

  constructor(db: DB) {
    super("DBBookmarksListener");
    this.db = db;
  }

  public start() {
    this.bookmarksRef = this.db.firebase.ref(
      this.db.firebase.getUserDocumentStarsPath(this.db.stores.user)
    );
    this.debugLogHandlers("#start", "adding", ["child_changed", "child_added"], this.bookmarksRef);
    this.bookmarksRef.on("child_changed", this.onChildChanged = this.handleUpdateBookmarks("child_changed"));
    this.bookmarksRef.on("child_added", this.onChildAdded = this.handleUpdateBookmarks("child_added"));
  }

  public stop() {
    if (this.bookmarksRef) {
      this.debugLogHandlers("#stop", "removing", ["child_changed", "child_added"], this.bookmarksRef);
      this.bookmarksRef.off("child_changed", this.onChildChanged);
      this.bookmarksRef.off("child_added", this.onChildAdded);
    }
  }

  // See bookmarks.md for details about this
  private handleUpdateBookmarks = (eventType: string) => (snapshot: firebase.database.DataSnapshot) => {
    const { bookmarks } = this.db.stores;
    const dbDocBookmarks = snapshot.val();
    this.debugLogSnapshot(`#handleUpdateBookmarks (${eventType})`, snapshot);
    const docKey = snapshot.ref.key;
    if (!dbDocBookmarks || !docKey) return;

    // In the past there have been multiple bookmarks for the same user on the same document.
    // The code below cleans this up when it finds them.
    const consolidatedBookmarks: Record<string, Bookmark> = {};
    const duplicateBookmarks: Bookmark[] = [];
    forEach(dbDocBookmarks, (userBookmark, bookmarkKey) => {
      const { uid, starred } = userBookmark;
      const bookmark = new Bookmark(uid, bookmarkKey, starred);
      const existingBookmark = consolidatedBookmarks[uid];
      if (existingBookmark) {
        // There was already a bookmark for this document and user.
        duplicateBookmarks.push(bookmark);
        if (starred) {
          // If this duplicate bookmark is starred then make sure the main bookmark is starred
          existingBookmark.starred = true;
        }
      } else {
        consolidatedBookmarks[uid] = bookmark;
      }
    });

    Object.values(consolidatedBookmarks).forEach(bookmark => {
      bookmarks.updateDocumentBookmark(docKey, bookmark);
    });

    duplicateBookmarks.forEach(duplicateBookmark => {
      const bookmarkRef = this.db.firebase.ref(
        this.db.firebase.getUserDocumentStarsPath(this.db.stores.user, docKey, duplicateBookmark.key)
      );
      if (DEBUG_BOOKMARKS) {
        // eslint-disable-next-line no-console
        console.log("bookmarks: Deleting duplicate bookmark",
          {path: bookmarkRef.toString(), duplicateBookmark: duplicateBookmark.toJSON() });
      }
      bookmarkRef.remove();
    });
  };
}
