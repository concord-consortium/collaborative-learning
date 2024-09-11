import { parseSectionPath } from "../../../shared/shared";
import { Logger } from "../../lib/logger";
import { LogEventName } from "../../lib/logger-types";

interface ICurriculumLogEvent extends Record<string, any> {
  curriculum: string;
}

export function isCurriculumLogEvent(params: Record<string, any>): params is ICurriculumLogEvent {
  return !!params.curriculum;
}

function processCurriculumEventParams(params: ICurriculumLogEvent) {
  const { curriculum, ...others } = params;
  const [_unit, facet = "", _investigation, _problem, section] = parseSectionPath(curriculum) || [];
  // unit, investigation, and problem are already being logged as part of the common log params
  // log the facet and section separately; they're embedded in the path, but could be useful independently
  return { curriculum, curriculumFacet: facet, curriculumSection: section, ...others };
}

export function logCurriculumEvent(event: LogEventName, params: ICurriculumLogEvent) {
  Logger.log(event, processCurriculumEventParams(params));
}
