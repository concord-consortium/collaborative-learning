import { DB } from "../db";
import { SupportTarget, TeacherSupportModel, TeacherSupportModelType, ClassAudienceModel, AudienceEnum,
        AudienceModelType, GroupAudienceModel, UserAudienceModel, addSupportDocumentsToStore
      } from "../../models/stores/supports";
import { DBSupport } from "../db-types";
import { SectionType } from "../../models/curriculum/section";
import { ESupportType, SupportModel } from "../../models/curriculum/support";

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
            const supportModel = this.createSupportModel(sectionTarget, dbSupport, audience);
            supportModel && teacherSupports.push(supportModel);
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
              const supportModel = this.createSupportModel(sectionTarget, dbSupport, audience);
              supportModel && teacherSupports.push(supportModel);
            });
          });
        });
      }

      supports.setAuthoredSupports(teacherSupports, audienceType);

      const { unit, investigation, problem, documents } = this.db.stores;
      addSupportDocumentsToStore({ unit, investigation, problem, documents, supports: teacherSupports, db: this.db });
    }
  }

  private createSupportModel(sectionTarget: string | undefined, dbSupport: DBSupport, audience: AudienceModelType) {
    if (!dbSupport || !dbSupport.content) return;
    const supportContentType: ESupportType = (dbSupport.type as ESupportType) || ESupportType.text;
    const supportModel = SupportModel.create({ type: supportContentType, content: dbSupport.content });
    if (!supportModel) return;
    return TeacherSupportModel.create({
      key: dbSupport.self.key,
      support: supportModel,
      type: !sectionTarget || sectionTarget === "all" ? SupportTarget.problem : SupportTarget.section,
      sectionId: !sectionTarget || sectionTarget === "all" ? undefined : sectionTarget as SectionType,
      audience,
      authoredTime: dbSupport.timestamp,
      originDoc: dbSupport.type === ESupportType.publication ? dbSupport.originDoc : undefined,
      caption: dbSupport.properties && dbSupport.properties.caption,
      deleted: dbSupport.deleted
    });
  }
}
