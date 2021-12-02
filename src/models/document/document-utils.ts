import { ProblemModelType } from "../curriculum/problem";
import { AppConfigModelType } from "../stores/app-config-model";
import { DocumentModelType } from "./document";
import { isPlanningType, isProblemType } from "./document-types";

export function getDocumentDisplayTitle(
  document: DocumentModelType, appConfig: AppConfigModelType, problem: ProblemModelType
) {
  const { type } = document;
  return document.isSupport
    ? document.getProperty("caption") || "Support"
    : isProblemType(type)
        ? problem.title
        : isPlanningType(type)
            ? `${problem.title}: Planning`
            : document.getDisplayTitle(appConfig);
}
