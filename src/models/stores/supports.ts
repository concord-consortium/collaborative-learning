import { types, Instance, getSnapshot } from "mobx-state-tree";
import { cloneDeep } from "lodash";
import { UnitModelType } from "../curriculum/unit";
import { SupportModel, SupportModelType, getDocumentContentForSupport } from "../curriculum/support";
import { ProblemModelType } from "../curriculum/problem";
import { InvestigationModelType } from "../curriculum/investigation";
import { Logger, LogEventName } from "../../lib/logger";
import { SectionType, AllSectionType, sectionInfo, allSectionInfo } from "../curriculum/section";
import { DocumentModel, SupportPublication } from "../document/document";
import { DocumentsModelType } from "./documents";

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

export enum SupportTarget {
  unit = "unit",
  investigation = "investigation",
  problem = "problem",
  section = "section",
}

export type TeacherSupportSectionTarget = SectionType | AllSectionType;

export interface ISupportTarget {
  sectionId?: SectionType;
  groupId?: string;
  userId?: string;
}

export const ClassAudienceModel = types
  .model("ClassAudienceModel", {
    type: types.optional(types.literal(AudienceEnum.class), AudienceEnum.class),
    identifier: types.undefined
  });
export const GroupAudienceModel = types
  .model("ClassAudienceModel", {
    type: types.optional(types.literal(AudienceEnum.group), AudienceEnum.group),
    identifier: types.string
  });
export const UserAudienceModel = types
  .model("ClassAudienceModel", {
    type: types.optional(types.literal(AudienceEnum.user), AudienceEnum.user),
    identifier: types.string
  });

export const AudienceModel = types.union(ClassAudienceModel, GroupAudienceModel, UserAudienceModel);
export type AudienceModelType = Instance<typeof AudienceModel>;

export const TeacherSupportModel = types
  .model("TeacherSupportModel", {
    supportType: types.optional(types.literal(SupportType.teacher), SupportType.teacher),
    key: types.identifier,
    support: SupportModel,
    type: types.enumeration<SupportTarget>("SupportTarget", Object.values(SupportTarget)),
    visible: false,
    sectionId: types.maybe(types.enumeration<SectionType>("SectionType", Object.values(SectionType))),
    audience: AudienceModel,
    authoredTime: types.number,
    deleted: false
  })
  .actions((self) => {
    return {
      setVisible(visible: boolean) {
        self.visible = visible;
      }
    };
  })
  .views((self) => {
    return {
      get sectionTarget(): TeacherSupportSectionTarget {
        return self.type === SupportTarget.section
          ? self.sectionId!
          : "all";
      },

      get sectionTargetDisplay(): string {
        return self.type === SupportTarget.section
          ? sectionInfo[self.sectionId!].title
          : allSectionInfo.title;
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
    };
  });

export interface ICreateFromUnitParams {
  unit: UnitModelType;
  investigation?: InvestigationModelType;
  problem?: ProblemModelType;
  documents?: DocumentsModelType;
}

export interface IAddSupportDocuments extends ICreateFromUnitParams {
  supports: CurricularSupportModelType[];
}

export const CurricularSupportModel = types
  .model("CurricularSupportModel", {
    supportType: types.optional(types.literal(SupportType.curricular), SupportType.curricular),
    support: SupportModel,
    type: types.enumeration<SupportTarget>("SupportItemType", Object.values(SupportTarget)),
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

export const SupportsModel = types
  .model("Supports", {
    curricularSupports: types.array(CurricularSupportModel),
    classSupports: types.array(TeacherSupportModel),
    groupSupports: types.array(TeacherSupportModel),
    userSupports: types.array(TeacherSupportModel)
  })
  .views((self) => ({
    get teacherSupports() {
      return self.classSupports
        .concat(self.groupSupports)
        .concat(self.userSupports);
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

        const teacherSupports = self.teacherSupports.filter(support => {
          return support.showForUserProblem(target);
        });

        return supports.concat(teacherSupports);
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
              type: type as SupportTarget,
              sectionId
            }));
          };
        };

        unit.supports.forEach(createItem(SupportTarget.unit));
        investigation && investigation.supports.forEach(createItem(SupportTarget.investigation));
        problem && problem.supports.forEach(createItem(SupportTarget.problem));
        problem && problem.sections.forEach((section) => {
          section.supports.forEach(createItem(SupportTarget.section, section.id));
        });

        self.curricularSupports.replace(supports);

        if (documents) {
          addVirtualSupportDocumentsToStore({ supports, ...params });
        }
      },

      setAuthoredSupports(supports: TeacherSupportModelType[], audienceType: AudienceEnum) {
        const currSupports = audienceType === AudienceEnum.class
          ? self.classSupports
          : audienceType === AudienceEnum.group
            ? self.groupSupports
            : self.userSupports;
        currSupports.clear();
        supports
          .sort((supportA, supportB) => supportA.authoredTime - supportB.authoredTime)
          .forEach(support => currSupports.push(support));
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
export type SupportItemModelType = Instance<typeof SupportItemModel>;
export type SupportsModelType = Instance<typeof SupportsModel>;

function addVirtualSupportDocumentsToStore(params: IAddSupportDocuments) {
  const { supports, investigation, problem, documents } = params;
  const investigationPart = investigation ? `${investigation.ordinal}` : "*";
  const problemPart = problem ? `${problem.ordinal}` : "*";
  let index = 0;
  let lastSection: string | undefined;
  supports.forEach(support => {
    const supportSection = support.sectionId;
    const sectionPart = supportSection && sectionInfo[supportSection as SectionType].title;
    if (supportSection === lastSection) {
      ++index;
    }
    else {
      index = 1;
      lastSection = supportSection;
    }
    const supportCaption = `${investigationPart}.${problemPart} ${sectionPart} Support ${index}`;
    const document = DocumentModel.create({
                      uid: "curriculum",
                      type: SupportPublication,
                      key: supportCaption,  // use the caption as unique ID since we don't have a firebase ID
                      properties: { curricularSupport: "true", caption: supportCaption },
                      createdAt: Date.now(),
                      content: getSnapshot(getDocumentContentForSupport(support.support))
                    });
    documents && documents.add(document);
  });
}
