import { types, Instance, getSnapshot } from "mobx-state-tree";
import { cloneDeep } from "lodash";
import { InvestigationModelType } from "../curriculum/investigation";
import { ProblemModelType } from "../curriculum/problem";
import { getSectionInitials, getSectionTitle, kAllSectionType, SectionType } from "../curriculum/section";
import { ESupportMode, ESupportType, SupportModel, SupportModelType } from "../curriculum/support";
import { UnitModelType } from "../curriculum/unit";
import { DB } from "../../lib/db";
import { IDocumentProperties } from "../../lib/db-types";
import { Logger, LogEventName } from "../../lib/logger";
import { DocumentModel, DocumentModelType } from "../document/document";
import {
  DocumentContentModel, DocumentContentSnapshotType, IAuthoredDocumentContent
} from "../document/document-content";
import { SupportPublication } from "../document/document-types";
import { DocumentsModelType } from "./documents";
import { safeJsonParse } from "../../utilities/js-utils";

export enum AudienceEnum {
  class = "class",
  group = "group",
  user = "user"
}

export const audienceInfo = {
  [AudienceEnum.class]: { display: "Class"},
  [AudienceEnum.group]: { display: "Group"},
  [AudienceEnum.user]: { display: "User"},
};

export enum SupportType {
  teacher = "teacher",
  curricular = "curricular"
}

export type SectionTarget = SectionType;

export enum SupportTarget {
  unit = "unit",
  investigation = "investigation",
  problem = "problem",
  section = "section",
}

export interface ISupportTarget {
  sectionId?: SectionTarget;
  groupId?: string;
  userId?: string;
}

export const ClassAudienceModel = types
  .model("ClassAudienceModel", {
    type: types.optional(types.literal(AudienceEnum.class), AudienceEnum.class),
    identifier: types.undefined
  });
export const GroupAudienceModel = types
  .model("GroupAudienceModel", {
    type: types.optional(types.literal(AudienceEnum.group), AudienceEnum.group),
    identifier: types.string
  });
export const UserAudienceModel = types
  .model("UserAudienceModel", {
    type: types.optional(types.literal(AudienceEnum.user), AudienceEnum.user),
    identifier: types.string
  });

export const AudienceModel = types.union(ClassAudienceModel, GroupAudienceModel, UserAudienceModel);
export type AudienceModelType = Instance<typeof AudienceModel>;

export const TeacherSupportModel = types
  .model("TeacherSupportModel", {
    uid: types.string,
    supportType: types.optional(types.literal(SupportType.teacher), SupportType.teacher),
    key: types.identifier,
    support: SupportModel,
    type: types.enumeration<SupportTarget>("SupportTarget", Object.values(SupportTarget)),
    visible: false,
    sectionId: types.maybe(types.string),
    audience: AudienceModel,
    authoredTime: types.number,
    originDoc: types.maybe(types.string),
    caption: types.maybe(types.string),
    deleted: false
  })
  .views(self => ({
    // excludes sticky notes
    get isTeacherSupport() {
      return self.support.mode !== ESupportMode.stickyNote;
    },
    get isStickyNote() {
      return self.support.mode === ESupportMode.stickyNote;
    },
    get sectionTarget() {
      return (self.type === SupportTarget.section) && self.sectionId
              ? self.sectionId
              : kAllSectionType;
    }
  }))
  .views(self => ({
    get sectionTargetDisplay(): string {
      return getSectionTitle(self.sectionTarget);
    },

    showForUserProblem(target: ISupportTarget) {
      const isUndeleted = !self.deleted;
      const isForSection = self.type === SupportTarget.problem
        || self.type === SupportTarget.section && self.sectionId === target.sectionId;
      const isForUser = self.audience.type === AudienceEnum.class
        || self.audience.type === AudienceEnum.group && self.audience.identifier === target.groupId
        || self.audience.type === AudienceEnum.user && self.audience.identifier === target.userId;
      return isUndeleted && isForSection && isForUser;
    }
  }))
  .actions(self => ({
    setVisible(visible: boolean) {
      self.visible = visible;
    },
    setDeleted(deleted: boolean) {
      self.deleted = deleted;
    }
  }));

