import { getParent, Instance, SnapshotIn, types } from "mobx-state-tree";
import { InvestigationModelType } from "./investigation";
import { UnitModelType } from "./unit";
import { SectionModel, SectionModelType } from "./section";
import { SettingsMstType } from "../stores/settings";
import { SupportModel } from "./support";
import { ProblemConfiguration } from "../stores/problem-configuration";
import { buildProblemPath } from "../../../functions/src/shared";

const LegacyProblemModel = types
  .model("Problem", {
    ordinal: types.integer,
    title: types.string,
    subtitle: "",
    disabled: types.array(types.string),
    sections: types.array(SectionModel),
    supports: types.array(SupportModel),
    settings: types.maybe(SettingsMstType)
  });

const ModernProblemModel = types
  .model("Problem", {
    ordinal: types.integer,
    title: types.string,
    subtitle: "",
    sections: types.array(SectionModel),
    supports: types.array(SupportModel),
    config: types.maybe(types.frozen<Partial<ProblemConfiguration>>())
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
  }))
  .views(self => ({
    get investigation(): InvestigationModelType {
      // getParent is called twice below because each direct parent is an array
      return getParent(getParent(self)) as InvestigationModelType;
    },
  }))
  .views(self => ({
    get problemPath(): string {
      const unit = self.investigation.unit;
      return buildProblemPath(unit.code, `${self.investigation.ordinal}`, `${self.ordinal}`);
    }
  }));
interface LegacySnapshot extends SnapshotIn<typeof LegacyProblemModel> {}
interface ModernSnapshot extends SnapshotIn<typeof ModernProblemModel> {}

export const ProblemModel = types.snapshotProcessor(ModernProblemModel, {
  preProcessor(sn: ModernSnapshot & LegacySnapshot) {
    const { disabled: _disabled, settings: _settings, config: _config, ...others } = sn;
    const disabledFeatures = _disabled ? { disabledFeatures: _disabled } : undefined;
    const settings = _settings ? { settings: _settings } : undefined;
    const config = _config || disabledFeatures || settings
                    ? { config: { ...disabledFeatures, ...settings, ..._config } }
                    : undefined;
    return { ...others, ...config };
  }
});
export interface ProblemModelType extends Instance<typeof ModernProblemModel> {}
