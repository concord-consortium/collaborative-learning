import { ICurriculumConfig } from "../stores/curriculum-config";

export function getUnitJson(unitId: string | undefined, curriculumConfig: ICurriculumConfig) {
  const unitSpec = curriculumConfig.getUnitSpec(unitId);
  const unitUrl = unitSpec?.content;
  return fetch(unitUrl!)
    .then((response) => {
      if (response.ok) {
        return response.json();
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
    .then((response) => {
      if (response.ok) {
        return response.json();
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



