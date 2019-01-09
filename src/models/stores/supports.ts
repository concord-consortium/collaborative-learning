import { types, Instance } from "mobx-state-tree";
import { values } from "lodash";
import { UnitModelType } from "../curriculum/unit";
import { SupportModelType } from "../curriculum/support";
import { ProblemModelType } from "../curriculum/problem";
import { InvestigationModelType } from "../curriculum/investigation";
import { Logger, LogEventName } from "../../lib/logger";
import { SectionType } from "../curriculum/section";

export enum SupportAudienceType {
  class = "class",
  group = "group",
  user = "user"
}

export enum SupportItemType {
  unit = "unit",
  investigation = "investigation",
  problem = "problem",
  section = "section",
}

export const TeacherSupportModel = types
  .model("TeacherSupportModel", {
    key: types.identifier,
    text: types.string,
    type: types.enumeration<SupportItemType>("SupportItemType", values(SupportItemType) as SupportItemType[]),
    visible: false,
    sectionId: types.maybe(types.enumeration<SectionType>("SectionType", values(SupportItemType) as SectionType[])),
    audience: types.enumeration<SupportAudienceType>("SupportAudienceType",
      values(SupportAudienceType) as SupportAudienceType[]),
    authoredTime: types.number,
    deleted: false
  })
  .actions((self) => {
    return {
      setVisible(visible: boolean) {
        self.visible = visible;
      }
    };
  });

export const CurricularSupportModel = types
  .model("CurricularSupportModel", {
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
    teacherSupports: types.array(TeacherSupportModel)
  })
  .views((self) => ({
    get allSupports() {
      return self.curricularSupports.concat(self.teacherSupports);
    },

    getAllForSection(sectionId: string): SupportItemModelType[] {
      const curricularSupports = self.curricularSupports.filter((support) => {
        return (support.type === SupportItemType.section) && (support.sectionId === sectionId);
      });

      // TODO: Filter for class and relevant group/user supports
      const teacherSupports = self.teacherSupports.filter(support => !support.deleted);

      return curricularSupports.concat(teacherSupports);
    },
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

      setAuthoredSupports(supports: TeacherSupportModelType[]) {
        self.teacherSupports.clear();
        supports
          .sort((supportA, supportB) => supportA.authoredTime - supportB.authoredTime)
          .forEach(support => self.teacherSupports.push(support));
      },

      hideSupports() {
        self.allSupports.forEach((supportItem) => supportItem.setVisible(false));
      },

      toggleSupport(support: SupportItemModelType) {
        const visible = !support.visible;
        self.allSupports.forEach((supportItem) => {
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
