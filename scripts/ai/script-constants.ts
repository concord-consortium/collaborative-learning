export type AIService = "vertexAI" | "azure" | "AWS";
export const tagFileExtension = {
  "vertexAI": ".csv",
  "azure": ".json",
  "AWS": ".json"
};

export const datasetPath = "../../src/public/ai/";
