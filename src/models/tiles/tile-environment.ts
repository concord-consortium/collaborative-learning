import { getEnv, hasEnv, IAnyStateTreeNode } from "mobx-state-tree";
import { ISharedModelManager } from "../shared/shared-model-manager";
import { AppConfigModelType } from "../stores/app-config-model";

export interface ITileEnvironment {
  appConfig?: AppConfigModelType;
  sharedModelManager?: ISharedModelManager;
}

export function getTileEnvironment(node?: IAnyStateTreeNode) {
  return node && hasEnv(node) ? getEnv<ITileEnvironment | undefined>(node) : undefined;
}

export function getAppConfig(node?: IAnyStateTreeNode) {
  return getTileEnvironment(node)?.appConfig;
}

export function getSharedModelManager(node?: IAnyStateTreeNode) {
  return getTileEnvironment(node)?.sharedModelManager;
}
