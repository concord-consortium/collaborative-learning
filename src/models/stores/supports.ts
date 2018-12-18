import { types, Instance } from "mobx-state-tree";
import { values } from "lodash";
import { UnitModelType } from "../curriculum/unit";
import { SupportModelType } from "../curriculum/support";
import { ProblemModelType } from "../curriculum/problem";
import { InvestigationModelType } from "../curriculum/investigation";
import { Logger, LogEventName } from "../../lib/logger";

export enum SupportItemType {
  unit = "unit",
  investigation = "investigation",
  problem = "problem",
  section = "section",
}

export const SupportItemModel = types
  .model("SupportItem", {
    text: types.string,
    type: types.enumeration<SupportItemType>("SupportItemType", values(SupportItemType) as SupportItemType[]),
    visible: false,
    sectionId: types.maybe(types.string),
  })
  .actions((self) => {
    return {
      setVisible(visible: boolean) {
        self.visible = visible;
      }
    };
  });

export const SupportsModel = types
  .model("Supports", {
    supports: types.array(SupportItemModel)
  })
  .actions((self) => {
    return {
      createFromUnit(unit: UnitModelType, investigation?: InvestigationModelType, problem?: ProblemModelType) {
        const supports: SupportItemModelType[] = [];
        const createItem = (type: SupportItemType, sectionId?: string) => {
          return (support: SupportModelType) => {
            supports.push(SupportItemModel.create({
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

        self.supports.replace(supports);
      },

      getAllForSection(sectionId: string) {
        return self.supports.filter((support) => {
          return (support.type === SupportItemType.section) && (support.sectionId === sectionId);
        });
      },

      hideSupports() {
        self.supports.forEach((supportItem) => supportItem.setVisible(false));
      },

      toggleSupport(support: SupportItemModelType) {
        const visible = !support.visible;
        self.supports.forEach((supportItem) => {
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

export type SupportItemModelType = Instance<typeof SupportItemModel>;
export type SupportsModelType = Instance<typeof SupportsModel>;
