import { types, Instance, SnapshotIn } from "mobx-state-tree";
import { DocumentContentModel } from "../document/document-content";
import { ProblemModel } from "./problem";
import { SupportModel } from "./support";
import { ProblemConfiguration } from "../stores/problem-configuration";
import { SettingsMstType } from "../stores/settings";


const LegacyInvestigationModel = types
  .model("Investigation", {
    ordinal: types.integer,
    title: types.string,
    disabled: types.array(types.string),
    introduction: types.maybe(DocumentContentModel),
    problems: types.array(ProblemModel),
    reflections: types.maybe(DocumentContentModel),
    supports: types.array(SupportModel),
    settings: types.maybe(SettingsMstType)
  });

const ModernInvestigationModel = types
  .model("Investigation", {
    ordinal: types.integer,
    title: types.string,
    introduction: types.maybe(DocumentContentModel),
    problems: types.array(ProblemModel),
    reflections: types.maybe(DocumentContentModel),
    config: types.maybe(types.frozen<Partial<ProblemConfiguration>>())
  })
  .views(self => {
    return {
      getProblem(problemOrdinal: number) {
        return self.problems.find(problem => problem.ordinal === problemOrdinal);
      }
    };
  });
export interface LegacyInvestigationSnapshot extends SnapshotIn<typeof LegacyInvestigationModel> {}
export interface ModernInvestigationSnapshot extends SnapshotIn<typeof ModernInvestigationModel> {}

const isLegacySnapshot = (sn: ModernInvestigationSnapshot | LegacyInvestigationSnapshot)
        : sn is LegacyInvestigationSnapshot => {
  return "disabled" in sn || "settings" in sn;
};

export const InvestigationModel = types.snapshotProcessor(ModernInvestigationModel, {
  preProcessor(sn: ModernInvestigationSnapshot | LegacyInvestigationSnapshot) {
    if (isLegacySnapshot(sn)) {
      const { disabled: disabledFeatures, settings, ...others } = sn;
      return { ...others, config: { disabledFeatures, settings } } as ModernInvestigationSnapshot;
    }
    return sn;
  }
});
export interface InvestigationModelType extends Instance<typeof InvestigationModel> {}
