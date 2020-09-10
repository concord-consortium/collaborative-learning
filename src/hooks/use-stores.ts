import { MobXProviderContext } from "mobx-react";
import { useContext } from "react";
import { GroupsModelType } from "../models/stores/groups";
import { IStores } from "../models/stores/stores";

// https://mobx-react.js.org/recipes-migration
export function useStores(): IStores {
  return useContext(MobXProviderContext).stores;
}

export function useGroupsStore(): GroupsModelType {
  return useStores().groups;
}
