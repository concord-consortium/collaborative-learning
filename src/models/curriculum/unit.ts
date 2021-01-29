import { Instance, types } from "mobx-state-tree";
import { DocumentContentModel } from "../document/document-content";
import { InvestigationModel } from "./investigation";
import { ISectionInfoMap, setSectionInfoMap } from "./section";
import { SupportModel } from "./support";
import { StampModel } from "../tools/drawing/drawing-content";
import { AppConfigModelType } from "../stores/app-config-model";
import { SettingsMstType } from "../stores/settings";
import { IBaseStores } from "../stores/stores";

export const UnitModel = types
  .model("Unit", {
    code: "",
    abbrevTitle: "",
    title: types.string,
    subtitle: "",
    disabled: types.array(types.string),
    placeholderText: "",
    sections: types.maybe(types.frozen<ISectionInfoMap>()),
    lookingAhead: types.maybe(DocumentContentModel),
    investigations: types.array(InvestigationModel),
    supports: types.array(SupportModel),
    defaultStamps: types.array(StampModel),
    settings: types.maybe(SettingsMstType)
  })
  .actions(self => ({
    afterCreate() {
      setSectionInfoMap(self.sections);
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
export type UnitModelType = Instance<typeof UnitModel>;

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

export function getGuideJson(unitId: string | undefined, appConfig: AppConfigModelType ) {
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
