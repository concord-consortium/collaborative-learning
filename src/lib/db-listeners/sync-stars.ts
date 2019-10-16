import { DB } from "../db";
import { DocumentModelType } from "../../models/document/document";
import { onPatch } from "mobx-state-tree";

export const syncStars = (doc: DocumentModelType, db: DB) => {
  onPatch(doc.stars, patch => {
    const [, index, replaceKey] = patch.path.split("/");
    if (patch.op === "add") {
      const star = patch.value;
      const { starred, key } = star;
      if (key === "") { // key will be assigned from Firebase node id
        db.createUserStar(doc, starred);
      }
    } else if (patch.op === "replace" && replaceKey === "starred") {
      const starIndex = parseInt(index, 10);
      const star = doc.getUserStarAtIndex(starIndex);
      if (star) {
        db.setUserStarState(doc.key, star.key, star.starred);
      }
    }
  });
};

