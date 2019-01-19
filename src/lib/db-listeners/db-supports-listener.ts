import { DB } from "../db";
import { SupportItemType, TeacherSupportModel, TeacherSupportModelType, ClassAudienceModel, AudienceEnum,
  AudienceModelType, GroupAudienceModel, UserAudienceModel} from "../../models/stores/supports";
import { DBSupport } from "../db-types";
import { SectionType } from "../../models/curriculum/section";

export class DBSupportsListener {
  private db: DB;
  private supportsRef: firebase.database.Reference | null = null;

  constructor(db: DB) {
    this.db = db;
  }

  // TODO: Create different listeners for support audiences
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
    // The top-level key will be the audience for with an updated support
    const audienceType: AudienceEnum = snapshot.ref.key as AudienceEnum;
    if (dbSupports) {
      const teacherSupports: TeacherSupportModelType[] = [];

      if (audienceType === AudienceEnum.class) {
        Object.keys(dbSupports).forEach(sectionTarget => {
          const newSupports = dbSupports[sectionTarget];
          Object.keys(newSupports).forEach((key) => {
            const dbSupport: DBSupport = newSupports[key];
            const audience = ClassAudienceModel.create();
            teacherSupports.push(this.createSupportModel(sectionTarget, dbSupport, audience));
          });
        });
      } else {
        // Logic is the same as above, but group + user supports are first keyed by ID
        Object.keys(dbSupports).forEach(audienceId => {
          Object.keys(dbSupports[audienceId]).forEach(sectionTarget => {
            const newSupports = dbSupports[audienceId][sectionTarget];
            Object.keys(newSupports).forEach((key) => {
              const dbSupport: DBSupport = newSupports[key];
              const audience = audienceType === AudienceEnum.group
                ? GroupAudienceModel.create({identifier: audienceId})
                : UserAudienceModel.create({identifier: audienceId});
              teacherSupports.push(this.createSupportModel(sectionTarget, dbSupport, audience));
            });
          });
        });
      }

      supports.setAuthoredSupports(teacherSupports, audienceType);
    }
  }

  private createSupportModel(sectionTarget: string, dbSupport: DBSupport, audience: AudienceModelType) {
    return TeacherSupportModel.create({
      key: dbSupport.self.key,
      text: dbSupport.content,
      type: sectionTarget === "all" ? SupportItemType.problem : SupportItemType.section,
      sectionId: sectionTarget === "all" ? undefined : sectionTarget as SectionType,
      audience,
      authoredTime: dbSupport.timestamp,
      deleted: dbSupport.deleted
    });
  }
}
