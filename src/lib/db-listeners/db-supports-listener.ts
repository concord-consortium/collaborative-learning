import { DB } from "../db";
import { SupportTarget, TeacherSupportModel, TeacherSupportModelType, ClassAudienceModel, AudienceEnum,
        AudienceModelType, GroupAudienceModel, UserAudienceModel, addSupportDocumentsToStore, SupportType
      } from "../../models/stores/supports";
import { DBSupport } from "../db-types";
import { SectionType } from "../../models/curriculum/section";
import { ESupportType, SupportModel } from "../../models/curriculum/support";
import { BaseListener } from "./base-listener";

export class DBSupportsListener extends BaseListener {
  private db: DB;
  private supportsRef: firebase.database.Reference | null = null;
  private lastSupportViewTimestampRef: firebase.database.Reference | null = null;
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

    this.lastSupportViewTimestampRef = this.db.firebase.getLastSupportViewTimestampRef();
    this.debugLogHandler("#start", "adding", "on value", this.lastSupportViewTimestampRef);
    this.lastSupportViewTimestampRef.on("value", this.handleLastSupportViewTimestampRef);
  }

  public stop() {
    if (this.supportsRef) {
      this.debugLogHandlers("#stop", "removing", ["child_changed", "child_added"], this.supportsRef);
      this.supportsRef.off("child_changed", this.onChildChanged);
      this.supportsRef.off("child_added", this.onChildAdded);
    }
    if (this.lastSupportViewTimestampRef) {
      this.debugLogHandler("#stop", "removing", "on value", this.lastSupportViewTimestampRef);
      this.lastSupportViewTimestampRef.off("value", this.handleLastSupportViewTimestampRef);
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
            const uid = dbSupport.uid;
            const audience = ClassAudienceModel.create();
            const supportModel = this.createSupportModel(uid, sectionTarget, dbSupport, audience);
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
              const uid = dbSupport.uid;
              const audience = audienceType === AudienceEnum.group
                ? GroupAudienceModel.create({identifier: audienceId})
                : UserAudienceModel.create({identifier: audienceId});
              const supportModel = this.createSupportModel(uid, sectionTarget, dbSupport, audience);
              supportModel && teacherSupports.push(supportModel);
            });
          });
        });
      }

      supports.setAuthoredSupports(teacherSupports, audienceType);

      const { unit, investigation, problem, documents, user } = this.db.stores;
      addSupportDocumentsToStore({
        unit, investigation, problem, documents, supports: teacherSupports, db: this.db,
        onDocumentCreated: (support, document) => {
          // teachers sync their support document properties to Firebase to track isDeleted
          if (eventType === "child_added") {
            const teacherSupport = support as TeacherSupportModelType;
            if (teacherSupport.uid === user.id) {
              const {audience, sectionTarget, key} = teacherSupport;
              const path = this.db.firebase.getSupportsPath(user, audience, sectionTarget, key);
              this.db.listeners.syncDocumentProperties(document, path);
            }
          }
        }
      });
    }
  }

  private createSupportModel(uid: string,
                             sectionTarget: string | undefined,
                             dbSupport: DBSupport,
                             audience: AudienceModelType) {
    if (!dbSupport || !dbSupport.content) return;
    const supportContentType: ESupportType = (dbSupport.type as ESupportType) || ESupportType.text;
    const supportModel = SupportModel.create({ type: supportContentType, content: dbSupport.content });
    if (!supportModel) return;
    return TeacherSupportModel.create({
      uid,
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

  private handleLastSupportViewTimestampRef = (snapshot: firebase.database.DataSnapshot) => {
    const val = snapshot.val() || undefined;
    this.debugLogSnapshot("#handleLastSupportViewTimestampRef", snapshot);
    this.db.stores.user.setLastSupportViewTimestamp(val);
  }
}