export interface ICreateFromUnitParams {
  unit: UnitModelType;
  investigation?: InvestigationModelType;
  problem?: ProblemModelType;
  documents?: DocumentsModelType;
  db?: DB;
  supports?: CurricularSupportModelType[] | TeacherSupportModelType[];
  fromDB?: boolean;
  onDocumentCreated?: (support: UnionSupportModelType, document: DocumentModelType) => void;
}

export const CurricularSupportModel = types
  .model("CurricularSupportModel", {
    supportType: types.optional(types.literal(SupportType.curricular), SupportType.curricular),
    support: SupportModel,
    type: types.enumeration<SupportTarget>("SupportTarget", Object.values(SupportTarget)),
    visible: false,
    sectionId: types.maybe(types.string)
  })
  .actions((self) => {
    return {
      setVisible(visible: boolean) {
        self.visible = visible;
      }
    };
  });

export const SupportItemModel = types.union(TeacherSupportModel, CurricularSupportModel);

// utility function which finds authored teacher supports and sticky notes
function hasNewTeacherSupports(teacherSupports: TeacherSupportModelType[], afterTimestamp?: number) {
  if (afterTimestamp) {
    const latestAuthoredTime = teacherSupports.reduce((latest, support) => {
      return (support.authoredTime > latest) ? support.authoredTime : latest;
    }, 0);
    return latestAuthoredTime > afterTimestamp;
  } else {
    return teacherSupports.length > 0;
  }
}

export const SupportsModel = types
  .model("Supports", {
    curricularSupports: types.array(CurricularSupportModel),
    classSupports: types.array(TeacherSupportModel),
    groupSupports: types.array(TeacherSupportModel),
    userSupports: types.array(TeacherSupportModel)
  })
  .views((self) => ({
    // includes standard teacher supports and sticky notes
    get allTeacherSupports() {
      return self.classSupports
        .concat(self.groupSupports)
        .concat(self.userSupports)
        .filter((support) => !support.deleted);
    }
  }))
  .views((self) => ({
    // standard supports (as opposed to sticky notes)
    get teacherSupports() {
      return self.allTeacherSupports.filter((support) => support.isTeacherSupport);
    },
    get teacherStickyNotes() {
      return self.allTeacherSupports.filter((support) => support.isStickyNote);
    }
  }))
  .views((self) => ({
    getTeacherSupportsForUserProblem(target: ISupportTarget): SupportItemModelType[] {
      return self.teacherSupports.filter(support => {
        return support.showForUserProblem(target);
      });
    },
    getStickyNotesForUserProblem(target: ISupportTarget): SupportItemModelType[] {
      return self.teacherStickyNotes.filter(support => {
        return support.showForUserProblem(target);
      });
    }
  }))
  .views((self) => ({
    get allSupports() {
        return (self.curricularSupports as SupportItemModelType[])
        .concat(self.classSupports)
        .concat(self.groupSupports)
        .concat(self.userSupports);
    },

    getSupportsForUserProblem(target: ISupportTarget): SupportItemModelType[] {
        const { sectionId } = target;
        const supports: SupportItemModelType[] = self.curricularSupports.filter((support) => {
          return sectionId ? support.sectionId === sectionId : true;
        });
        return supports.concat(self.getTeacherSupportsForUserProblem(target));
    }
  }))
  .views((self) => ({
    hasNewTeacherSupports(afterTimestamp?: number) {
      return hasNewTeacherSupports(self.teacherSupports, afterTimestamp);
    },
    hasNewStickyNotes(afterTimestamp?: number) {
      return hasNewTeacherSupports(self.teacherStickyNotes, afterTimestamp);
    }
  }))
  .actions((self) => {
    return {
      createFromUnit(params: ICreateFromUnitParams) {
        const { unit, investigation, problem, documents } = params;
        const supports: CurricularSupportModelType[] = [];
        const createItem = (type: SupportTarget, sectionId?: string) => {
          return (support: SupportModelType) => {
            supports.push(CurricularSupportModel.create({
              support: cloneDeep(support),
              type,
              sectionId
            }));
          };
        };

        unit.supports.forEach(createItem(SupportTarget.unit));
        investigation && investigation.supports.forEach(createItem(SupportTarget.investigation));
        problem && problem.supports.forEach(createItem(SupportTarget.problem));
        problem && problem.sections.forEach((section) => {
          section.supports.forEach(createItem(SupportTarget.section, section.type));
        });

        self.curricularSupports.replace(supports);

        if (documents) {
          addSupportDocumentsToStore({ supports, ...params });
        }
      },

      addAuthoredSupports(supports: TeacherSupportModelType[], audienceType: AudienceEnum) {
        const currSupports = audienceType === AudienceEnum.class
          ? self.classSupports
          : audienceType === AudienceEnum.group
            ? self.groupSupports
            : self.userSupports;
        interface ISupportWithIndex {
          support: TeacherSupportModelType;
          index: number;
        }
        const supportMap: Record<string, ISupportWithIndex> = {};
        currSupports.forEach((s, i) => {
          supportMap[s.key] = { support: s, index: i };
        });
        supports
          .sort((supportA, supportB) => supportA.authoredTime - supportB.authoredTime)
          .forEach(inSupport => {
            const found = supportMap[inSupport.key];
            if (found) {
              // replace updated supports
              currSupports[found.index] = inSupport;
            }
            else {
              // add new supports
              currSupports.push(inSupport);
            }
          });
      },

      hideSupports() {
          self.allSupports.forEach((supportItem: SupportItemModelType) => supportItem.setVisible(false));
      },

      toggleSupport(supportItem: SupportItemModelType) {
        const visible = !supportItem.visible;
        self.allSupports.forEach((_supportItem: SupportItemModelType) => {
          _supportItem.setVisible((_supportItem === supportItem) && visible);
        });
        if (visible) {
          Logger.log(LogEventName.VIEW_SHOW_SUPPORT, {
            text: supportItem.support.content
          });
        }
      }
    };
  });

