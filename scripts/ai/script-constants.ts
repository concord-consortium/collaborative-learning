export type AIService = "vertexAI" | "azure" | "AWS";
export const tagFileExtension = {
  "vertexAI": ".csv",
  "azure": ".json",
  "AWS": ".json"
};

export interface DocumentInfo {
  fileName: string,
  tags: string[]
}

export const datasetPath = "../../src/public/ai/";

export const cloudFileRoot = "gs://cloud-ai-platform-d76df5a1-f27c-4288-8b89-f41e345567b9/";
