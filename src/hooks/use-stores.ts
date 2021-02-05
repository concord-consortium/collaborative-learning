import { MobXProviderContext } from "mobx-react";
import { useContext } from "react";
import { ProblemModelType } from "../models/curriculum/problem";
import { AppConfigModelType } from "../models/stores/app-config-model";
import { GroupsModelType } from "../models/stores/groups";
import { SelectionStoreModelType } from "../models/stores/selection";
import { getSettingFromStores, IStores } from "../models/stores/stores";
import { UserModelType } from "../models/stores/user";
import { UIModelType } from "../models/stores/ui";

// https://mobx-react.js.org/recipes-migration
export function useStores(): IStores {
  return useContext(MobXProviderContext).stores;
}

export function useAppConfigStore(): AppConfigModelType {
  return useStores().appConfig;
}

export function useGroupsStore(): GroupsModelType {
  return useStores().groups;
}

export function useUserStore(): UserModelType {
  return useStores().user;
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
