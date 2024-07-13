import fs from "fs";

import { IOutputFileProps } from "./script-types.js";

import { datasetPath } from "./script-constants.js";

export const cloudFileRoot = "gs://cloud-ai-platform-d76df5a1-f27c-4288-8b89-f41e345567b9/";

export function outputVertexAIFile(props: IOutputFileProps) {
  console.log(`**** Writing VertexAI Output File ****`);
  const { documentInfo, fileName, sourceDirectory } = props;

  const tagFileContent = Object.values(documentInfo).map(info => {
    const documentFileName = `${cloudFileRoot}${info.fileName}`;
    const tagPart = info.tags.join(",");
    const comma = tagPart ? "," : "";
    return `${documentFileName}${comma}${tagPart}\n`;
  }).join("");

  const filePath = `${datasetPath}${sourceDirectory}/${fileName}`;
  fs.writeFileSync(filePath, tagFileContent);
  console.log(`**** Tags saved to ${filePath} ****`);
}
