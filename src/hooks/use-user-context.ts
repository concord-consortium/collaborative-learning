import { useMemo } from "react";
import { IUserContext } from "../../functions/src/shared";
import { IStores } from "../models/stores/stores";
import { useStores } from "./use-stores";

export const getUserContext = (stores: IStores): IUserContext => {
  const appMode = stores.appMode;
  const { name: demoName } = stores.demo;
  const classInfo = stores.class;
  const { id: uid, portal, type, name, network, classHash } = stores.user;
  const teachers: string[] = [];
  classInfo.users.forEach(user => (user.type === "teacher") && teachers.push(user.id));
  return {
    appMode, demoName, portal, uid, type, name, network, classHash, teachers
  };
};

export const useUserContext = (): IUserContext => {
  const stores = useStores();
  return useMemo(() => getUserContext(stores), [stores]);
};
