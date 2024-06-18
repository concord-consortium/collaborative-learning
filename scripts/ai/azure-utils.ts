// Utility functions related to Azure
import fs from "fs";
import stringify from "json-stringify-pretty-compact";

import { datasetPath } from "./script-constants";
import { IAzureMetadata, IOutputFileProps } from "./script-types";

const defaultAzureMetadata: IAzureMetadata = {
  projectName: "Project Name",
  storageInputContainerName: "default-storage-container",
  description: "Default description.",
  language: "en",
  multilingual: false,
  settings: {}
};

export function outputAzureFile(props: IOutputFileProps) {
  console.log(`**** Writing Azure Output File ****`);
  const { azureMetadata, documentInfo, fileName, sourceDirectory } = props;

  // Look through all tags to determine whether this is single label and what all the possible tags are
  let singleLabel = true;
  const tagCounts: Record<string, number> = {};
  Object.values(documentInfo).forEach(info => {
    if (info.tags.length !== 1) singleLabel = false;
    info.tags.forEach(tag => {
      if (!tagCounts[tag]) tagCounts[tag] = 0;
      tagCounts[tag]++;
    });
  });

  // Construct json for output file
  const projectKind = `Custom${singleLabel ? "Single" : "Multi"}LabelClassification`;
  const metadata = { ...defaultAzureMetadata, ...azureMetadata, projectKind };
  const classes = Object.keys(tagCounts).map(tag => ({ category: tag }));
  const documents = Object.values(documentInfo).map(info => {
    const document: any = {
      location: info.fileName,
      language: "en-us"
    };
    if (singleLabel) {
      document.class = {
        category: info.tags[0]
      };
    } else {
      document.classes = info.tags.map(tag => ({ category: tag }));
    }
    return document;
  });
  const assets = { projectKind, classes, documents };
  const tagFileJson: any = {
    projectFileVersion: `${Date.now()}`,
    "stringIndexType": "Utf16CodeUnit",
    metadata,
    assets
  };

  // Write output file
  const filePath = `${datasetPath}${sourceDirectory}/${fileName}`;
  fs.writeFileSync(filePath, stringify(tagFileJson, { maxLength: 100 }));
  console.log(`**** Tags saved to ${filePath} ****`);
}
