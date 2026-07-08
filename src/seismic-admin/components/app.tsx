import { observer } from "mobx-react";
import React, { useEffect, useMemo } from "react";
import { SeismicAdminStoreContext } from "../hooks/use-seismic-admin-stores";
import { SeismicAdminStore } from "../seismic-admin-store";
import { AdminHeader } from "./admin-header";
import "./app.scss";

export const App = observer(function App() {
  const store = useMemo(() => new SeismicAdminStore(), []);

  useEffect(() => { void store.refresh(); }, [store]);

  return (
    <SeismicAdminStoreContext.Provider value={store}>
      <div className="seismic-admin">
        <AdminHeader />
      </div>
    </SeismicAdminStoreContext.Provider>
  );
});
