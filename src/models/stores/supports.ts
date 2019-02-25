import { types, Instance } from "mobx-state-tree";
import { values } from "lodash";
import { UnitModelType } from "../curriculum/unit";
import { SupportModelType } from "../curriculum/support";
import { ProblemModelType } from "../curriculum/problem";
import { InvestigationModelType } from "../curriculum/investigation";
import { Logger, LogEventName } from "../../lib/logger";
import { SectionType, AllSectionType, sectionInfo, allSectionInfo } from "../curriculum/section";

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

export enum SupportItemType {
  unit = "unit",
  investigation = "investigation",
  problem = "problem",
  section = "section",
}

export type TeacherSupportSectionTarget = SectionType | AllSectionType;

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
    text: types.string,
    type: types.enumeration<SupportItemType>("SupportItemType", values(SupportItemType) as SupportItemType[]),
    visible: false,
    sectionId: types.maybe(types.enumeration<SectionType>("SectionType", values(SectionType) as SectionType[])),
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
        return self.type === SupportItemType.section
          ? self.sectionId!
          : "all";
      },

      get sectionTargetDisplay(): string {
        return self.type === SupportItemType.section
          ? sectionInfo[self.sectionId!].title
          : allSectionInfo.title;
      },

      showForUserProblem(section: SectionType, groupId?: string, userId?: string) {
        const isUndeleted = !self.deleted;
        const isForSection = self.type === SupportItemType.problem
          || self.type === SupportItemType.section && self.sectionId === section;
        const isForUser = self.audience.type === AudienceEnum.class
          || self.audience.type === AudienceEnum.group && self.audience.identifier === groupId
          || self.audience.type === AudienceEnum.user && self.audience.identifier === userId;

        return isUndeleted && isForSection && isForUser;
      }
    };
  });

export const CurricularSupportModel = types
  .model("CurricularSupportModel", {
    supportType: types.optional(types.literal(SupportType.curricular), SupportType.curricular),
    text: types.string,
    type: types.enumeration<SupportItemType>("SupportItemType", values(SupportItemType) as SupportItemType[]),
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

    getSupportsForUserProblem(sectionId: SectionType, groupId?: string, userId?: string): SupportItemModelType[] {
        const curricularSupports: SupportItemModelType[] = self.curricularSupports.filter((support) => {
          return (support.type === SupportItemType.section) && (support.sectionId === sectionId);
        });

        const teacherSupports = self.teacherSupports.filter(support => {
          return support.showForUserProblem(sectionId, groupId, userId);
        });

        return curricularSupports.concat(teacherSupports);
    }
  }))
  .actions((self) => {
    return {
      createFromUnit(unit: UnitModelType, investigation?: InvestigationModelType, problem?: ProblemModelType) {
        const supports: CurricularSupportModelType[] = [];
        const createItem = (type: SupportItemType, sectionId?: string) => {
          return (support: SupportModelType) => {
            supports.push(CurricularSupportModel.create({
              text: support.text,
              type: type as SupportItemType,
              sectionId
            }));
          };
        };

        unit.supports.forEach(createItem(SupportItemType.unit));
        investigation && investigation.supports.forEach(createItem(SupportItemType.investigation));
        problem && problem.supports.forEach(createItem(SupportItemType.problem));
        problem && problem.sections.forEach((section) => {
          section.supports.forEach(createItem(SupportItemType.section, section.id));
        });

        self.curricularSupports.replace(supports);
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

      toggleSupport(support: SupportItemModelType) {
        const visible = !support.visible;
        self.allSupports.forEach((supportItem: SupportItemModelType) => {
          supportItem.setVisible((support === supportItem) && visible);
        });
        if (visible) {
          Logger.log(LogEventName.VIEW_SHOW_SUPPORT, {
            text: support.text
          });
        }
      }
    };
  });

export type CurricularSupportModelType = Instance<typeof CurricularSupportModel>;
export type TeacherSupportModelType = Instance<typeof TeacherSupportModel>;
export type SupportItemModelType = Instance<typeof SupportItemModel>;
export type SupportsModelType = Instance<typeof SupportsModel>;
