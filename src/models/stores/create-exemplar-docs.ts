import { ProblemModelType } from "../curriculum/problem";
import { DocumentsModelType } from "./documents";

interface ICreateExemplarDocsParams {
  unitContentUrl: string;
  problem: ProblemModelType;
  docsStore: DocumentsModelType;
}

export async function createExemplarDocs({ unitContentUrl, problem, docsStore }: ICreateExemplarDocsParams) {
  const { exemplarPaths } = problem;
  const exemplarsData = await fetchExemplars(unitContentUrl, exemplarPaths);
  console.log("| create and load in exemplar docs from this data: ", exemplarsData);
}

export async function fetchExemplars(unitContentUrl: string, exemplarUrls: string[]){
  return await Promise.all(
    exemplarUrls.map(async (url: string) => {
      const fetchUrl = new URL(url, unitContentUrl).href;
      const response = await fetch(fetchUrl);
      return await response.json();
    })
  );
}

