import { IReactionDisposer, reaction } from "mobx";
import { getParent, Instance, SnapshotIn, types } from "mobx-state-tree";

import { buildProblemPath, buildSectionPath } from "../../../shared/shared";
import { DocumentContentModel } from "../document/document-content";
import { InvestigationModel, InvestigationModelType } from "./investigation";
import { ISectionInfoMap, SectionModel, SectionModelType,registerSectionInfo } from "./section";
import { ProblemModelType } from "./problem";
import { SupportModel } from "./support";
import { StampModel } from "../../plugins/drawing/model/stamp";
import { NavTabsConfigModel } from "../stores/nav-tabs";
import { SettingsMstType } from "../stores/settings";
import { UnitConfiguration } from "../stores/unit-configuration";

const PlanningDocumentConfigModel = types
  .model("PlanningDocumentConfigModel", {
    // boolean true to enable for all; "teacher" or "student" or "researcher" to enable for specific user roles
    enable: types.union(types.boolean, types.enumeration("role", ["student", "teacher", "researcher"])),
    // whether to create a default planning document for each problem for each user
    default: true,
    // planning document section definitions
    sectionInfo: types.maybe(types.frozen<ISectionInfoMap>()),
    sections: types.array(SectionModel)
  })
  .views(self => ({
    isEnabledForRole(role?: "student" | "teacher" | "researcher") {
      return (self.enable === true) || (self.enable === role);
    }
  }));

const LegacyUnitModel = types
  .model("LegacyUnit", {
    code: "",
    abbrevTitle: "",
    title: types.string,
    subtitle: "",
    disabled: types.array(types.string),
    placeholderText: "",
    // problem document section definitions
    sections: types.maybe(types.frozen<ISectionInfoMap>()),
    planningDocument: types.maybe(PlanningDocumentConfigModel),
    lookingAhead: types.maybe(DocumentContentModel),
    investigations: types.array(InvestigationModel),
    supports: types.array(SupportModel),
    defaultStamps: types.array(StampModel),
    settings: types.maybe(SettingsMstType),
    navTabs: types.maybe(NavTabsConfigModel),
  });


const ModernUnitModel = types
  .model("Unit", {
    code: "",
    abbrevTitle: "",
    title: types.string,
    subtitle: "",
    sections: types.maybe(types.frozen<ISectionInfoMap>()),
    planningDocument: types.maybe(PlanningDocumentConfigModel),
    lookingAhead: types.maybe(DocumentContentModel),
    investigations: types.array(InvestigationModel),
    config: types.maybe(types.frozen<Partial<UnitConfiguration>>())
  })
  .volatile(self => ({
    userListenerDisposer: null as IReactionDisposer | null,
    facet: undefined as string | undefined,
  }))
  .actions(self => ({
    afterCreate() {
      registerSectionInfo(self.sections);
      if (self.planningDocument?.sectionInfo) {
        registerSectionInfo(self.planningDocument.sectionInfo);
      }
    },
    beforeDestroy() {
      self.userListenerDisposer?.();
    },
    installUserListener(isTeacherFn: () => boolean, reactionFn: (isTeacher: boolean) => Promise<void>) {
      self.userListenerDisposer = reaction(isTeacherFn, reactionFn, { fireImmediately: true });
    },
    setFacet(facet: string) {
      self.facet = facet;
    }
  }))
  .views(self => ({
    get fullTitle() {
      return `${self.title}${self.subtitle ? ": " + self.subtitle : ""}`;
    },
    getInvestigation(investigationOrdinal: number) {
      return self.investigations.find(inv => inv.ordinal === investigationOrdinal);
    }
  }))
  .views(self => ({
    // ordinalString: e.g. "2.1", "2.2", etc.
    getProblem(ordinalString: string) {
      const ordinals = ordinalString.split(".");
      // if only one exists, investigation defaults to 1
      // if neither exists, investigation defaults to 0
      const investigationOrdinal = ordinals[1] ? +ordinals[0] : (+ordinals[0] ? 1 : 0);
      // if only one exists, it corresponds to problem
      const problemOrdinal = ordinals[1] ? +ordinals[1] : +ordinals[0];
      const investigation = self.getInvestigation(investigationOrdinal);
      return {
        investigation,
        problem: investigation?.getProblem(problemOrdinal)
      };
    },
    getAllProblemOrdinals() {
      return self.investigations.reduce<string[]>((acc, investigation) => {
        return investigation.problems.reduce<string[]>((innerAcc, problem) => {
          const problemOrdinal = `${investigation.ordinal}.${problem.ordinal}`;
          return [...innerAcc, problemOrdinal];
        }, acc);
      }, []);
    }
  }));
export interface LegacyUnitSnapshot extends SnapshotIn<typeof LegacyUnitModel> {}
export interface ModernUnitSnapshot extends SnapshotIn<typeof ModernUnitModel> {}

const hasLegacySnapshotProperties = (sn: ModernUnitSnapshot | LegacyUnitSnapshot) => {
  return "disabled" in sn || "navTabs" in sn || "placeholderText" in sn || "defaultStamps" in sn || "settings" in sn;
};

const isLegacySnapshot = (sn: ModernUnitSnapshot | LegacyUnitSnapshot): sn is LegacyUnitSnapshot => {
  return !("config" in sn) && hasLegacySnapshotProperties(sn);
};

const isAmbiguousSnapshot = (sn: ModernUnitSnapshot | LegacyUnitSnapshot) => {
  return "config" in sn && hasLegacySnapshotProperties(sn);
};

export const UnitModel = types.snapshotProcessor(ModernUnitModel, {
  preProcessor(sn: ModernUnitSnapshot | LegacyUnitSnapshot) {
    if (isLegacySnapshot(sn)) {
      const {
        disabled: disabledFeatures, navTabs, placeholderText, defaultStamps: stamps, settings, ...others
      } = sn;
      return {
        ...others, config: { disabledFeatures, navTabs, placeholderText, stamps, settings }
      } as ModernUnitSnapshot;
    }
    if (isAmbiguousSnapshot(sn)) {
      console.warn("UnitModel ignoring legacy top-level properties!");
    }
    return sn;
  }
});
export interface UnitModelType extends Instance<typeof UnitModel> {}

export function getSectionPath(section: SectionModelType) {
  // The sections we work with at runtime are not MST children of their problem
  // In order to avoid circular dependencies the problem is stored in a generic
  // realParent volatile property of the section model
  const problem = section.realParent as ProblemModelType | undefined;
  if (!problem) {
    // If there is a coding error, realParent might undefined
    throw new Error("section was not initialized right");
  }
  // getParent is called twice because the direct parent is an array
  const investigation = getParent(getParent(problem)) as InvestigationModelType;
  const unit = getParent(getParent(investigation)) as UnitModelType;
  const problemPath = buildProblemPath(unit.code, `${investigation.ordinal}`, `${problem.ordinal}`);

  return buildSectionPath(problemPath, section.type, unit.facet) || '';
}
