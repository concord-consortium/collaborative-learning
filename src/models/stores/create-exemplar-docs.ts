import { useStores } from "../../hooks/use-stores";
import { ProblemModelType } from "../curriculum/problem";
import { DocumentsModelType } from "./documents";

interface ICreateExemplarDocsParams {
  unitContentUrl: string;
  problem: ProblemModelType;
  docsStore: DocumentsModelType;
}

export async function createExemplarDocs({ unitContentUrl, problem, docsStore }: ICreateExemplarDocsParams) {
  const { exemplarPaths } = problem;
  const exemplarsData = await getExemplarsData(unitContentUrl, exemplarPaths);
  addExemplarDocsToStore(docsStore, exemplarsData);
}

export async function getExemplarsData(unitContentUrl: string, exemplarUrls: string[]){
  return await Promise.all(
    exemplarUrls.map(async (url: string) => {
      const fetchUrl = new URL(url, unitContentUrl).href;
      const response = await fetch(fetchUrl);
      const data = await response.json();
      // HMM: I know I am supposed to retain this info for id generation later?
      const urlSegments = fetchUrl.split("/");
      return {
        url: fetchUrl,
        curriculumBranch: urlSegments[5],
        unit: urlSegments[6],
        dirName: urlSegments[7],
        investigationSlug: urlSegments[8],
        problemSlug: urlSegments[9],
        exemplarSlug: urlSegments[10],
        ...data
      }; //HMM it was fun to get these segments, but maybe I should just swap/escape stuff
    })
  );
}

export function useExemplar(docsStore: DocumentsModelType, exemplarsData: any) {
  const { problem, documents, unit, user, groups } = useStores();
  exemplarsData.forEach((exemplarData: any) => {
    // create a document
    const exemplarDocId = createExemplarDocId(exemplarData);
    const group = groups.groupForUser(uid);
    const groupId = group && group.id;
    const newDocParams = {
      groupId: 1, // HEY: we will need get the current user's group id
      title: exemplarData.exemplarSlug, // HEY: we are going to need to have gotten the title
      uid: 999, // HEY: we will need IvanIdeas user id?
      type: "personal", // HEY this is for now, will soon be "exemplar"
      visibility: "public",
      properties: { key: exemplarDocId} // HEY: this is not right, but lets see if it works
    };
    console.log("| make a doc with these params", newDocParams);
    // THEN: ? ...make sure it is exposed in sort view
  });
}

function createExemplarDocId(exemplarData: any) {
  // HMM: I have yet to understand how this is going to be used so this is dummy function
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
