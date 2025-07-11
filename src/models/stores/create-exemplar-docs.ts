import { ProblemModelType } from "../curriculum/problem";
import { DocumentsModelType } from "./documents";
import { DocumentModelSnapshotType, createDocumentModelWithEnv } from "../document/document";
import { UserModelType } from "./user";
import { ICurriculumConfig } from "./curriculum-config";
import { ExemplarDocument } from "../document/document-types";
import { AppConfigModelType } from "./app-config-model";
import { UnitModelType } from "../curriculum/unit";
import { InvestigationModelType } from "../curriculum/investigation";
import { kExemplarUserParams } from "../../../shared/shared";

interface ICreateExemplarDocsParams {
  unit: UnitModelType;
  unitUrl: string;
  investigation?: InvestigationModelType;
  problem: ProblemModelType;
  documents: DocumentsModelType;
  user: UserModelType;
  curriculumConfig: ICurriculumConfig;
  appConfig: AppConfigModelType;
}

interface IExemplarData {
  content: DocumentModelSnapshotType;
  tag: string;
  title: string;
  url: string;
}

// TODO: pass the stores as a parameter, but use a simplified interface
// plus a second paramter for the unitUrl
// function would only require the properties it needs
export async function createAndLoadExemplarDocs({
  unit,
  unitUrl,
  investigation,
  problem,
  documents,
  curriculumConfig,
  appConfig
}: ICreateExemplarDocsParams) {
  const { exemplars } = problem;
  const exemplarsData = await getExemplarsData(unitUrl, exemplars);
  createExemplarDocs(unit, investigation, problem, documents, exemplarsData, curriculumConfig, appConfig);
}

export async function getExemplarsData(unitUrl: string, exemplarUrls: string[]){
  return Promise.all(
    exemplarUrls.map(async (url: string) => {
      const fetchUrl = new URL(url, unitUrl).href;
      const response = await fetch(fetchUrl);
      const data = await response.json();
      // TODO: validate shape of `data`?
      const result: IExemplarData = {
        ...data,
        url: fetchUrl
      };
      return result;
    })
  );
}

export function createExemplarDocId(exemplarDataUrl: string, curriculumBaseUrl: string) {
  let identifier = exemplarDataUrl;
  if (exemplarDataUrl.startsWith(curriculumBaseUrl)) {
    identifier = exemplarDataUrl.slice(curriculumBaseUrl.length);
  }
  return "curriculum:" + encodeURIComponent(identifier).replace(/\./g, "%2E");
}

function createExemplarDocs(
  unit: UnitModelType,
  investigation: InvestigationModelType | undefined,
  problem: ProblemModelType,
  documents: DocumentsModelType,
  exemplarsData: IExemplarData[],
  curriculumConfig: ICurriculumConfig,
  appConfig: AppConfigModelType
) {
  exemplarsData.forEach((exemplarData: any) => {
    const exemplarDocId = createExemplarDocId(exemplarData.url, curriculumConfig.curriculumBaseUrl);
    const visibility = appConfig.initiallyHideExemplars ? "private" : "public";
    const newDocParams: DocumentModelSnapshotType = {
      title: exemplarData.title,
      uid: kExemplarUserParams.id,
      type: ExemplarDocument,
      visibility,
      content: exemplarData.content,
      key: exemplarDocId,
      properties: {
        authoredCommentTag: exemplarData.tag
      },
      unit: unit.code,
      investigation: investigation?.ordinal.toString(),
      problem: problem.ordinal.toString()
    };
    const newDoc = createDocumentModelWithEnv(appConfig, newDocParams);
    documents.add(newDoc);
  });
}
