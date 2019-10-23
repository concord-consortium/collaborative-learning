import { DB } from "../db";
import { UserStarModel } from "../../models/tools/user-star";
import { forEach } from "lodash";
import { BaseListener } from "./base-listener";

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

  private handleUpdateStars = (eventType: string) => (snapshot: firebase.database.DataSnapshot) => {
    const { documents } = this.db.stores;
    const dbDocStars = snapshot.val();
    this.debugLogSnapshot(`#handleUpdateStars (${eventType})`, snapshot);
    if (dbDocStars) {
      const docModel = snapshot.ref.key && documents.getDocument(snapshot.ref.key);
      if (docModel) {
        forEach(dbDocStars, (userStar, starKey) => {
          const { uid, starred } = userStar;
          const starModel = UserStarModel.create({ key: starKey, uid, starred });
          docModel.setUserStar(starModel);
        });
      }
    }
  }
}
