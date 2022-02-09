import { IReactionDisposer, reaction } from "mobx";
import { Instance, SnapshotIn, types } from "mobx-state-tree";
import { DocumentContentModel } from "../document/document-content";
import { InvestigationModel } from "./investigation";
import { ISectionInfoMap, SectionModel, registerSectionInfo } from "./section";
import { SupportModel } from "./support";
import { StampModel } from "../tools/drawing/stamp";
import { AppConfigModelType } from "../stores/app-config-model";
import { NavTabsConfigModel } from "../stores/nav-tabs";
import { SettingsMstType } from "../stores/settings";
import { IBaseStores } from "../stores/stores";
import { UnitConfiguration } from "../stores/unit-configuration";

const PlanningDocumentConfigModel = types
  .model("PlanningDocumentConfigModel", {
    // boolean true to enable for all; "teacher" or "student" to enable for specific user roles
    enable: types.union(types.boolean, types.enumeration("role", ["student", "teacher"])),
    // whether to create a default planning document for each problem for each user
    default: true,
    // planning document section definitions
    sectionInfo: types.maybe(types.frozen<ISectionInfoMap>()),
    sections: types.array(SectionModel)
  })
  .views(self => ({
    isEnabledForRole(role?: "student" | "teacher") {
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
    supports: types.array(SupportModel),
    config: types.maybe(types.frozen<Partial<UnitConfiguration>>())
  })
  .volatile(self => ({
    userListenerDisposer: null as IReactionDisposer | null
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
    }
  }));
interface LegacySnapshot extends SnapshotIn<typeof LegacyUnitModel> {}
interface ModernSnapshot extends SnapshotIn<typeof ModernUnitModel> {}

const isLegacySnapshot = (sn: ModernSnapshot | LegacySnapshot): sn is LegacySnapshot => {
  const s = sn as LegacySnapshot;
  return !!s.disabled || !!s.navTabs || !!s.placeholderText || !!s.defaultStamps || !!s.settings;
};

export const UnitModel = types.snapshotProcessor(ModernUnitModel, {
  preProcessor(sn: ModernSnapshot | LegacySnapshot) {
    if (isLegacySnapshot(sn)) {
      const {
        disabled: disabledFeatures, navTabs, placeholderText, defaultStamps: stamps, settings, ...others
      } = sn;
      return { ...others, config: { disabledFeatures, navTabs, placeholderText, stamps, settings } };
    }
    return sn;
  }
});
export interface UnitModelType extends Instance<typeof UnitModel> {}

function getUnitSpec(unitId: string | undefined, appConfig: AppConfigModelType) {
  const requestedUnit = unitId ? appConfig.getUnit(unitId) : undefined;
  if (unitId && !requestedUnit) {
    console.warn(`unitId "${unitId}" not found in appConfig.units`);
  }
  return requestedUnit || (appConfig.defaultUnit ? appConfig.getUnit(appConfig.defaultUnit) : undefined);
}

export function getUnitJson(unitId: string | undefined, appConfig: AppConfigModelType) {
  const unitSpec = getUnitSpec(unitId, appConfig);
  const unitUrl = unitSpec?.content;
  return fetch(unitUrl!)
          .then(response => {
            if (response.ok) {
              return response.json();
            }
            else {
              throw Error(`Request rejected with status ${response.status}`);
            }
          })
          .catch(error => {
            throw Error(`Request rejected with exception`);
          });
}

export function getGuideJson(unitId: string | undefined, appConfig: AppConfigModelType) {
  const unitSpec = getUnitSpec(unitId, appConfig);
  const guideUrl = unitSpec?.guide;
  if (!guideUrl) return;
  return fetch(guideUrl)
          .then(response => {
            if (response.ok) {
              return response.json();
            }
            else {
              throw Error(`Request rejected with status ${response.status}`);
            }
          })
          .catch(error => {
            throw Error(`Request rejected with exception`);
          });
}

export function isDifferentUnitAndProblem(stores: IBaseStores, unitId?: string | undefined, problemOrdinal?: string) {
  if (!unitId || !problemOrdinal) return false;
  const { unit, investigation, problem } = stores;
  const combinedOrdinal = `${investigation.ordinal}.${problem.ordinal}`;
  return (unit.code !== unitId) || (combinedOrdinal !== problemOrdinal);
}
