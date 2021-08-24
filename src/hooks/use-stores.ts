import { MobXProviderContext } from "mobx-react";
import { useContext } from "react";
import { DB } from "../lib/db";
import { IDocumentMetadata, networkDocumentKey } from "../../functions/src/shared-types";
import { ProblemModelType } from "../models/curriculum/problem";
import { AppConfigModelType } from "../models/stores/app-config-model";
import { GroupsModelType } from "../models/stores/groups";
import { SelectionStoreModelType } from "../models/stores/selection";
import { getSettingFromStores, isFeatureSupported, IStores } from "../models/stores/stores";
import { UserModelType } from "../models/stores/user";
import { UIModelType } from "../models/stores/ui";

// https://mobx-react.js.org/recipes-migration
export function useStores(): IStores {
  return useContext(MobXProviderContext).stores;
}

export function useAppConfigStore(): AppConfigModelType {
  return useStores().appConfig;
}

export function useAppMode() {
  return useStores().appMode;
}

export function useClassStore() {
  return useStores().class;
}

export function useDBStore(): DB {
  return useStores().db;
}

export function useDemoStore() {
  return useStores().demo;
}

export function useDocumentFromStore(key?: string) {
  const stores = useStores();
  return key ? stores.documents.getDocument(key) : undefined;
}

export function useDocumentMetadataFromStore(key?: string): IDocumentMetadata | undefined{
  const document = useDocumentFromStore(key);
  return key && document ? document.getMetadata() : undefined;
}

export function useFeatureFlag(feature: string) {
  return isFeatureSupported(useStores(), feature);
}

export function useGroupsStore(): GroupsModelType {
  return useStores().groups;
}

export function useNetworkDocumentKey(documentKey: string) {
  return networkDocumentKey(documentKey, useUserStore().teacherNetwork);
}

export function useProblemStore(): ProblemModelType {
  return useStores().problem;
}

export function useSettingFromStores(key: string, group?: string) {
  return getSettingFromStores(useStores(), key, group);
}

export function useSharedSelectionStore(): SelectionStoreModelType {
  return useStores().selection;
}

export function useUIStore(): UIModelType {
  return useStores().ui;
}

export function useUserStore(): UserModelType {
  return useStores().user;
}
