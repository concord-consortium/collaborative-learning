import { DB } from "../db";
import { SupportTarget, TeacherSupportModel, TeacherSupportModelType, ClassAudienceModel, AudienceEnum,
  AudienceModelType, GroupAudienceModel, UserAudienceModel} from "../../models/stores/supports";
import { DBSupport } from "../db-types";
import { SectionType } from "../../models/curriculum/section";
import { ESupportType, SupportModel } from "../../models/curriculum/support";
import { BaseListener } from "./base-listener";

export class DBSupportsListener extends BaseListener {
  private db: DB;
  private supportsRef: firebase.database.Reference | null = null;
  private onChildAdded: (snapshot: firebase.database.DataSnapshot) => void;
  private onChildChanged: (snapshot: firebase.database.DataSnapshot) => void;

  constructor(db: DB) {
    super("DBSupportsListener");
    this.db = db;
  }

  // TODO: Create different listeners for support audiences
  public start() {
    this.supportsRef = this.db.firebase.ref(
      this.db.firebase.getSupportsPath(this.db.stores.user)
    );
    this.debugLogHandlers("#start", "adding", ["child_changed", "child_added"], this.supportsRef);
    this.supportsRef.on("child_changed", this.onChildChanged = this.handleSupportsUpdate("child_changed"));
    this.supportsRef.on("child_added", this.onChildAdded = this.handleSupportsUpdate("child_added"));
  }

  public stop() {
    if (this.supportsRef) {
      this.debugLogHandlers("#stop", "removing", ["child_changed", "child_added"], this.supportsRef);
      this.supportsRef.off("child_changed", this.onChildChanged);
      this.supportsRef.off("child_added", this.onChildAdded);
    }
  }

  private handleSupportsUpdate = (eventType: string) => (snapshot: firebase.database.DataSnapshot) => {
    const {supports} = this.db.stores;
    const dbSupports = snapshot.val();
    this.debugLogSnapshot("#handleSupportsUpdate", snapshot);
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
    const supportContentType: ESupportType = (dbSupport.type as ESupportType) || ESupportType.text;
    const supportModel = SupportModel.create({ type: supportContentType, content: dbSupport.content });
    return TeacherSupportModel.create({
      key: dbSupport.self.key,
      support: supportModel,
      type: sectionTarget === "all" ? SupportTarget.problem : SupportTarget.section,
      sectionId: sectionTarget === "all" ? undefined : sectionTarget as SectionType,
      audience,
      authoredTime: dbSupport.timestamp,
      deleted: dbSupport.deleted
    });
  }
}
