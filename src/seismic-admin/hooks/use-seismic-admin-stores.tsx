import { createContext, useContext } from "react";
import { SeismicAdminStore } from "../seismic-admin-store";

export const SeismicAdminStoreContext = createContext<SeismicAdminStore | null>(null);

export function useSeismicAdminStore() {
  const store = useContext(SeismicAdminStoreContext);

  if (!store) {
    throw new Error("useSeismicAdminStore must be used within a SeismicAdminStoreContext");
  }

  return store;
}
