import { MobXProviderContext } from "mobx-react";
import { useContext } from "react";
import { ProblemModelType } from "../models/curriculum/problem";
import { AppConfigModelType } from "../models/stores/app-config-model";
import { GroupsModelType } from "../models/stores/groups";
import { IStores } from "../models/stores/stores";
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

export function useUiStore(): UIModelType {
  return useStores().ui;
}
