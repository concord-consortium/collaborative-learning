export interface DocumentInfo {
  fileName: string,
  tags: string[]
}

export interface IAzureMetadata {
  projectName?: string;
  storageInputContainerName?: string;
  description?: string;
  language?: string;
  multilingual?: boolean;
  settings?: Record<string, any>;
}

export interface IOutputFileProps {
  azureMetadata?: IAzureMetadata; // The metadata to use when targetting Azure
  documentInfo: Record<string, DocumentInfo>; // Information about each document
  fileName: string; // The name given to the output file
  sourceDirectory: string; // The name of the source directory. This should be in src/public/ai/
}
