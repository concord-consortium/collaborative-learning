import { ProblemModelType } from "../curriculum/problem";
import { DocumentsModelType } from "./documents";
import { DocumentModelSnapshotType, createDocumentModelWithEnv } from "../document/document";
import { UserModelType } from "./user";
import { ClassModelType, ClassUserModel } from "./class";
import { kExemplarUserParams } from "./user-types";
import { ICurriculumConfig } from "./curriculum-config";
import { ExemplarDocument } from "../document/document-types";
import { AppConfigModelType } from "./app-config-model";

interface ICreateExemplarDocsParams {
  unitUrl: string;
  problem: ProblemModelType;
  documents: DocumentsModelType;
  classStore: ClassModelType;
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
  unitUrl,
  problem,
  documents,
  classStore,
  curriculumConfig,
  appConfig
}: ICreateExemplarDocsParams) {
  const { exemplarPaths } = problem;
  const exemplarsData = await getExemplarsData(unitUrl, exemplarPaths);
  classStore.addUser(ClassUserModel.create(kExemplarUserParams));
  createExemplarDocs(documents, exemplarsData, curriculumConfig, appConfig);
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
  documents: DocumentsModelType,
  exemplarsData: IExemplarData[],
  curriculumConfig: ICurriculumConfig,
  appConfig: AppConfigModelType
) {
  exemplarsData.forEach((exemplarData: any) => {
    const exemplarDocId = createExemplarDocId(exemplarData.url, curriculumConfig.curriculumBaseUrl);
    const newDocParams: DocumentModelSnapshotType = {
      title: exemplarData.title,
      uid: 'ivan_idea_1',
      type: ExemplarDocument,
      visibility: "public",
      content: exemplarData.content,
      key: exemplarDocId,
      properties: {
        authoredCommentTag: exemplarData.tag
      }
    };
    makeDocFromData(newDocParams, documents, appConfig);
  });
}

function makeDocFromData(
  newDocParams: DocumentModelSnapshotType,
  documents: DocumentsModelType,
  appConfig: AppConfigModelType
) {
  const newDoc = createDocumentModelWithEnv(appConfig, newDocParams);
  documents.add(newDoc);
}
