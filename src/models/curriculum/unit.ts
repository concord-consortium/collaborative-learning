import { IReactionDisposer, reaction } from "mobx";
import { getParent, Instance, SnapshotIn, types } from "mobx-state-tree";

import { buildProblemPath, buildSectionPath } from "../../../functions/src/shared";
import { DocumentContentModel } from "../document/document-content";
import { InvestigationModel, InvestigationModelType } from "./investigation";
import {
  ISectionInfoMap, SectionModel, SectionModelType,
  registerSectionInfo, suspendSectionContentParsing, resumeSectionContentParsing
} from "./section";
import { ProblemModelType } from "./problem";
import { resumeSupportContentParsing, SupportModel, suspendSupportContentParsing } from "./support";
import { StampModel } from "../../plugins/drawing/model/stamp";
import { getAssetUrl } from "../../utilities/asset-utils";
import { AppConfigModelType } from "../stores/app-config-model";
import { NavTabsConfigModel } from "../stores/nav-tabs";
import { SettingsMstType } from "../stores/settings";
import { IBaseStores } from "../stores/base-stores-types";
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
    }
  }));
interface LegacySnapshot extends SnapshotIn<typeof LegacyUnitModel> {}
interface ModernSnapshot extends SnapshotIn<typeof ModernUnitModel> {}

const hasLegacySnapshotProperties = (sn: ModernSnapshot | LegacySnapshot) => {
  const s = sn as LegacySnapshot;
  return !!s.disabled || !!s.navTabs || !!s.placeholderText || !!s.defaultStamps || !!s.settings;
};

const isLegacySnapshot = (sn: ModernSnapshot | LegacySnapshot): sn is LegacySnapshot => {
  const s = sn as ModernSnapshot;
  return !s.config && hasLegacySnapshotProperties(sn);
};

const isAmbiguousSnapshot = (sn: ModernSnapshot | LegacySnapshot): sn is LegacySnapshot => {
  const s = sn as ModernSnapshot;
  return !!s.config && hasLegacySnapshotProperties(sn);
};

export const UnitModel = types.snapshotProcessor(ModernUnitModel, {
  preProcessor(sn: ModernSnapshot | LegacySnapshot) {
    if (isLegacySnapshot(sn)) {
      const {
        disabled: disabledFeatures, navTabs, placeholderText, defaultStamps: stamps, settings, ...others
      } = sn;
      return { ...others, config: { disabledFeatures, navTabs, placeholderText, stamps, settings } };
    }
    else if (isAmbiguousSnapshot(sn)) {
      console.warn("UnitModel ignoring legacy top-level properties!");
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

const getExternalProblemSectionData = async (invIdx: number, probIdx: number, sectIdx: number, dataUrl: string) => {
  const sectionData = await fetch(dataUrl).then(res => res.json());
  return { invIdx, probIdx, sectIdx, sectionData };
};

const populateProblemSections = async (content: Record<string, any>, unitUrl: string) => {
  const externalSectionsArray = [];
  for (let invIdx = 0; invIdx < content.investigations.length; invIdx++) {
    const investigation = content.investigations[invIdx];
    for (let probIdx = 0; probIdx < investigation.problems.length; probIdx++) {
      const problem = investigation.problems[probIdx];
      for (let sectIdx = 0; sectIdx < problem.sections.length; sectIdx++) {
        // Currently, curriculum files can either contain their problem section data inline
        // or in external JSON files. In the latter case, the problem sections arrays will
        // be made up of strings that are paths to the external files. We fetch the data from
        // those files and populate the section with it. Otherwise, we leave the section as
        // is. Eventually, all curriculum files will be updated so their problem section data
        // is in external files.
        const section = problem.sections[sectIdx];
        if (typeof section === "string") {
          const sectionDataFile = section;
          const sectionDataUrl = new URL(sectionDataFile, unitUrl).href;
          externalSectionsArray.push(getExternalProblemSectionData(invIdx, probIdx, sectIdx, sectionDataUrl));
        }
      }
    }
  }
  if (externalSectionsArray.length > 0) {
    await Promise.all(externalSectionsArray).then((sections: any) => {
      for (const section of sections) {
        const { invIdx, probIdx, sectIdx, sectionData } = section;
        content.investigations[invIdx].problems[probIdx].sections[sectIdx] = sectionData;
      }
    });
  }
  return content;
};

export function getUnitJson(unitId: string | undefined, appConfig: AppConfigModelType) {
  const unitSpec = getUnitSpec(unitId, appConfig);
  const unitPath = unitSpec?.content;
  const unitUrl = getAssetUrl(unitPath!);
  return fetch(unitUrl!)
           .then(async response => {
             if (response.ok) {
               const unitContent = await response.json();
               const fullUnitContent = unitContent && populateProblemSections(unitContent, unitUrl);
               return fullUnitContent;
             }
             else {
               throw Error(`Request rejected with status ${response.status}`);
             }
           })
           .catch(error => {
             throw Error(`Request rejected with exception ${error}`);
           });
}

export function getGuideJson(unitId: string | undefined, appConfig: AppConfigModelType) {
  const unitSpec = getUnitSpec(unitId, appConfig);
  const guidePath = unitSpec?.guide;
  if (!guidePath) return;
  const guideUrl = getAssetUrl(guidePath!);
  return fetch(guideUrl)
          .then(async response => {
            if (response.ok) {
              const guideContent = await response.json();
              const fullGuideContent = guideContent && populateProblemSections(guideContent, guideUrl);
              return fullGuideContent;
            }
            else {
              throw Error(`Request rejected with status ${response.status}`);
            }
          })
          .catch(error => {
            throw Error(`Request rejected with exception`);
          });
}

export function createUnitWithoutContent(unitJson: any) {
  // read the unit content, but don't instantiate section contents (DocumentModels)
  try {
    suspendSectionContentParsing();
    suspendSupportContentParsing();
    return UnitModel.create(unitJson);
  }
  finally {
    resumeSupportContentParsing();
    resumeSectionContentParsing();
  }
}

export function isDifferentUnitAndProblem(stores: IBaseStores, unitId?: string | undefined, problemOrdinal?: string) {
  if (!unitId || !problemOrdinal) return false;
  const { unit, investigation, problem } = stores;
  const combinedOrdinal = `${investigation.ordinal}.${problem.ordinal}`;
  return (unit.code !== unitId) || (combinedOrdinal !== problemOrdinal);
}

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
