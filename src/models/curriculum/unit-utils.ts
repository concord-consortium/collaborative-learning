import { getContent } from "../../utilities/get-content";
import { ICurriculumConfig } from "../stores/curriculum-config";
import { ILiveProblem } from "../../../shared/unit-summary-slice";
import { UnitModelType } from "./unit";

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

// Walks a loaded unit's investigations/problems in authored order, the shape shared/unit-summary-slice.ts
// needs to filter an aiUnitSummary against the live curriculum. Shared by every client-side AI
// consumer that builds that filter (chat-tutor/unit-context.ts, the AI tile) so they can't drift.
export function liveProblemsFromUnit(unit: UnitModelType): ILiveProblem[] {
  return unit.investigations.reduce<ILiveProblem[]>((acc, investigation) => {
    investigation.problems.forEach(problem => {
      acc.push({ ordinal: `${investigation.ordinal}.${problem.ordinal}`, title: problem.title });
    });
    return acc;
  }, []);
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
