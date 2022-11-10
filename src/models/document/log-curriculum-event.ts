import { parseSectionPath } from "../../../functions/src/shared";
import { Logger } from "../../lib/logger";
import { LogEventName } from "../../lib/logger-types";

export const kLogCurriculumEvent = "LogCurriculumEvent";

interface IParams extends Record<string, any> {
  curriculum: string;
}

Logger.registerEventType(kLogCurriculumEvent, (params) => {
  const { curriculum, ...others } = params as IParams;
  const [_unit, facet = "", _investigation, _problem, section] = parseSectionPath(curriculum) || [];
  // unit, investigation, and problem are already being logged as part of the common log params
  // log the facet and section separately; they're embedded in the path, but could be useful independently
  return { curriculum, curriculumFacet: facet, curriculumSection: section, ...others };
});

export function logCurriculumEvent(event: LogEventName, params: IParams) {
  Logger.logEvent(kLogCurriculumEvent, event, params);
}
