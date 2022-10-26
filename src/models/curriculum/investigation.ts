import { types, Instance, SnapshotIn, getParent } from "mobx-state-tree";
import { DocumentContentModel } from "../document/document-content";
import { ProblemModel } from "./problem";
import { SupportModel } from "./support";
import { ProblemConfiguration } from "../stores/problem-configuration";
import { SettingsMstType } from "../stores/settings";
import { UnitModelType } from "./unit";

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
    supports: types.array(SupportModel),
    config: types.maybe(types.frozen<Partial<ProblemConfiguration>>())
  })
  .views(self => {
    return {
      getProblem(problemOrdinal: number) {
        return self.problems.find(problem => problem.ordinal === problemOrdinal);
      },
      get unit(): UnitModelType {
        // getParent is called twice below because each direct parent is an array
        return getParent(getParent(self)) as UnitModelType;
      },
    };
  });
interface LegacySnapshot extends SnapshotIn<typeof LegacyInvestigationModel> {}
interface ModernSnapshot extends SnapshotIn<typeof ModernInvestigationModel> {}

const isLegacySnapshot = (sn: ModernSnapshot | LegacySnapshot): sn is LegacySnapshot => {
  const s = sn as LegacySnapshot;
  return !!s.disabled || !!s.settings;
};

export const InvestigationModel = types.snapshotProcessor(ModernInvestigationModel, {
  preProcessor(sn: ModernSnapshot | LegacySnapshot) {
    if (isLegacySnapshot(sn)) {
      const { disabled: disabledFeatures, settings, ...others } = sn;
      return { ...others, config: { disabledFeatures, settings } };
    }
    return sn;
  }
});
export interface InvestigationModelType extends Instance<typeof InvestigationModel> {}
