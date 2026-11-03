import { ISchemaVersionInfo } from "../tiles/schema-version-info";
import { SharedModel } from "./shared-model";

export interface ISharedModelInfo {
  type: string;
  modelClass: typeof SharedModel;
  // Set to true if model supports `name` and `setName` methods.
  hasName: boolean;
  // If supplied, the shared model's JSON has versions and older ones can be converted to the current one.
  schemaVersion?: ISchemaVersionInfo;
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
