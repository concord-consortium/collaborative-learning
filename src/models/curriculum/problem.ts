import { types } from "mobx-state-tree";
import { SectionModel, SectionModelType } from "./section";

export const ProblemModel = types
  .model("Problem", {
    ordinal: types.integer,
    title: types.string,
    subtitle: "",
    sections: types.array(SectionModel)
  })
  .views((self) => {
    return {
      get fullTitle() {
        return `${self.title}${self.subtitle ? `: ${self.subtitle}` : ""}`;
      },
      getSectionByIndex(index: number): SectionModelType|null {
        const safeIndex = Math.max(0, Math.min(index, self.sections.length - 1));
        return self.sections[safeIndex] || null;
      }
    };
  });

export type ProblemModelType = typeof ProblemModel.Type;
