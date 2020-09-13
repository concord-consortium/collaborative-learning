import { MobXProviderContext } from "mobx-react";
import { useContext } from "react";
import { AppConfigModelType } from "../models/stores/app-config-model";
import { GroupsModelType } from "../models/stores/groups";
import { IStores } from "../models/stores/stores";
import { UserModelType } from "../models/stores/user";

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
