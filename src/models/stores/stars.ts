import { IObservableArray, makeAutoObservable, observable, ObservableMap } from "mobx";

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
}

export class Stars {
  // Map of document Key to an array of stars
  starMap = new ObservableMap<string, IObservableArray<Star>>();

  constructor() {
    makeAutoObservable(this);
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

  getOrCreateDocumentUserStar(docKey: string, uid: string) {
    const userStar = this.getDocumentUserStar(docKey, uid);
    if (userStar) return userStar;

    const newStar = new Star(uid);
    const docStars = this.getOrCreateDocumentStars(docKey);
    docStars.push(newStar);
    return newStar;
  }

  updateDocumentStar(docKey: string, star: { key: string; uid: string; starred: boolean; }) {
    const ourStar = this.getOrCreateDocumentUserStar(docKey, star.uid);
    ourStar.key = star.key;
    ourStar.starred = star.starred;
  }
}