export type CurricularSupportModelType = Instance<typeof CurricularSupportModel>;
export type TeacherSupportModelType = Instance<typeof TeacherSupportModel>;
export type UnionSupportModelType = CurricularSupportModelType | TeacherSupportModelType;
export type SupportItemModelType = Instance<typeof SupportItemModel>;
export type SupportsModelType = Instance<typeof SupportsModel>;

function getTeacherSupportCaption(support: TeacherSupportModelType,
                                  investigation?: InvestigationModelType, problem?: ProblemModelType) {
  const investigationPart = investigation ? `${investigation.ordinal}` : "*";
  const problemPart = problem ? `${problem.ordinal}` : "*";
  const { sectionId } = support;
  const sectionPart = sectionId ? " " + getSectionInitials(sectionId) : "";
  const prefix = `${investigationPart}.${problemPart}${sectionPart}`;
  const caption = support.caption || "Untitled";
  return caption.includes(prefix)
          ? caption
          : `${prefix} ${caption}`;
}

function getCurricularSupportCaption(support: CurricularSupportModelType, index: number,
                                     investigation?: InvestigationModelType, problem?: ProblemModelType) {
  const investigationPart = investigation ? `${investigation.ordinal}` : "*";
  const problemPart = problem ? `${problem.ordinal}` : "*";
  const { sectionId } = support;
  const sectionPart = sectionId ? " " + getSectionTitle(sectionId) : "";
  return `${investigationPart}.${problemPart}${sectionPart} Support ${index}`;
}

function getSupportCaption(support: UnionSupportModelType, index: number,
                           investigation?: InvestigationModelType, problem?: ProblemModelType) {
  return support.supportType === SupportType.teacher
          ? getTeacherSupportCaption(support, investigation, problem)
          : getCurricularSupportCaption(support, index, investigation, problem);
}

