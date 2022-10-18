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
  const network = stores.user.network;
  // The network of the user gets loaded after the rest of the user information
  // is loaded. So a component that is calling useUserContext might be rendered
  // before the network is loaded. So getUserContext needs to be called again in
  // this case. 
  //
  // TODO: It'd be better if the user context was a MobX view (derived value)
  // then changes to any properties that make up the user context would cause a
  // re-render of observing components. In that case we can get rid of the
  // useMemo here.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => getUserContext(stores), [stores, network]);
};
