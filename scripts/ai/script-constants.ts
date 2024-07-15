import { getScriptRootFilePath } from "../lib/script-utils.js";

export type AIService = "vertexAI" | "azure" | "AWS";
export const tagFileExtension = {
  "vertexAI": ".csv",
  "azure": ".json",
  "AWS": ".json"
};

export const datasetPath = getScriptRootFilePath("../src/public/ai") + "/";
export const networkFileName = "network.json";
