import { IUserContext } from "../../shared/shared";
import { useStores } from "./use-stores";

export const useUserContext = (): IUserContext => {
  const stores = useStores();
  return stores.userContextProvider.userContext;
};
