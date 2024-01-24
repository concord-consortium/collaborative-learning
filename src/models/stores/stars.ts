import { IObservableArray, makeAutoObservable, observable, ObservableMap, toJS } from "mobx";
import { DB } from "../../lib/db";
import { DEBUG_BOOKMARKS } from "../../lib/debug";

export class Star{
  readonly uid: string;
  key?: string;
  starred = true;

  constructor(uid: string) {
    makeAutoObservable(this);
    this.uid = uid;
  }

  toggleStarred() {
    this.starred = !this.starred;
  }

  toJSON() {
    return {
      uid: this.uid,
      key: this.key,
      starred: this.starred
    };
  }
}

export class Stars {
  // Map of document Key to an array of stars
  starMap = new ObservableMap<string, IObservableArray<Star>>();
  db: DB;

  constructor({db}:{db: DB}) {
    makeAutoObservable(this);
    this.db = db;
  }

  isDocumentStarred(docKey: string): boolean {
    return !!this.starMap.get(docKey)?.find(star => star.starred);
  }

  isDocumentStarredByUser(docKey: string, uid: string): boolean {
    return !!this.getDocumentUserStar(docKey, uid)?.starred;
  }

  getOrCreateDocumentStars(docKey: string): IObservableArray<Star> {
    const docStars = this.starMap.get(docKey);
    if (docStars) return docStars;

    const newDocStars = observable.array<Star>();
    this.starMap.set(docKey, newDocStars);
    return newDocStars;
  }

  getDocumentUserStar(docKey: string, uid: string) {
    const docStars = this.starMap.get(docKey);
    return docStars?.find((star) => star.uid === uid);
  }

  getDocumentStar(docKey: string, starKey: string) {
    const docStars = this.starMap.get(docKey);
    return docStars?.find((star) => star.key === starKey);
  }

  getOrCreateDocumentUserStar(docKey: string, uid: string) {
    const userStar = this.getDocumentUserStar(docKey, uid);
    if (userStar) return userStar;

    const newStar = new Star(uid);
    const docStars = this.getOrCreateDocumentStars(docKey);
    docStars.push(newStar);
    return newStar;
  }

  updateDocumentStar(docKey: string, star: Star) {
    if (!star.key) {
      console.warn("bookmarks: Cannot update star without a star.key", {docKey, uid: star.uid});
      return;
    }
    const existingStar = this.getDocumentStar(docKey, star.key);
    if (existingStar) {
      if (existingStar.uid !== star.uid) {
        console.warn("bookmarks: Trying to change the user of an existing star",
          {docKey, existingStar: existingStar.toJSON(), newStar: star.toJSON()});
        return;
      }
      existingStar.starred = star.starred;
    } else {
      const docStars = this.getOrCreateDocumentStars(docKey);
      docStars.push(star);
    }
  }

  /**
   * If the document has a star for this user, toggle its starred state.
   * If the document doesn't have a star for this user, create one that
   * that is starred.
   *
   * @param docKey
   * @param userId
   * @returns
   */
  toggleUserStar(docKey: string, userId: string) {
    const userStar = this.getDocumentUserStar(docKey, userId);
    if (DEBUG_BOOKMARKS) {
      const allDocStars = (this.starMap.get(docKey) ?? []).map(star => star.toJSON());
      console.log("bookmarks: toggling bookmark", {docKey, userId, starKey: userStar?.key, allDocStars});
    }
    if (userStar) {
      if (!userStar.key) {
        console.warn("bookmarks: star being toggled doesn't have a key", {docKey, star: userStar.toJSON()});
        return;
      }
      this.db.setUserStarState(docKey, userStar.key, !userStar.starred);
      return;
    }

    this.db.createUserStar(docKey, true);
  }

  toJSON() {
    return toJS(this.starMap);
  }

}
