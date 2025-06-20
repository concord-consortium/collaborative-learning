import { Instance, SnapshotIn, getEnv, types } from "mobx-state-tree";
import { getUrlFromRelativeOrFullString } from "../../utilities/url-utils";
import { stripPTNumberFromBranch } from "../../utilities/branch-utils";
import { parseUrl } from "query-string";

interface ICurriculumConfigEnv {
  urlParams: { curriculumBranch?: string };
}

export const CurriculumConfig = types
  .model("CurriculumConfig", {
    // base URL of external curriculum unit repository
    curriculumSiteUrl: types.string,
    // unit code overrides (legacy unit code support)
    unitCodeMap: types.map(types.string),
    // default problem to load if none specified
    defaultUnit: "",
  })
  .views(self => ({
    get env() {
      return getEnv(self) as ICurriculumConfigEnv | undefined;
    }
  }))
  .views(self => ({
    get curriculumBaseUrl() {
      const { curriculumBranch } = self.env?.urlParams || {};
      const branchName = stripPTNumberFromBranch(curriculumBranch ?? "main");
      return `${self.curriculumSiteUrl}/branch/${branchName}`;
    }
  }))
  .views(self => ({
    getUnitUrl(unitParam: string) {
      const unitParamUrl = getUrlFromRelativeOrFullString(unitParam);
      if (unitParamUrl) {
        return unitParamUrl.href;
      }
      const unitCode = self.unitCodeMap.get(unitParam) || unitParam;
      return `${self.curriculumBaseUrl}/${unitCode}/content.json`;
    }
  }))
  .views(self => ({
    getUnit(unitParam: string) {
      const unitUrl = self.getUnitUrl(unitParam);
      const teacherGuideUrl = unitUrl.replace(/content\.json$/, "teacher-guide/content.json");
      return {"content": unitUrl, "guide": teacherGuideUrl};
    }
  }))
  .views(self => ({
    // TODO: figure out why this logic is needed.
    getUnitBasePath(unitId: string) {
      const unitSpec = self.getUnit(unitId);
      if (!unitSpec) return "";
      return `${unitId}`;
    },

    getUnitSpec(unitId: string | undefined) {
      const requestedUnit = unitId ? self.getUnit(unitId) : undefined;
      return requestedUnit || (self.defaultUnit ? self.getUnit(self.defaultUnit) : undefined);
    },

    /**
     * Find the unit code from the passed in URL.
     * So "https://collaborative-learning.concord.org/branch/master/index.html?unit=s%2Bs
     * will return sas
     *
     * @param url
     * @returns
     */
    getUnitCode(url: string) {
      const queryParams = parseUrl(url);
      const unitCode = queryParams.query.unit
                        ? queryParams.query.unit as string
                        : undefined;
      const mappedUnitCode = unitCode
                              ? self.unitCodeMap.get(unitCode)
                              : undefined;
      return mappedUnitCode || unitCode;
    },

    /**
     * Returns the unit code, plus all the unit code variants for renamed unit codes.
     * So "sas" will return ["sas", "s s", "s+s", "stretching-and-shrinking"]
     */
    getUnitCodeVariants(unitId: string) {
      const variantsSet = new Set<string>([unitId]);
      self.unitCodeMap.forEach((value, key) => {
        if (value === unitId) {
          variantsSet.add(key);
        }
      });
      return Array.from(variantsSet);
    }
  }));

export type CurriculumConfigType = typeof CurriculumConfig.Type;

export interface ICurriculumConfig extends Instance<typeof CurriculumConfig> {}
export interface ICurriculumConfigSnapshot extends SnapshotIn<typeof CurriculumConfig> {}

/**
 * Find the problem ordinal from a passed in URL.
 * So "https://collaborative-learning.concord.org/branch/master/index.html?problem=3.1"
 * returns "3.1"
 *
 * @param url
 * @returns
 */
export function getProblemOrdinal(url: string) {
  const queryParams = parseUrl(url);
  return queryParams.query.problem
    ? queryParams.query.problem as string
    : undefined;
}
