import { ICurriculumConfig } from "../stores/curriculum-config";

export function getUnitJson(unitId: string | undefined, curriculumConfig: ICurriculumConfig) {
  const unitSpec = curriculumConfig.getUnitSpec(unitId);
  const unitUrl = unitSpec?.content;
  return fetch(unitUrl!)
    .then(async (response) => {
      if (response.ok) {
        const unitContent = await response.json();
        const fullUnitContent = unitContent && populateProblemSections(unitContent, unitUrl!);
        return fullUnitContent;
      } else {
        // If the unit content is not found, return the response so that the caller can
        // handle it appropriately.
        if (response.status === 404) {
          return response;
        } else {
          throw Error(`Request rejected with status ${response.status}`);
        }
      }
    })
    .catch(error => {
      throw Error(`Failed to load unit ${unitUrl} cause:\n ${error}`);
    });
}

export function getGuideJson(unitId: string | undefined, curriculumConfig: ICurriculumConfig) {
  const unitSpec = curriculumConfig.getUnitSpec(unitId);
  const guideUrl = unitSpec?.guide;
  return fetch(guideUrl!)
    .then(async (response) => {
      if (response.ok) {
        const guideContent = await response.json();
        const fullGuideContent = guideContent && populateProblemSections(guideContent, guideUrl!);
        return fullGuideContent;
      } else {
        // If the guide content is not found, return the response so that the caller can
        // handle it appropriately.
        if (response.status === 404) {
          return response;
        } else {
          throw Error(`Request rejected with status ${response.status}`);
        }
      }
    })
    .catch(error => {
      throw Error(`Request rejected with exception: ${error}`);
    });
}

export const populateProblemSections = async (content: Record<string, any>, unitUrl: string) => {
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
          externalSectionsArray.push(
            getExternalProblemSectionData(invIdx, probIdx, sectIdx, sectionDataUrl, sectionDataFile)
          );
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

export const getExternalProblemSectionData =
  async (invIdx: number, probIdx: number, sectIdx: number, dataUrl: string, sectionPath?: string) => {
    try {
      const sectionData = await fetch(dataUrl).then(res => res.json());
      sectionData.sectionPath = sectionPath;
      return { invIdx, probIdx, sectIdx, sectionData };
    } catch (error) {
      throw new Error(`Failed to load problem-section ${dataUrl} cause:\n ${error}`);
    }
  };

