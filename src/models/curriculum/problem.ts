import { types } from "mobx-state-tree";
import { SectionModel, SectionModelType } from "./section";
import { SettingsMstType } from "../stores/settings";
import { SupportModel } from "./support";

export const ProblemModel = types
  .model("Problem", {
    ordinal: types.integer,
    title: types.string,
    subtitle: "",
    disabled: types.array(types.string),
    sections: types.array(SectionModel),
    supports: types.array(SupportModel),
    settings: types.maybe(SettingsMstType)
  })
  .views(self => ({
    get fullTitle() {
      return `${self.title}${self.subtitle ? `: ${self.subtitle}` : ""}`;
    },
    getSectionByIndex(index: number): SectionModelType|undefined {
      const safeIndex = Math.max(0, Math.min(index, self.sections.length - 1));
      return self.sections[safeIndex];
    },
    getSectionById(sectionId: string): SectionModelType|undefined {
      return self.sections.find((section) => section.type === sectionId);
    }
  }));

export type ProblemModelType = typeof ProblemModel.Type;