export function addSupportDocumentsToStore(params: ICreateFromUnitParams) {
  const { db, fromDB, documents, investigation, problem, supports, onDocumentCreated } = params;
  if (!documents) {
    return;
  }
  let index = 0;
  let lastSection: string | undefined;
  supports && supports.forEach(async (support: UnionSupportModelType) => {
    // skip sticky notes
    if ((support.supportType === SupportType.teacher) && support.isStickyNote) {
      return;
    }

    const { sectionId } = support;
    if (sectionId === lastSection) {
      ++index;
    }
    else {
      index = 1;
      lastSection = sectionId;
    }
    const supportCaption = getSupportCaption(support, index, investigation, problem);
    const supportKey = support.supportType === SupportType.teacher
                        ? support.key || supportCaption
                        : supportCaption;
    const originDoc = support.supportType === SupportType.teacher
                        ? support.originDoc
                        : supportKey; // unique origin for curricular supports
    let properties: IDocumentProperties;
    if (support.supportType === SupportType.curricular) {
      properties = { curricularSupport: "true", caption: supportCaption };
    }
    // else it is a teacher support
    else {
      const isDeleted = support.deleted ? { isDeleted: "true" } : undefined;
      properties = {
        teacherSupport: "true",
        caption: supportCaption,
        ...isDeleted
      };
      // if we have a db add the properties from support document which can be
      // updated by the teacher to soft delete the document
      if (db && !fromDB) {
        // Note that this read fails for firestore supports immediately after they
        // have been created, perhaps before the update has been completed. Therefore,
        // we skip it for firestore supports (using the fromDB parameter), which means
        // that we won't include any properties other than the ones configured above.
        // For now this seems fine since no other properties are relevant to supports.
        properties = {...properties, ...await getSupportDocumentProperties(support, db)};
      }
    }

    let document = documents.getDocument(supportKey);
    if (document) {
      // update existing document properties if a document exists
      if (support.supportType === SupportType.teacher) {
        support.setDeleted(!!properties.isDeleted);
      }
      document.setProperties(properties);
    }
    else {
      const content = await getDocumentContentForSupport(support.support, db);
      if (content) {
        document = DocumentModel.create({
                     uid: "curriculum",
                     type: SupportPublication,
                     key: supportKey,
                     originDoc,
                     properties,
                     createdAt: Date.now(),
                     content: getSnapshot(content)
                   });
        documents.add(document);
        onDocumentCreated?.(support, document);
      }
    }
  });
}

export async function getSupportDocumentProperties(support: TeacherSupportModelType, db: DB) {
  const {audience, sectionTarget, key, support: { type }} = support;

  if (type === ESupportType.multiclass) {
    const snapshot = await db.firestore.getDocument(db.firestore.getMulticlassSupportDocumentPath(key));
    return snapshot.exists && (snapshot.data() as any).properties;
  }
  else {
    const path = `${db.firebase.getSupportsPath(db.stores.user, audience, sectionTarget, key)}/properties`;
    const ref = db.firebase.ref(path);
    const snapshot = await ref.once("value");

    return snapshot?.val() as IDocumentProperties;
  }
}

export async function getDocumentContentForSupport(support: SupportModelType, db?: DB) {
  let content: DocumentContentSnapshotType | IAuthoredDocumentContent | undefined;
  switch (support.type) {
    case ESupportType.document:
    case ESupportType.multiclass:
      content = safeJsonParse(support.content);
      break;
    case ESupportType.publication:
      if (db) {
        const contentPath = `${support.content}/content`;
        const contentRef = db.firebase.ref(contentPath);
        const snapshot = await contentRef.once("value");
        content = snapshot && safeJsonParse(snapshot.val());
      }
      break;
    case ESupportType.text:
    default:
      content = {
        tiles: [
          {
            content: {
              type: "Text",
              text: support.content
            }
          }
        ]
      };
      break;
  }
  return content ? DocumentContentModel.create(content) : undefined;
}
