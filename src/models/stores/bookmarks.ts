import { IObservableArray, makeAutoObservable, observable, ObservableMap } from "mobx";
import { DB } from "../../lib/db";
import { DEBUG_BOOKMARKS } from "../../lib/debug";
import { ClassModelType } from "./class";

export class Bookmark {
  readonly uid: string;
  key: string;
  starred: boolean;

  constructor(uid: string, key: string, starred: boolean) {
    makeAutoObservable(this);
    this.uid = uid;
    this.key = key;
    this.starred = starred;
  }

  toJSON() {
    return {
      uid: this.uid,
      key: this.key,
      starred: this.starred
    };
  }
}

export class Bookmarks {
  // Map of document Key to an array of bookmarks
  bookmarkMap = new ObservableMap<string, IObservableArray<Bookmark>>();
  db: DB;

  constructor({db}:{db: DB}) {
    makeAutoObservable(this);
    this.db = db;
  }

  isDocumentBookmarked(docKey: string): boolean {
    return !!this.bookmarkMap.get(docKey)?.find(bookmark => bookmark.starred);
  }

  isDocumentBookmarkedByUser(docKey: string, uid: string): boolean {
    return !!this.getDocumentUserBookmark(docKey, uid)?.starred;
  }

  getOrCreateDocumentBookmarks(docKey: string): IObservableArray<Bookmark> {
    const docBookmarks = this.bookmarkMap.get(docKey);
    if (docBookmarks) return docBookmarks;

    const newDocBookmarks = observable.array<Bookmark>();
    this.bookmarkMap.set(docKey, newDocBookmarks);
    return newDocBookmarks;
  }

  getDocumentUserBookmark(docKey: string, uid: string) {
    const docBookmarks = this.bookmarkMap.get(docKey);
    return docBookmarks?.find((bookmark) => bookmark.uid === uid);
  }

  getDocumentBookmark(docKey: string, bookmarkKey: string) {
    const docBookmarks = this.bookmarkMap.get(docKey);
    return docBookmarks?.find((bookmark) => bookmark.key === bookmarkKey);
  }

  updateDocumentBookmark(docKey: string, bookmark: Bookmark) {
    const existingBookmark = this.getDocumentBookmark(docKey, bookmark.key);
    if (existingBookmark) {
      if (existingBookmark.uid !== bookmark.uid) {
        console.warn("bookmarks: Trying to change the user of an existing bookmark",
          {docKey, existingBookmark: existingBookmark.toJSON(), newBookmark: bookmark.toJSON()});
        return;
      }
      existingBookmark.starred = bookmark.starred;
    } else {
      const docBookmarks = this.getOrCreateDocumentBookmarks(docKey);
      docBookmarks.push(bookmark);
    }
  }

  /**
   * If the document has a bookmark for this user, toggle its starred state.
   * If the document doesn't have a bookmark for this user, create one that
   * that is starred.
   *
   * @param docKey
   * @param userId
   * @returns
   */
  toggleUserBookmark(docKey: string, userId: string) {
    const userBookmark = this.getDocumentUserBookmark(docKey, userId);
    if (DEBUG_BOOKMARKS) {
      const allDocBookmarks = (this.bookmarkMap.get(docKey) ?? []).map(bookmark => bookmark.toJSON());
      // eslint-disable-next-line no-console
      console.log("bookmarks: toggling bookmark",
        {docKey, userId, bookmarkKey: userBookmark?.key, allDocBookmarks});
    }
    if (userBookmark) {
      this.db.setUserStarState(docKey, userBookmark.key, !userBookmark.starred);
      return;
    }

    this.db.createUserStar(docKey, true);
  }

  // This is used for debugging
  getBookmarkLabel(docKey: string, currentUserId: string, classStore: ClassModelType) {
    const docStars = this.bookmarkMap.get(docKey);
    if (!docStars) return "";
    const starOwners = { user: 0, teacher: 0, others: 0};
    docStars.forEach(star => {
      if (!star.starred) return;

      if (star.uid === currentUserId) {
        starOwners.user++;
      } else if (classStore.isTeacher(star.uid)) {
        starOwners.teacher++;
      } else {
        starOwners.others++;
      }
    });
    const abbreviations: Record<string, string> = { user: "U", teacher: "T", others: "O" };
    return Object.entries(starOwners).map(([key, value]) => {
      if (value === 0) return "  ";
      return `${abbreviations[key]}${value}`;
    }).join(" ");
  }
}
