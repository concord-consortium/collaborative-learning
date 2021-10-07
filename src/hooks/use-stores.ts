import { MobXProviderContext } from "mobx-react";
import { useContext, useMemo } from "react";
import { DB } from "../lib/db";
import {
  buildSectionPath, getCurriculumMetadata, ICurriculumMetadata, IDocumentMetadata, isSectionPath, networkDocumentKey
} from "../../functions/src/shared";
import { ProblemModelType } from "../models/curriculum/problem";
import { AppConfigModelType } from "../models/stores/app-config-model";
import { DocumentsModelType } from "../models/stores/documents";
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

export function useDocumentMetadataFromStore(key?: string): IDocumentMetadata | undefined {
  const document = useDocumentFromStore(key);
  return useMemo(() => {
    return key && document ? document.getMetadata() : undefined;
    // updating when the key changes is sufficient
  }, [key]);  // eslint-disable-line react-hooks/exhaustive-deps
}

export function useDocumentOrCurriculumMetadata(key?: string): IDocumentMetadata | ICurriculumMetadata | undefined {
  const documentMetadata = useDocumentMetadataFromStore(key);
  return useMemo(() => {
    return isSectionPath(key) ? getCurriculumMetadata(key) : documentMetadata;
  }, [documentMetadata, key]);
}

export function useTypeOfTileInDocumentOrCurriculum(key?: string, tileId?: string) {
  const { documents } = useStores();
  if (!key || !tileId) return;
  if (isSectionPath(key)) {
    // for curriculum documents, tileId is `${section}_${tileType}_${index}`
    const execResult = /.*_(.+)_\d+$/.exec(tileId);
    return execResult?.[1];
  }
  else {
    return documents.getTypeOfTileInDocument(key, tileId);
  }
}

export function useFeatureFlag(feature: string) {
  return isFeatureSupported(useStores(), feature);
}

export function useGroupsStore(): GroupsModelType {
  return useStores().groups;
}

export function useNetworkDocuments(): DocumentsModelType {
  return useStores().networkDocuments;
}

export function useNetworkDocumentKey(documentKey: string) {
  const user = useUserStore();
  return networkDocumentKey(user.id, documentKey, user.network);
}

export function useProblemPath() {
  return useStores().problemPath;
}

export function useProblemPathWithFacet(facet?: string) {
  const problemPath = useProblemPath();
  return buildSectionPath(problemPath, undefined, facet);
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
