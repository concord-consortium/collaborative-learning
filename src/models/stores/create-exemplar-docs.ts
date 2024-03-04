import { ProblemModelType } from "../curriculum/problem";
import { DocumentsModelType } from "./documents";
import { DocumentModel } from "../document/document";
import { UserModelType } from "./user";
import { ClassModelType, ClassUserModel } from "./class";
import { kExemplarUserParams } from "./user-types";

interface ICreateExemplarDocsParams {
  unitUrl: string;
  problem: ProblemModelType;
  documents: DocumentsModelType;
  classStore: ClassModelType;
  user: UserModelType;
}

export async function createAndLoadExemplarDocs({
  unitUrl,
  problem,
  documents,
  classStore,
  user
}: ICreateExemplarDocsParams) {
  const { exemplarPaths } = problem;
  const exemplarsData = await getExemplarsData(unitUrl, exemplarPaths);
  classStore.addSingleUser(ClassUserModel.create(kExemplarUserParams));
  createExemplarDocs(documents, user, exemplarsData);
}

export async function getExemplarsData(unitUrl: string, exemplarUrls: string[]){
  return await Promise.all(
    exemplarUrls.map(async (url: string) => {
      const fetchUrl = new URL(url, unitUrl).href;
      const response = await fetch(fetchUrl);
      const data = await response.json();
      const urlSegments = fetchUrl.split("/");
      return {
        ...data,
        url: fetchUrl,
        curriculumBranch: urlSegments[5],
        unit: urlSegments[6],
        dirName: urlSegments[7],
        investigationSlug: urlSegments[8],
        problemSlug: urlSegments[9],
        exemplarSlug: urlSegments[10],
      };
    })
  );
}

function createExemplarDocId(exemplarData: any) {
  // QUESTION: I have yet to understand how this is going to be used so this is dummy function
  const {
    curriculumBranch,
    unit,
    dirName,
    investigationSlug,
    problemSlug,
    exemplarSlug
  } = exemplarData;
  return `${curriculumBranch}-${unit}-${dirName}-${investigationSlug}-${problemSlug}-${exemplarSlug}`;
}

function createExemplarDocs(documents: DocumentsModelType, user: UserModelType, exemplarsData: any) {
  exemplarsData.forEach((exemplarData: any) => {
    const exemplarDocId = createExemplarDocId(exemplarData);
    // QUESTION: I see "title" some places? And properties.caption others? Using both for now.
    const newDocParams = {
      title: exemplarData.title,
      uid: 'ivan_idea_1',
      type: "personal",
      visibility: "public",
      content: exemplarData.content,
      key: exemplarDocId,
      properties: {
        caption: exemplarData.title
      }
    };
    makeDocFromData(newDocParams, documents);
  });
}

function makeDocFromData(newDocParams: any, documents: DocumentsModelType) {
  const newDoc = DocumentModel.create(newDocParams);
  documents.add(newDoc);
}
