import { DB } from "../db";
import { UserStarModel } from "../../models/tools/user-star";
import { forEach } from "lodash";

export class DBStarsListener {
  private db: DB;
  private starsRef: firebase.database.Reference | null = null;

  constructor(db: DB) {
    this.db = db;
  }

  public start() {
    this.starsRef = this.db.firebase.ref(
      this.db.firebase.getUserDocumentStarsPath(this.db.stores.user)
    );
    this.starsRef.on("child_changed", this.handleUpdateStars);
    this.starsRef.on("child_added", this.handleUpdateStars);
  }

  public stop() {
    if (this.starsRef) {
      this.starsRef.on("child_changed", this.handleUpdateStars);
      this.starsRef.off("child_added", this.handleUpdateStars);
    }
  }

  private handleUpdateStars = (snapshot: firebase.database.DataSnapshot) => {
    const { documents } = this.db.stores;
    const dbDocStars = snapshot.val();
    if (dbDocStars) {
      const docModel = snapshot.ref.key && documents.getDocument(snapshot.ref.key);
      if (docModel) {
        forEach(dbDocStars, (userStar, starKey) => {
          const { uid, starred } = userStar;
          const starModel = UserStarModel.create({
            key: starKey,
            uid,
            starred
          });
          docModel.updateUserStar(starModel);
        });
      }
    }
  }
}
