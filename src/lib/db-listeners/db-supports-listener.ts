import { DB } from "../db";
import { SupportItemType,
         SupportAudienceType,
         TeacherSupportModel,
         TeacherSupportModelType } from "../../models/stores/supports";
import { DBSupport } from "../db-types";
import { SectionType } from "../../models/curriculum/section";

export class DBSupportsListener {
  private db: DB;
  private supportsRef: firebase.database.Reference | null = null;

  constructor(db: DB) {
    this.db = db;
  }

  public start() {
    this.supportsRef = this.db.firebase.ref(
      this.db.firebase.getSupportsPath(this.db.stores.user)
    );
    this.supportsRef.on("child_changed", this.handleSupportsUpdate);
    this.supportsRef.on("child_added", this.handleSupportsUpdate);
  }

  public stop() {
    if (this.supportsRef) {
      this.supportsRef.off("child_changed", this.handleSupportsUpdate);
      this.supportsRef.off("child_added", this.handleSupportsUpdate);
    }
  }

  private handleSupportsUpdate = (snapshot: firebase.database.DataSnapshot) => {
    const {supports} = this.db.stores;
    const dbSupports = snapshot.val();
    if (dbSupports) {
      const teacherSupports: TeacherSupportModelType[] = [];

      Object.keys(dbSupports).forEach(sectionTarget => {
        const newSupports = dbSupports[sectionTarget];
        Object.keys(newSupports).forEach((key) => {
          const dbSupport: DBSupport = newSupports[key];
          teacherSupports.push(TeacherSupportModel.create({
            key: dbSupport.self.key,
            text: dbSupport.content,
            type: sectionTarget === "all" ? SupportItemType.problem : SupportItemType.section,
            sectionId: sectionTarget === "all" ? undefined : sectionTarget as SectionType,
            audience: SupportAudienceType.class,
            authoredTime: dbSupport.timestamp,
            deleted: dbSupport.deleted
          }));
        });
      });

      supports.setAuthoredSupports(teacherSupports);
    }
  }
}
