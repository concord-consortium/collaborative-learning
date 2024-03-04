import { SharedModel } from "./shared-model";

export interface ISharedModelInfo {
  type: string;
  modelClass: typeof SharedModel;
  // Set to true if model supports `name` and `setName` methods.
  hasName: boolean;
}

const gSharedModelInfoMap: Record<string, ISharedModelInfo> = {};

export function registerSharedModelInfo(sharedModelInfo: ISharedModelInfo) {
  gSharedModelInfoMap[sharedModelInfo.type] = sharedModelInfo;
}

export function getSharedModelClasses() {
  return Object.values(gSharedModelInfoMap).map(info => info.modelClass);
}

export function getSharedModelInfoByType(type: string) {
  return type ? gSharedModelInfoMap[type] : undefined;
}
