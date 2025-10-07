import { getContent } from "../../utilities/get-content";
import { ICurriculumConfig } from "../stores/curriculum-config";

export function getUnitJson(unitId: string | undefined, curriculumConfig: ICurriculumConfig) {
  const unitSpec = curriculumConfig.getUnitSpec(unitId);
  const unitUrl = unitSpec?.content;
  return fetchJson(unitUrl!);
}

export function getGuideJson(unitId: string | undefined, curriculumConfig: ICurriculumConfig) {
  const unitSpec = curriculumConfig.getUnitSpec(unitId);
  const guideUrl = unitSpec?.guide;
  return fetchJson(guideUrl!);
}

function fetchJson(url: string) {
  return getContent(url)
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
      throw Error(`Failed to load content ${url} cause:\n ${error}`);
    });
}
